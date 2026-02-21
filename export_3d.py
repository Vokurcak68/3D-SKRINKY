"""
Export skriniek z Oresi databázy do 3D formátov
===============================================
Databáza obsahuje:
- Kusovnik: hlavný zoznam skriniek s rozmermi (výška, hĺbka)
- MatKusovnikSirka: dostupné šírky pre každú skrinku
- GeoObjekt: 3D geometria vo formáte VRML V2.0 (komprimovaná zlib)
- GeoScriptSortTechn: parametrické skripty pre generovanie geometrie
"""

from access_parser import AccessParser
import zlib
import os
import json


def load_database(db_path):
    """Načíta Access databázu a vráti parser"""
    return AccessParser(db_path)


def get_cabinets(db):
    """Získa zoznam všetkých skriniek s ich parametrami"""
    kusovnik = db.parse_table('Kusovnik')
    sirky = db.parse_table('MatKusovnikSirka')
    skupiny = db.parse_table('SortSkupina')
    druhy = db.parse_table('SortDruh')

    cabinets = []

    for i in range(len(kusovnik['KusovnikID'])):
        if not kusovnik['Platnost'][i]:
            continue

        kid = kusovnik['KusovnikID'][i]

        # Získaj šírky pre túto skrinku
        widths = []
        for j in range(len(sirky['KusovnikID'])):
            if sirky['KusovnikID'][j] == kid and sirky['Platnost'][j]:
                widths.append({
                    'width_mm': sirky['SirkaMM'][j],
                    'geo_id': sirky['GeoID'][j]
                })

        # Nájdi skupinu
        skupina_id = kusovnik['SkupinaID'][i]
        skupina_nazov = None
        for s in range(len(skupiny['SkupinaID'])):
            if skupiny['SkupinaID'][s] == skupina_id:
                skupina_nazov = skupiny['Nazov'][s]
                break

        cabinet = {
            'id': kid,
            'name': kusovnik['Nazov'][i],
            'code': kusovnik['Kod'][i],
            'description': kusovnik['Popis'][i],
            'height_mm': kusovnik['VyskaMM'][i],
            'depth_mm': kusovnik['HlbkaMM'][i],
            'geo_id': kusovnik['GeoID'][i],
            'group': skupina_nazov,
            'widths': widths,
            'allow_custom': kusovnik['PovolitAtyp'][i],
            'modify_x': kusovnik['ModifikaciaX'][i],
            'modify_y': kusovnik['ModifikaciaY'][i],
            'modify_z': kusovnik['ModifikaciaZ'][i],
        }
        cabinets.append(cabinet)

    return cabinets


def get_geometry(db, geo_id):
    """Získa VRML geometriu pre dané GeoID"""
    geo = db.parse_table('GeoObjekt')

    for i in range(len(geo['GeoID'])):
        if geo['GeoID'][i] == geo_id:
            grafika = geo['Grafika'][i]
            if grafika and isinstance(grafika, bytes):
                try:
                    # Dekomprimuj (prvé 4 bajty sú hlavička)
                    decompressed = zlib.decompress(grafika[4:])
                    return {
                        'format': 'vrml',
                        'description': geo['Popis'][i],
                        'data': decompressed.decode('utf-8', errors='replace')
                    }
                except Exception as e:
                    return {'error': str(e)}
    return None


def export_cabinet_vrml(db, cabinet, output_dir):
    """Exportuje skrinku do VRML súborov"""
    os.makedirs(output_dir, exist_ok=True)

    # Exportuj hlavnú geometriu
    if cabinet['geo_id'] and cabinet['geo_id'] > 0:
        geo = get_geometry(db, cabinet['geo_id'])
        if geo and 'data' in geo:
            filename = f"{cabinet['name']}_main.wrl"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(geo['data'])
            print(f"  Exportované: {filename}")

    # Exportuj geometriu pre každú šírku
    exported_geo_ids = set()
    for width_info in cabinet['widths']:
        geo_id = width_info['geo_id']
        if geo_id and geo_id > 0 and geo_id not in exported_geo_ids:
            geo = get_geometry(db, geo_id)
            if geo and 'data' in geo:
                filename = f"{cabinet['name']}_geo{geo_id}.wrl"
                filepath = os.path.join(output_dir, filename)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(geo['data'])
                print(f"  Exportované: {filename}")
                exported_geo_ids.add(geo_id)


def export_all_cabinets_json(cabinets, output_file):
    """Exportuje všetky skrinky do JSON súboru"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cabinets, f, indent=2, ensure_ascii=False, default=str)
    print(f"Exportované: {output_file}")


def print_cabinet_summary(cabinets):
    """Vypíše prehľad skriniek"""
    print("\n" + "="*60)
    print("PREHĽAD SKRINIEK ORESI")
    print("="*60)

    # Skupiny
    groups = {}
    for cab in cabinets:
        group = cab['group'] or 'Bez skupiny'
        if group not in groups:
            groups[group] = []
        groups[group].append(cab)

    for group, cabs in sorted(groups.items()):
        print(f"\n{group}: {len(cabs)} položiek")
        for cab in cabs[:5]:  # Ukáž prvých 5
            widths = [w['width_mm'] for w in cab['widths']]
            widths_str = f"šírky: {min(widths)}-{max(widths)}mm" if widths else "bez šírok"
            print(f"  - {cab['name']}: {cab['height_mm']}x{cab['depth_mm']}mm, {widths_str}")
        if len(cabs) > 5:
            print(f"  ... a ďalších {len(cabs)-5} položiek")


def main():
    db_path = r'c:\Users\tomas\OneDrive\Apps\3D skrinky\sort.mdb'
    output_dir = r'c:\Users\tomas\OneDrive\Apps\3D skrinky\export'

    print("Načítavam databázu...")
    db = load_database(db_path)

    print("Získavam zoznam skriniek...")
    cabinets = get_cabinets(db)
    print(f"Nájdených {len(cabinets)} skriniek")

    # Prehľad
    print_cabinet_summary(cabinets)

    # Export JSON
    json_file = os.path.join(output_dir, 'cabinets.json')
    os.makedirs(output_dir, exist_ok=True)
    export_all_cabinets_json(cabinets, json_file)

    # Export VRML (len prvých 10 pre ukážku)
    print("\nExportujem VRML geometriu (ukážka prvých 10)...")
    for cab in cabinets[:10]:
        if cab['widths'] or (cab['geo_id'] and cab['geo_id'] > 0):
            print(f"\n{cab['name']} ({cab['code']}):")
            export_cabinet_vrml(db, cab, os.path.join(output_dir, 'vrml'))


if __name__ == '__main__':
    main()
