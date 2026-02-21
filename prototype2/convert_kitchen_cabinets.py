"""
Konverze kuchyňských skříněk Oresi do 3D formátu pro Kitchen Designer
Rozděleno podle značek: Oresi (Dolti), Livanza, Bauformat
"""

import sys
sys.path.append('..')

from access_parser import AccessParser
import json
import os


def clean_and_translate_text(text):
    """Vyčistí a přeloží text z databáze do správné češtiny"""
    if not text:
        return text

    # Odstraň kontrolní znaky
    result = text.replace('\x01', '').replace('\r', '').replace('\x1b', '').replace('\x0c', '').replace('\x13', '')

    # PRVNÍ KROK: Nahraď vzory se surovými Latin-1 znaky (\xed = í, atd.)
    # Tyto vzory musí být nahrazeny PŘED převodem jednotlivých znaků
    raw_replacements = [
        # Skříňky - s \xed (í) a bez \x01
        ('SkY\xedHky', 'Skříňky'),
        ('skY\xedHky', 'skříňky'),
        ('SkY\xedHku', 'Skříňku'),
        ('skY\xedHku', 'skříňku'),
        ('SkY\xedHek', 'Skříněk'),
        ('skY\xedHek', 'skříněk'),
        ('skY\xedH', 'skříň'),
        ('SkY\xedH', 'Skříň'),
        ('skY\xedn', 'skřín'),
        ('SkY\xedn', 'Skřín'),
        # Dřez
        ('D\xedYez', 'Dříz'),
        ('d\xedYez', 'dříz'),
        ('DYez', 'Dřez'),
        ('dYez', 'dřez'),
        # Přístroj
        ('P\xed\xedstroj', 'Přístroj'),
        ('p\xed\xedstroj', 'přístroj'),
        ('P\xedístroj', 'Přístroj'),
        ('p\xedístroj', 'přístroj'),
        # Boční
        ('Bo\xe8n\xed', 'Boční'),
        ('bo\xe8n\xed', 'boční'),
        ('Bon\xed', 'Boční'),
        ('bon\xed', 'boční'),
        # Horní
        ('horn\xed', 'horní'),
        ('Horn\xed', 'Horní'),
        # Spodní
        ('spodn\xed', 'spodní'),
        ('Spodn\xed', 'Spodní'),
        # Výklopné
        ('v\xfdklopn\xe9', 'výklopné'),
        ('V\xfdklopn\xe9', 'Výklopné'),
        ('v\xfdklopn\xed', 'výklopní'),
        # Rohové
        ('rohov\xe9', 'rohové'),
        ('Rohov\xe9', 'Rohové'),
        # Vysoké/Vysoká
        ('Vysok\xe1', 'Vysoká'),
        ('vysok\xe1', 'vysoká'),
        ('Vysok\xe9', 'Vysoké'),
        ('vysok\xe9', 'vysoké'),
        ('Vysok\xfd', 'Vysoký'),
        ('vysok\xfd', 'vysoký'),
        # Výšky
        ('v\xfd\xb9ky', 'výšky'),
        ('V\xfd\xb9ky', 'Výšky'),
        # Šatní
        ('\xb9atn\xed', 'šatní'),
        ('\xb9ATN\xed', 'ŠATNÍ'),
        ('`atn\xed', 'šatní'),
        ('aatn\xed', 'šatní'),
        ('aATN\xed', 'ŠATNÍ'),
        # Žaluzie
        ('~aluz', 'žaluz'),
        # Myčky
        ('my\xe8k', 'myčk'),
        ('My\xe8k', 'Myčk'),
        # Podnož
        ('podno~', 'podnož'),
        ('Podno~', 'Podnož'),
        # Digestoř
        ('digesto\xf8', 'digestoř'),
        ('Digesto\xf8', 'Digestoř'),
        ('digestoY', 'digestoř'),
        # Vestavěné
        ('Vestav\xecn', 'Vestavěn'),
        ('vestav\xecn', 'vestavěn'),
        # Dvířka
        ('Dv\xed\xf8k', 'Dvířk'),
        ('dv\xed\xf8k', 'dvířk'),
        ('Dv\xedYk', 'Dvířk'),
        ('dv\xedYk', 'dvířk'),
        # Příslušenství, přístrojové
        ('P\xed\xedstrojov', 'Přístrojov'),
        ('p\xed\xedstrojov', 'přístrojov'),
        ('p\xed\xedslu\xb9', 'přísluš'),
        ('P\xed\xedslu\xb9', 'Přísluš'),
        # Spotřebiče
        ('spot\xf8eb', 'spotřeb'),
        ('Spot\xf8eb', 'Spotřeb'),
        ('spotYeb', 'spotřeb'),
        # Komín
        ('kom\xedn', 'komín'),
        # Závěsné
        ('z\xe1v\xecsn', 'závěsn'),
        ('Z\xe1v\xecsn', 'Závěsn'),
        # Prodloužení
        ('prodlou~en', 'prodloužen'),
        ('Prodlou~en', 'Prodloužen'),
        # Čela
        ('\xe8ela', 'čela'),
        ('\xe8el', 'čel'),
        # Drážkou
        ('dr\xe1~k', 'drážk'),
        # Ukončením
        ('ukon\xe8en', 'ukončen'),
        ('ukonení', 'ukončení'),
        ('ukonenm', 'ukončením'),
        # Nástavce
        ('N\xe1stav', 'Nástav'),
        ('n\xe1stav', 'nástav'),
        # Odtahové
        ('Odtahov\xe9', 'Odtahové'),
        # Procházím
        ('proch\xe1z', 'procház'),
        # Zmenšenou
        ('zmen\xb9en', 'zmenšen'),
        ('zmenaen', 'zmenšen'),
        ('zmenšen', 'zmenšen'),
        # Další časté vzory
        ('spoY\xe1k', 'sporák'),
        ('SpoY\xe1k', 'Sporák'),
    ]

    for old, new in raw_replacements:
        result = result.replace(old, new)

    # DRUHÝ KROK: Převeď zbývající Latin-1 znaky
    latin1_map = {
        '\xed': 'í',  # 0xED
        '\xe1': 'á',  # 0xE1
        '\xe9': 'é',  # 0xE9
        '\xfd': 'ý',  # 0xFD
        '\xfa': 'ú',  # 0xFA
        '\xf9': 'ů',  # 0xF9
        '\xf8': 'ř',  # 0xF8
        '\xe8': 'č',  # 0xE8
        '\xec': 'ě',  # 0xEC
        '\xef': 'ď',  # 0xEF
        '\xf2': 'ň',  # 0xF2
        '\xf5': 'ť',  # 0xF5
        '\xf3': 'ó',  # 0xF3
        '\xda': 'Ú',  # 0xDA
        '\xb9': 'š',  # 0xB9 (může být použito pro š v některých kódováních)
    }

    for old, new in latin1_map.items():
        result = result.replace(old, new)

    # TŘETÍ KROK: Oprav vzory po převodu Latin-1
    post_replacements = [
        # Y -> ř v kontextech
        ('skříňky', 'skříňky'),
        ('Skříňky', 'Skříňky'),
        ('SkYíň', 'Skříň'),
        ('skYíň', 'skříň'),
        ('skYín', 'skřín'),
        ('SkYín', 'Skřín'),
        ('DYez', 'Dřez'),
        ('dYez', 'dřez'),
        ('pYí', 'pří'),
        ('PYí', 'Pří'),
        ('pYe', 'pře'),
        ('PYe', 'Pře'),
        ('stYí', 'stří'),
        ('StYí', 'Stří'),
        ('spotYeb', 'spotřeb'),
        ('digestoY', 'digestoř'),
        # ~ -> ž
        ('~', 'ž'),
        # Backtick -> š
        ('`', 'š'),
        # Opravy koncovek - skřín -> skříň
        ('skřín ', 'skříň '),
        ('Skřín ', 'Skříň '),
        ('skříně', 'skříně'),
        ('Skříně', 'Skříně'),
        # Opravy "aa" -> "ša"
        ('aatní', 'šatní'),
        ('AATNÍ', 'ŠATNÍ'),
        # Opravy "ae" -> "še"
        ('aeno', 'šeno'),
        # Opravy dalších chyb
        ('míste', 'místě'),
        ('Míste', 'Místě'),
        ('prochozí', 'průchozí'),
        ('Prochozí', 'Průchozí'),
        # Závěsné
        ('závsné', 'závěsné'),
        ('Závsné', 'Závěsné'),
        # Myčka/pračka
        ('myku', 'myčku'),
        ('Myku', 'Myčku'),
        ('praku', 'pračku'),
        ('Praku', 'Pračku'),
        # Pecící
        ('peicí', 'pečicí'),
        ('Peicí', 'Pečicí'),
        # Spotřebiče
        ('spotY', 'spotř'),
        ('SpotY', 'Spotř'),
        # Lišty
        ('liaty', 'lišty'),
        ('Liaty', 'Lišty'),
        # Nástavbové
        ('nástavcove', 'nástavbové'),
        ('Nástavcove', 'Nástavbové'),
        # Chladničky/mrazničky
        ('chladniky', 'chladničky'),
        ('Chladniky', 'Chladničky'),
        ('mrazniky', 'mrazničky'),
        ('Mrazniky', 'Mrazničky'),
        ('mrazniku', 'mrazničku'),
        # Spotřebiče (koncovky)
        ('spotřebie', 'spotřebiče'),
        # Čela (bez háčku)
        (' ela ', ' čela '),
        (' elem', ' čelem'),
        # Kolíky
        ('kolíky', 'kolíky'),
        # Nadměrná
        ('nadmrná', 'nadměrná'),
        ('Nadmrná', 'Nadměrná'),
        ('nadmrn', 'nadměrn'),
        # Výška
        ('výakou', 'výškou'),
        ('Výakou', 'Výškou'),
        ('výaky', 'výšky'),
        ('Výaky', 'Výšky'),
        # Vnitřní
        ('vnitYní', 'vnitřní'),
        ('VnitYní', 'Vnitřní'),
        # Dveřmi
        ('dveYmi', 'dveřmi'),
        ('DveYmi', 'Dveřmi'),
        # Závěsná
        ('Závsná', 'Závěsná'),
        ('závsná', 'závěsná'),
        # Ely -> čely
        (' ely ', ' čely '),
        ('s ely', 's čely'),
    ]

    for old, new in post_replacements:
        result = result.replace(old, new)

    # Oprav skřín na konci řetězce
    if result.endswith('skřín'):
        result = result[:-5] + 'skříň'
    if result.endswith('Skřín'):
        result = result[:-5] + 'Skříň'

    return result


def translate_group_name(raw_text):
    """Přeloží název skupiny do správné češtiny"""
    if not raw_text:
        return 'Ostatní'

    # Vyčisti a přelož text
    text = clean_and_translate_text(raw_text)

    # Dodatečné opravy pro specifické případy
    specific_fixes = {
        'Skříňky spodní': 'Spodní skříňky',
        'Skříňky horní': 'Horní skříňky',
        'Skříňky spodní rohové': 'Spodní rohové skříňky',
        'Skříňky horní výklopné': 'Horní výklopné skříňky',
        'Skříňky horní rohové': 'Horní rohové skříňky',
    }

    if text in specific_fixes:
        return specific_fixes[text]

    return text


def create_cabinet_box(width, height, depth, cabinet_type='base'):
    """Vytvoří parametrickou geometrii skříňky"""
    w = width / 1000
    h = height / 1000
    d = depth / 1000
    t = 0.018

    vertices = []
    indices = []

    def add_panel(pos, size):
        x, y, z = pos
        pw, ph, pd = size
        base_idx = len(vertices)

        panel_verts = [
            [x, y, z], [x + pw, y, z], [x + pw, y + ph, z], [x, y + ph, z],
            [x, y, z + pd], [x + pw, y, z + pd], [x + pw, y + ph, z + pd], [x, y + ph, z + pd],
        ]
        vertices.extend(panel_verts)

        panel_indices = [
            0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6,
            4, 0, 3, 4, 3, 7, 1, 5, 6, 1, 6, 2,
            4, 5, 1, 4, 1, 0, 3, 2, 6, 3, 6, 7,
        ]
        indices.extend([i + base_idx for i in panel_indices])

    if cabinet_type == 'base':
        add_panel([0, 0, 0], [t, h, d])
        add_panel([w - t, 0, 0], [t, h, d])
        add_panel([t, 0, 0], [w - 2*t, t, d])
        add_panel([t, t, d - t], [w - 2*t, h - t, t])
    elif cabinet_type == 'wall':
        add_panel([0, 0, 0], [t, h, d])
        add_panel([w - t, 0, 0], [t, h, d])
        add_panel([t, 0, 0], [w - 2*t, t, d])
        add_panel([t, h - t, 0], [w - 2*t, t, d])
        add_panel([t, t, d - t], [w - 2*t, h - 2*t, t])
    elif cabinet_type == 'tall':
        add_panel([0, 0, 0], [t, h, d])
        add_panel([w - t, 0, 0], [t, h, d])
        add_panel([t, 0, 0], [w - 2*t, t, d])
        add_panel([t, h - t, 0], [w - 2*t, t, d])
        add_panel([t, t, d - t], [w - 2*t, h - 2*t, t])

    return {'vertices': vertices, 'indices': indices, 'type': 'parametric'}


def determine_cabinet_type(skupina_name, height):
    """Určí typ skříňky podle skupiny a výšky"""
    name_lower = (skupina_name or '').lower()

    if 'horn' in name_lower or 'wall' in name_lower or 'h ' in name_lower:
        return 'wall'
    elif 'vysok' in name_lower or 'tall' in name_lower or 'sloup' in name_lower:
        return 'tall'
    elif height and height > 1200:
        return 'tall'
    elif height and height < 500 and height > 100:
        return 'wall'
    else:
        return 'base'


def main():
    db_path = r'c:\Users\tomas\OneDrive\Apps\3D skrinky\sort.mdb'
    output_dir = r'c:\Users\tomas\OneDrive\Apps\3D skrinky\prototype\src\data'

    print("Načítám Oresi databázi...")
    db = AccessParser(db_path)

    kusovnik = db.parse_table('Kusovnik')
    sirky = db.parse_table('MatKusovnikSirka')
    skupiny = db.parse_table('SortSkupina')
    typy = db.parse_table('SortTyp')
    druhy = db.parse_table('SortDruh')

    # Mapa TypID -> Název značky (podle ID, protože text je poškozen)
    typ_id_to_brand = {
        1: 'Oresi',
        2: 'Livanza',
        3: 'Bauformat',
        4: 'Šatní skříně',
    }
    typ_map = {}
    for i in range(len(typy['TypID'])):
        typ_id = typy['TypID'][i]
        typ_map[typ_id] = typ_id_to_brand.get(typ_id, f'Značka {typ_id}')

    # Mapa DruhID -> info
    druh_map = {}
    for i in range(len(druhy['DruhID'])):
        druh_map[druhy['DruhID'][i]] = {
            'name': druhy['Nazov'][i],
            'typ_id': druhy['TypID'][i]
        }

    # Mapa SkupinaID -> info
    skupina_map = {}
    for i in range(len(skupiny['SkupinaID'])):
        skupina_map[skupiny['SkupinaID'][i]] = {
            'name': skupiny['Nazov'][i],
            'druh_id': skupiny['DruhID'][i],
            'typ_id': skupiny['TypID'][i]
        }

    # Skupiny které chceme (hlavní kuchyňské skříňky)
    target_keywords = [
        'skříňk', 'skrink', 'spodn', 'horn', 'vysok', 'rohov',
        'dřez', 'drez', 'přístroj', 'pristroj', ' u ', ' h ', ' s '
    ]

    # Filtruj skříňky
    cabinets = []
    models = {}

    for i in range(len(kusovnik['KusovnikID'])):
        if not kusovnik['Platnost'][i]:
            continue

        kid = kusovnik['KusovnikID'][i]
        nazov = kusovnik['Nazov'][i]
        kod = kusovnik['Kod'][i]
        vyska = kusovnik['VyskaMM'][i] or 720
        hlbka = kusovnik['HlbkaMM'][i] or 560
        typ_id = kusovnik['TypID'][i]
        skupina_id = kusovnik['SkupinaID'][i]
        druh_id = kusovnik['DruhID'][i]

        # Získej informace o značce a skupině
        brand = typ_map.get(typ_id, 'Neznámá')
        skupina_info = skupina_map.get(skupina_id, {})
        skupina_nazov_raw = skupina_info.get('name', '')
        # Přelož název skupiny do správné češtiny
        skupina_nazov = translate_group_name(skupina_nazov_raw)
        druh_info = druh_map.get(druh_id, {})
        druh_nazov = druh_info.get('name', '')

        # Filtruj - chceme pouze korpusy/skříňky, ne dvířka, úchytky atd.
        druh_lower = (druh_nazov or '').lower()
        if druh_lower in ['dvířka', 'dv\xedřka', 'uchytky', 'úchytky', 'liaty', 'lišty']:
            continue

        # Filtruj podle skupiny - hledáme skříňky
        skupina_lower = (skupina_nazov or '').lower()
        if not any(kw in skupina_lower for kw in target_keywords):
            # Pokud není v názvu skupiny, zkus druh
            if 'korpus' not in druh_lower and 'skříňk' not in druh_lower:
                continue

        # Přeskoč neplatné rozměry
        if vyska <= 0 or hlbka <= 0:
            continue
        if vyska < 100 or hlbka < 50:
            continue

        # Najdi šířky
        widths = []
        for j in range(len(sirky['KusovnikID'])):
            if sirky['KusovnikID'][j] == kid and sirky['Platnost'][j]:
                w = sirky['SirkaMM'][j]
                if w and w > 0:
                    widths.append(w)

        if not widths:
            widths = [600]

        # Urči typ skříňky
        cab_type = determine_cabinet_type(skupina_nazov, vyska)

        # Vytvoř záznam
        cabinet = {
            'id': kid,
            'name': nazov,
            'code': kod,
            'brand': brand,
            'brandId': typ_id,
            'group': skupina_nazov,
            'category': druh_nazov,
            'type': cab_type,
            'height': vyska,
            'depth': hlbka,
            'width': widths[0],
            'widths': sorted(set(widths))[:10],
        }

        cabinets.append(cabinet)

        # Vytvoř geometrii
        model_key = f"{cab_type}_{vyska}_{hlbka}"
        if model_key not in models:
            models[model_key] = create_cabinet_box(widths[0], vyska, hlbka, cab_type)

        cabinet['model_key'] = model_key

    print(f"Nalezeno {len(cabinets)} kuchyňských skříněk")

    # Statistiky podle značky
    brand_counts = {}
    for cab in cabinets:
        b = cab['brand']
        brand_counts[b] = brand_counts.get(b, 0) + 1

    print("\nPočty podle značky:")
    for b, count in sorted(brand_counts.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}x {b}")

    # Statistiky podle typu
    type_counts = {}
    for cab in cabinets:
        t = cab['type']
        type_counts[t] = type_counts.get(t, 0) + 1

    print("\nPočty podle typu:")
    for t, count in sorted(type_counts.items()):
        print(f"  {t}: {count}")

    # Značky pro export
    brands = [
        {'id': 1, 'name': 'Oresi', 'label': 'Oresi (Dolti Collection)'},
        {'id': 2, 'name': 'Livanza', 'label': 'Livanza'},
        {'id': 3, 'name': 'Bauformat', 'label': 'Bauformat'},
        {'id': 4, 'name': 'Šatní skříně', 'label': 'Šatní skříně'},
    ]

    # Export
    catalog = {
        'brands': brands,
        'cabinets': cabinets,
        'models': models
    }

    output_file = os.path.join(output_dir, 'catalog.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    print(f"\nUloženo do {output_file}")
    print(f"Celkem skříněk: {len(cabinets)}")
    print(f"Celkem modelů: {len(models)}")


if __name__ == '__main__':
    main()
