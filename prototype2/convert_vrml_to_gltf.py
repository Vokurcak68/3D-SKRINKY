#!/usr/bin/env python3
"""
Konverze VRML souborů na GLTF formát pro 3D kuchyňský plánovač.
Používá trimesh pro načtení a export 3D modelů.
"""

import os
import re
import json
import struct
import numpy as np
from pathlib import Path


def parse_vrml_geometry(vrml_content):
    """Parsuje VRML soubor a extrahuje geometrii"""

    # Najdi všechny Coordinate point bloky
    coord_pattern = r'Coordinate\s*\{\s*point\s*\[([\s\S]*?)\]'
    coord_matches = re.findall(coord_pattern, vrml_content)

    # Najdi všechny coordIndex bloky
    index_pattern = r'coordIndex\s*\[([\s\S]*?)\]'
    index_matches = re.findall(index_pattern, vrml_content)

    if not coord_matches or not index_matches:
        return None, None

    # Parsuj vertices
    vertices = []
    for coord_str in coord_matches:
        # Odstraň komentáře a čáry
        coord_str = re.sub(r'#.*', '', coord_str)
        # Parsuj čísla
        numbers = re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', coord_str)
        for i in range(0, len(numbers) - 2, 3):
            vertices.append([
                float(numbers[i]),
                float(numbers[i + 1]),
                float(numbers[i + 2])
            ])

    # Parsuj faces (trojúhelníky)
    faces = []
    for index_str in index_matches:
        index_str = re.sub(r'#.*', '', index_str)
        numbers = re.findall(r'-?\d+', index_str)

        current_face = []
        for num in numbers:
            idx = int(num)
            if idx == -1:
                # Konec face - triangulace pokud má víc než 3 vrcholy
                if len(current_face) >= 3:
                    # Fan triangulace
                    for i in range(1, len(current_face) - 1):
                        faces.append([current_face[0], current_face[i], current_face[i + 1]])
                current_face = []
            else:
                current_face.append(idx)

    return np.array(vertices, dtype=np.float32), np.array(faces, dtype=np.uint32)


def create_gltf(vertices, faces, name="model"):
    """Vytvoří GLTF 2.0 JSON strukturu s embedded binary daty"""

    if vertices is None or faces is None or len(vertices) == 0 or len(faces) == 0:
        return None

    # Normalizuj indices - ujisti se, že všechny indexy jsou v rozsahu
    max_index = len(vertices) - 1
    valid_faces = []
    for face in faces:
        if all(0 <= idx <= max_index for idx in face):
            valid_faces.append(face)

    if not valid_faces:
        return None

    faces = np.array(valid_faces, dtype=np.uint32)

    # Vypočítej normály pro každý vertex
    normals = np.zeros_like(vertices)
    for face in faces:
        v0, v1, v2 = vertices[face[0]], vertices[face[1]], vertices[face[2]]
        edge1 = v1 - v0
        edge2 = v2 - v0
        normal = np.cross(edge1, edge2)
        norm_length = np.linalg.norm(normal)
        if norm_length > 0:
            normal = normal / norm_length
        normals[face[0]] += normal
        normals[face[1]] += normal
        normals[face[2]] += normal

    # Normalizuj normály
    for i in range(len(normals)):
        norm_length = np.linalg.norm(normals[i])
        if norm_length > 0:
            normals[i] = normals[i] / norm_length

    normals = normals.astype(np.float32)

    # Vytvoř binary buffer
    indices_flat = faces.flatten().astype(np.uint16)

    # Padding pro zarovnání
    vertex_data = vertices.tobytes()
    normal_data = normals.tobytes()
    index_data = indices_flat.tobytes()

    # Zarovnání na 4 bajty
    def pad_to_4(data):
        padding = (4 - len(data) % 4) % 4
        return data + b'\x00' * padding

    vertex_data = pad_to_4(vertex_data)
    normal_data = pad_to_4(normal_data)
    index_data = pad_to_4(index_data)

    buffer_data = vertex_data + normal_data + index_data

    # Bounding box
    min_pos = vertices.min(axis=0).tolist()
    max_pos = vertices.max(axis=0).tolist()

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "VRML to GLTF Converter"
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{
            "mesh": 0,
            "name": name
        }],
        "meshes": [{
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "NORMAL": 1
                },
                "indices": 2,
                "material": 0
            }],
            "name": name
        }],
        "materials": [{
            "name": "default",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.9, 0.85, 0.75, 1.0],  # Světlé dřevo
                "metallicFactor": 0.0,
                "roughnessFactor": 0.7
            }
        }],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": len(vertices),
                "type": "VEC3",
                "min": min_pos,
                "max": max_pos
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": len(normals),
                "type": "VEC3"
            },
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5123,  # UNSIGNED_SHORT
                "count": len(indices_flat),
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": len(vertex_data),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_data),
                "byteLength": len(normal_data),
                "target": 34962  # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": len(vertex_data) + len(normal_data),
                "byteLength": len(index_data),
                "target": 34963  # ELEMENT_ARRAY_BUFFER
            }
        ],
        "buffers": [{
            "byteLength": len(buffer_data)
        }]
    }

    return gltf, buffer_data


def save_glb(gltf_json, buffer_data, output_path):
    """Uloží GLTF jako binární GLB soubor"""

    json_str = json.dumps(gltf_json, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')

    # Padding JSON na 4 bajty
    json_padding = (4 - len(json_bytes) % 4) % 4
    json_bytes += b' ' * json_padding

    # Padding binary na 4 bajty
    bin_padding = (4 - len(buffer_data) % 4) % 4
    buffer_data += b'\x00' * bin_padding

    # GLB header
    total_length = 12 + 8 + len(json_bytes) + 8 + len(buffer_data)

    with open(output_path, 'wb') as f:
        # Header
        f.write(b'glTF')  # magic
        f.write(struct.pack('<I', 2))  # version
        f.write(struct.pack('<I', total_length))  # length

        # JSON chunk
        f.write(struct.pack('<I', len(json_bytes)))  # chunk length
        f.write(b'JSON')  # chunk type
        f.write(json_bytes)

        # Binary chunk
        f.write(struct.pack('<I', len(buffer_data)))  # chunk length
        f.write(b'BIN\x00')  # chunk type
        f.write(buffer_data)


def convert_vrml_to_gltf(vrml_path, output_dir):
    """Konvertuje VRML soubor na GLTF/GLB"""

    vrml_path = Path(vrml_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Zpracovávám: {vrml_path.name}")

    try:
        # Zkus různá kódování
        content = None
        for encoding in ['utf-8', 'latin-1', 'cp1250']:
            try:
                with open(vrml_path, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            print(f"  Chyba: Nelze přečíst soubor")
            return False

        vertices, faces = parse_vrml_geometry(content)

        if vertices is None or len(vertices) == 0:
            print(f"  Chyba: Žádná geometrie nalezena")
            return False

        print(f"  Nalezeno {len(vertices)} vertices, {len(faces)} faces")

        # Vytvoř GLTF
        name = vrml_path.stem.replace('_geo', '').replace('_main', '')
        gltf, buffer_data = create_gltf(vertices, faces, name)

        if gltf is None:
            print(f"  Chyba: Nelze vytvořit GLTF")
            return False

        # Ulož jako GLB
        output_path = output_dir / f"{name}.glb"
        save_glb(gltf, buffer_data, output_path)

        print(f"  Uloženo: {output_path.name}")
        return True

    except Exception as e:
        print(f"  Chyba: {e}")
        return False


def main():
    """Hlavní funkce - konvertuje všechny VRML soubory"""

    base_dir = Path(__file__).parent.parent
    vrml_dir = base_dir / "export" / "vrml"
    output_dir = base_dir / "prototype" / "public" / "models"

    if not vrml_dir.exists():
        print(f"VRML adresář neexistuje: {vrml_dir}")
        return

    vrml_files = list(vrml_dir.glob("*.wrl"))

    if not vrml_files:
        print("Žádné VRML soubory nenalezeny")
        return

    print(f"Nalezeno {len(vrml_files)} VRML souborů")
    print(f"Výstupní adresář: {output_dir}")
    print("-" * 50)

    success_count = 0
    for vrml_file in vrml_files:
        if convert_vrml_to_gltf(vrml_file, output_dir):
            success_count += 1

    print("-" * 50)
    print(f"Úspěšně konvertováno: {success_count}/{len(vrml_files)}")


if __name__ == "__main__":
    main()
