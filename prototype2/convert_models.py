"""
Konverze VRML modelů z Oresi databáze do JSON formátu pro Three.js
"""

import sys
sys.path.append('..')

from access_parser import AccessParser
import zlib
import json
import re
import os


def parse_vrml_to_threejs(vrml_content):
    """Parsuje VRML a extrahuje geometrii pro Three.js"""

    geometry = {
        'vertices': [],
        'indices': [],
        'normals': []
    }

    # Najdi všechny Coordinate body
    coord_pattern = r'Coordinate\s*\{\s*point\s*\[([\s\S]*?)\]'
    coord_matches = re.findall(coord_pattern, vrml_content)

    # Najdi všechny coordIndex
    index_pattern = r'coordIndex\s*\[([\s\S]*?)\]'
    index_matches = re.findall(index_pattern, vrml_content)

    all_vertices = []
    all_indices = []
    vertex_offset = 0

    for i, coord_match in enumerate(coord_matches):
        # Parsuj vrcholy
        vertices_raw = coord_match.replace('\n', ' ').replace(',', ' ')
        numbers = re.findall(r'-?\d+\.?\d*e?-?\d*', vertices_raw)

        vertices = []
        for j in range(0, len(numbers), 3):
            if j + 2 < len(numbers):
                try:
                    x = float(numbers[j])
                    y = float(numbers[j + 1])
                    z = float(numbers[j + 2])
                    vertices.append([x, y, z])
                except ValueError:
                    continue

        all_vertices.extend(vertices)

        # Parsuj indexy pokud existují
        if i < len(index_matches):
            indices_raw = index_matches[i].replace('\n', ' ').replace(',', ' ')
            index_numbers = re.findall(r'-?\d+', indices_raw)

            face = []
            for idx in index_numbers:
                idx_int = int(idx)
                if idx_int == -1:
                    # Konec face - vytvoř trojúhelníky
                    if len(face) >= 3:
                        # Fan triangulation
                        for k in range(1, len(face) - 1):
                            all_indices.append(face[0] + vertex_offset)
                            all_indices.append(face[k] + vertex_offset)
                            all_indices.append(face[k + 1] + vertex_offset)
                    face = []
                else:
                    face.append(idx_int)

        vertex_offset = len(all_vertices)

    geometry['vertices'] = all_vertices
    geometry['indices'] = all_indices

    return geometry


def get_cabinet_models(db_path, limit=50):
    """Získá modely skříněk z databáze"""

    db = AccessParser(db_path)
    kusovnik = db.parse_table('Kusovnik')
    sirky = db.parse_table('MatKusovnikSirka')
    geo = db.parse_table('GeoObjekt')
    skupiny = db.parse_table('SortSkupina')

    # Vytvoř mapu GeoID -> geometrie
    geo_map = {}
    for i in range(len(geo['GeoID'])):
        geo_id = geo['GeoID'][i]
        grafika = geo['Grafika'][i]
        popis = geo['Popis'][i]

        if grafika and isinstance(grafika, bytes):
            try:
                decompressed = zlib.decompress(grafika[4:])
                vrml_content = decompressed.decode('utf-8', errors='replace')
                geo_map[geo_id] = {
                    'vrml': vrml_content,
                    'description': popis
                }
            except:
                pass

    # Vytvoř mapu SkupinaID -> název
    skupina_map = {}
    for i in range(len(skupiny['SkupinaID'])):
        skupina_map[skupiny['SkupinaID'][i]] = skupiny['Nazov'][i]

    # Sbírej skříňky
    cabinets = []
    processed_geo_ids = set()

    for i in range(len(kusovnik['KusovnikID'])):
        if not kusovnik['Platnost'][i]:
            continue

        kid = kusovnik['KusovnikID'][i]
        nazov = kusovnik['Nazov'][i]
        kod = kusovnik['Kod'][i]
        vyska = kusovnik['VyskaMM'][i]
        hlbka = kusovnik['HlbkaMM'][i]
        skupina_id = kusovnik['SkupinaID'][i]

        # Přeskoč neplatné
        if not nazov or vyska <= 0 or hlbka <= 0:
            continue

        # Najdi šířky a GeoID pro tuto skříňku
        widths_data = []
        for j in range(len(sirky['KusovnikID'])):
            if sirky['KusovnikID'][j] == kid and sirky['Platnost'][j]:
                geo_id = sirky['GeoID'][j]
                sirka_mm = sirky['SirkaMM'][j]

                if geo_id and geo_id > 0 and geo_id in geo_map:
                    widths_data.append({
                        'width': sirka_mm,
                        'geo_id': geo_id
                    })

        if not widths_data:
            continue

        # Vyber první dostupnou šířku s geometrií
        first_width = widths_data[0]
        geo_id = first_width['geo_id']

        # Přeskoč duplicitní geometrie
        if geo_id in processed_geo_ids:
            continue
        processed_geo_ids.add(geo_id)

        skupina_nazov = skupina_map.get(skupina_id, 'Ostatní')

        cabinet = {
            'id': kid,
            'name': nazov,
            'code': kod,
            'group': skupina_nazov,
            'height': vyska,
            'depth': hlbka,
            'width': first_width['width'],
            'geo_id': geo_id,
            'widths': [w['width'] for w in widths_data]
        }

        cabinets.append(cabinet)

        if len(cabinets) >= limit:
            break

    return cabinets, geo_map


def create_box_geometry(width, height, depth):
    """Vytvoří jednoduchou box geometrii jako fallback"""
    w, h, d = width / 2000, height / 1000, depth / 1000  # Převod na metry a polovinu

    vertices = [
        [-w, 0, -d], [w, 0, -d], [w, h, -d], [-w, h, -d],  # zadní
        [-w, 0, d], [w, 0, d], [w, h, d], [-w, h, d],       # přední
    ]

    indices = [
        0, 1, 2, 0, 2, 3,  # zadní
        4, 6, 5, 4, 7, 6,  # přední
        0, 4, 5, 0, 5, 1,  # spodní
        2, 6, 7, 2, 7, 3,  # horní
        0, 3, 7, 0, 7, 4,  # levá
        1, 5, 6, 1, 6, 2,  # pravá
    ]

    return {'vertices': vertices, 'indices': indices}


def main():
    db_path = r'c:\Users\tomas\OneDrive\Apps\3D skrinky\sort.mdb'
    output_dir = r'c:\Users\tomas\OneDrive\Apps\3D skrinky\prototype\src\data'

    print("Načítám databázi Oresi...")
    cabinets, geo_map = get_cabinet_models(db_path, limit=100)

    print(f"Nalezeno {len(cabinets)} skříněk s geometrií")

    # Konvertuj geometrie
    models = {}
    for cab in cabinets:
        geo_id = cab['geo_id']

        if geo_id in geo_map:
            vrml = geo_map[geo_id]['vrml']
            geometry = parse_vrml_to_threejs(vrml)

            # Pokud se nepodařilo parsovat VRML, použij box
            if not geometry['vertices']:
                geometry = create_box_geometry(cab['width'], cab['height'], cab['depth'])
                geometry['type'] = 'box'
            else:
                geometry['type'] = 'vrml'

            models[geo_id] = geometry

    # Ulož data
    catalog_data = {
        'cabinets': cabinets,
        'models': {str(k): {
            'vertices': v['vertices'][:1000] if len(v['vertices']) > 1000 else v['vertices'],  # Omez velikost
            'indices': v['indices'][:3000] if len(v['indices']) > 3000 else v['indices'],
            'type': v.get('type', 'vrml')
        } for k, v in models.items()}
    }

    output_file = os.path.join(output_dir, 'catalog.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Uloženo do {output_file}")
    print(f"Počet modelů: {len(models)}")

    # Statistiky skupin
    groups = {}
    for cab in cabinets:
        g = cab['group']
        if g not in groups:
            groups[g] = 0
        groups[g] += 1

    print("\nSkupiny skříněk:")
    for g, count in sorted(groups.items(), key=lambda x: -x[1])[:10]:
        print(f"  {g}: {count}")


if __name__ == '__main__':
    main()
