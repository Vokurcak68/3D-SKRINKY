/**
 * BoundingBox - Single Source of Truth pro výpočet bounding boxu skříněk
 *
 * Všechny soubory v placement systému MUSÍ používat tyto funkce
 * místo vlastních výpočtů bounding boxu.
 *
 * Koordinátový systém:
 *   - Origin = střed místnosti
 *   - X: levá (-) → pravá (+)
 *   - Z: zadní (-) → přední (+)
 *   - Y: nahoru (+)
 *
 * Rotace (kolem Y osy, Three.js LEFT-HANDED):
 *   - 0° = zadní stěna (skříňka se rozšiřuje +X, +Z)
 *   - +90° (π/2) = levá stěna (skříňka se rozšiřuje +X, -Z)
 *   - -90° (-π/2) = pravá stěna (skříňka se rozšiřuje -X, +Z)
 *   - 180° (π) = přední stěna (skříňka se rozšiřuje -X, -Z)
 */

const ROTATION_EPSILON = 0.1

/**
 * Vypočítá AABB bounding box skříňky podle rotace
 * @param {number} x - X pozice originu (v metrech)
 * @param {number} z - Z pozice originu (v metrech)
 * @param {number} width - Šířka v metrech
 * @param {number} depth - Hloubka v metrech
 * @param {number} rotation - Rotace v radiánech
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function getBoundingBox(x, z, width, depth, rotation) {
  const rot = normalizeRotation(rotation)

  if (Math.abs(rot) < ROTATION_EPSILON) {
    // 0° rotace (zadní stěna): standardní orientace
    return { minX: x, maxX: x + width, minZ: z, maxZ: z + depth }
  }

  if (Math.abs(rot - Math.PI / 2) < ROTATION_EPSILON) {
    // +90° rotace (levá stěna): +X, -Z
    return { minX: x, maxX: x + depth, minZ: z - width, maxZ: z }
  }

  if (Math.abs(rot + Math.PI / 2) < ROTATION_EPSILON) {
    // -90° rotace (pravá stěna): -X, +Z
    return { minX: x - depth, maxX: x, minZ: z, maxZ: z + width }
  }

  if (Math.abs(Math.abs(rot) - Math.PI) < ROTATION_EPSILON) {
    // 180° rotace (přední stěna): -X, -Z
    return { minX: x - width, maxX: x, minZ: z - depth, maxZ: z }
  }

  // Obecná rotace - použij cos/sin pro přesný BB
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const corners = [
    [x, z],
    [x + width * cos + 0 * sin, z - width * sin + 0 * cos],
    [x + 0 * cos + depth * sin, z - 0 * sin + depth * cos],
    [x + width * cos + depth * sin, z - width * sin + depth * cos]
  ]

  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const [cx, cz] of corners) {
    minX = Math.min(minX, cx)
    maxX = Math.max(maxX, cx)
    minZ = Math.min(minZ, cz)
    maxZ = Math.max(maxZ, cz)
  }

  return { minX, maxX, minZ, maxZ }
}

/**
 * Vypočítá bounding box z cabinet objektu
 * @param {Object} cabinet - { position: [x,y,z], width, depth, rotation }
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function getCabinetBoundingBox(cabinet) {
  const x = cabinet.position[0]
  const z = cabinet.position[2]
  const width = (cabinet.width || 600) / 1000
  const depth = (cabinet.depth || 560) / 1000
  const rotation = cabinet.rotation || 0
  return getBoundingBox(x, z, width, depth, rotation)
}

/**
 * Vrátí efektivní rozměry ve world space (po rotaci)
 * @param {number} width - Šířka v metrech
 * @param {number} depth - Hloubka v metrech
 * @param {number} rotation - Rotace v radiánech
 * @returns {{ effectiveW: number, effectiveD: number }}
 */
export function getEffectiveDimensions(width, depth, rotation) {
  const isRotated = Math.abs(rotation) > ROTATION_EPSILON &&
                    Math.abs(Math.abs(rotation) - Math.PI) > ROTATION_EPSILON
  return {
    effectiveW: isRotated ? depth : width,
    effectiveD: isRotated ? width : depth
  }
}

/**
 * Vrátí stěnu podle rotace
 * @param {number} rotation - Rotace v radiánech
 * @returns {'back' | 'left' | 'right' | 'front' | 'unknown'}
 */
export function getWallFromRotation(rotation) {
  const rot = normalizeRotation(rotation)
  if (Math.abs(rot) < ROTATION_EPSILON) return 'back'
  if (Math.abs(rot - Math.PI / 2) < ROTATION_EPSILON) return 'left'
  if (Math.abs(rot + Math.PI / 2) < ROTATION_EPSILON) return 'right'
  if (Math.abs(Math.abs(rot) - Math.PI) < ROTATION_EPSILON) return 'front'
  return 'unknown'
}

/**
 * Vrátí abstrakci os pro danou stěnu
 * Umožňuje wall-agnostický kód (místo if/else pro každou stěnu)
 *
 * @param {number} rotation - Rotace v radiánech
 * @returns {{ along: 'x'|'z', into: 'z'|'x', alongSign: 1|-1, intoSign: 1|-1 }}
 *
 * along = osa podél stěny (kde se skříňky řadí)
 * into = osa kolmo na stěnu (do místnosti)
 * alongSign = směr řazení podél stěny (1 = kladný, -1 = záporný)
 * intoSign = směr do místnosti
 */
export function getWallAxis(rotation) {
  const wall = getWallFromRotation(rotation)
  switch (wall) {
    case 'back':
      return { along: 'x', into: 'z', alongSign: 1, intoSign: 1 }
    case 'left':
      return { along: 'z', into: 'x', alongSign: -1, intoSign: 1 }
    case 'right':
      return { along: 'z', into: 'x', alongSign: 1, intoSign: -1 }
    case 'front':
      return { along: 'x', into: 'z', alongSign: -1, intoSign: -1 }
    default:
      return { along: 'x', into: 'z', alongSign: 1, intoSign: 1 }
  }
}

/**
 * Vrátí start a end pozici skříňky podél stěny (along-wall axis)
 * Nezávislé na tom, která stěna je vybraná
 *
 * @param {Object} cabinet - Cabinet objekt
 * @returns {{ start: number, end: number }} - start < end vždy
 */
export function getAlongWallSpan(cabinet) {
  const bb = getCabinetBoundingBox(cabinet)
  const axis = getWallAxis(cabinet.rotation || 0)

  if (axis.along === 'x') {
    return { start: bb.minX, end: bb.maxX }
  } else {
    return { start: bb.minZ, end: bb.maxZ }
  }
}

/**
 * Boundary clamp - omezí pozici tak, aby BB zůstal v místnosti
 * @param {number} x - X pozice
 * @param {number} z - Z pozice
 * @param {number} width - Šířka v metrech
 * @param {number} depth - Hloubka v metrech
 * @param {number} rotation - Rotace v radiánech
 * @param {{ width: number, depth: number }} room - Rozměry místnosti v metrech
 * @returns {{ x: number, z: number }}
 */
export function clampToRoom(x, z, width, depth, rotation, room) {
  const bb = getBoundingBox(x, z, width, depth, rotation)

  let dx = 0, dz = 0

  if (bb.minX < -room.width / 2) dx = -room.width / 2 - bb.minX
  if (bb.maxX > room.width / 2) dx = room.width / 2 - bb.maxX
  if (bb.minZ < -room.depth / 2) dz = -room.depth / 2 - bb.minZ
  if (bb.maxZ > room.depth / 2) dz = room.depth / 2 - bb.maxZ

  return { x: x + dx, z: z + dz }
}

/**
 * AABB overlap test (s tolerancí)
 * @param {{ minX, maxX, minZ, maxZ }} bb1
 * @param {{ minX, maxX, minZ, maxZ }} bb2
 * @param {number} epsilon - Tolerance (default 2mm)
 * @returns {boolean}
 */
export function bbOverlap(bb1, bb2, epsilon = 0.002) {
  return !(
    bb1.maxX <= bb2.minX + epsilon ||
    bb1.minX >= bb2.maxX - epsilon ||
    bb1.maxZ <= bb2.minZ + epsilon ||
    bb1.minZ >= bb2.maxZ - epsilon
  )
}

/**
 * Y-axis overlap test pro skříňky
 * @param {number} y1 - Y pozice 1. skříňky
 * @param {number} h1 - Výška 1. skříňky v metrech
 * @param {number} y2 - Y pozice 2. skříňky
 * @param {number} h2 - Výška 2. skříňky v metrech
 * @param {number} epsilon - Tolerance (default 1cm)
 * @returns {boolean}
 */
export function yOverlap(y1, h1, y2, h2, epsilon = 0.01) {
  return !(y1 + h1 <= y2 + epsilon || y1 >= y2 + h2 - epsilon)
}

/**
 * Normalizuje rotaci do rozsahu [-π, π]
 */
function normalizeRotation(rotation) {
  let r = rotation || 0
  while (r > Math.PI) r -= 2 * Math.PI
  while (r < -Math.PI) r += 2 * Math.PI
  return r
}
