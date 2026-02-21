/**
 * WallSnapper - Přichytávání ke stěnám s automatickou rotací
 *
 * Detekuje blízkost ke stěnám a automaticky otočí skříňku správným směrem.
 * Stěny: Levá (X-), Pravá (X+), Zadní (Z-)
 *
 * VYLEPŠENO: Bere v úvahu aktuální rotaci a bounding box skříňky
 */

import { getBoundingBox } from '../BoundingBox.js'

export class WallSnapper {
  constructor(threshold = 0.2) {
    this.threshold = threshold // Default threshold
    this.baseDepth500Offset = 0.065 // Odsazení 65mm pro spodní skříňky hloubky 500mm
  }

  /**
   * Vypočítá offset od stěny pro danou skříňku
   * Spodní skříňky hloubky 500mm mají offset 65mm (pro pracovní desku)
   */
  _getWallOffset(cabinet) {
    if (cabinet.type === 'base' && cabinet.depth === 500) {
      return this.baseDepth500Offset
    }
    return 0
  }

  /**
   * @param {Object} current - { position: [x,y,z], rotation: number }
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Object} context - { room: { width, depth } }
   * @returns {Object} - { position, rotation, applied, strong }
   */
  snap(current, cabinet, context) {
    const { room } = context
    const [x, y, z] = current.position
    const currentRotation = current.rotation || 0
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000

    const roomW = room.width
    const roomD = room.depth

    // Offset od stěny pro spodní skříňky hloubky 500mm
    const wallOffset = this._getWallOffset(cabinet)

    // Vypočítej bounding box podle aktuální rotace
    const bb = this._getBoundingBox(x, z, width, depth, currentRotation)

    // Vzdálenosti hran bounding boxu ke stěnám
    const distBackEdgeToBackWall = Math.abs(bb.minZ - (-roomD / 2))
    const distLeftEdgeToLeftWall = Math.abs(bb.minX - (-roomW / 2))
    const distRightEdgeToRightWall = Math.abs(bb.maxX - (roomW / 2))

    // Detekuj blízkost - jakákoliv hrana blízko stěny
    const nearBackWall = distBackEdgeToBackWall < this.threshold
    const nearLeftWall = distLeftEdgeToLeftWall < this.threshold
    const nearRightWall = distRightEdgeToRightWall < this.threshold

    // Je daleko od zadní stěny? (pro boční stěny - musíme být dál od rohu)
    // Použij skutečnou hranu, ne origin
    const awayFromBackWall = bb.minZ > -roomD / 2 + depth + 0.1

    // Pro boční stěny: kontroluj jestli jsme blízko rohu zadní stěny
    const nearBackCorner = bb.minZ < -roomD / 2 + depth + 0.15

    // Priority: Zadní stěna má prioritu pokud jsme blízko rohu, jinak boční stěny

    // Pokud jsme blízko rohu a blízko zadní stěny - preferuj zadní
    if (nearBackWall && nearBackCorner) {
      return {
        position: [x, y, -roomD / 2 + wallOffset],
        rotation: 0,
        applied: true,
        strong: false  // NIKDY strong - vždy nech CabinetSnapper doladit X pozici
      }
    }

    // LEVÁ STĚNA (X-) - rotace +90° (skříňka zády k levé zdi)
    if (nearLeftWall && awayFromBackWall) {
      return {
        position: [-roomW / 2 + wallOffset, y, z],
        rotation: Math.PI / 2,
        applied: true,
        strong: false
      }
    }

    // PRAVÁ STĚNA (X+) - rotace -90°
    if (nearRightWall && awayFromBackWall) {
      return {
        position: [roomW / 2 - wallOffset, y, z],
        rotation: -Math.PI / 2,
        applied: true,
        strong: false
      }
    }

    // ZADNÍ STĚNA (Z-) - rotace 0°
    // Toto zachytí i rotované skříňky přibližující se k zadní stěně
    if (nearBackWall) {
      return {
        position: [x, y, -roomD / 2 + wallOffset],
        rotation: 0,
        applied: true,
        strong: false
      }
    }

    // Žádný snap
    return {
      ...current,
      applied: false
    }
  }

  /**
   * Vypočítá bounding box podle rotace
   * Deleguje na sdílený BoundingBox.js
   */
  _getBoundingBox(x, z, width, depth, rotation) {
    return getBoundingBox(x, z, width, depth, rotation)
  }

  /**
   * Vrátí všechny možné snap pointy pro vizualizaci
   */
  getSnapPoints(current, cabinet, context) {
    const { room } = context

    const points = []

    // Levá stěna line
    points.push({
      type: 'wall_left',
      position: [-room.width / 2, 0, 0],
      rotation: -Math.PI / 2
    })

    // Pravá stěna line
    points.push({
      type: 'wall_right',
      position: [room.width / 2, 0, 0],
      rotation: Math.PI / 2
    })

    // Zadní stěna line
    points.push({
      type: 'wall_back',
      position: [0, 0, -room.depth / 2],
      rotation: 0
    })

    return points
  }

  /**
   * Zjistí ke které stěně je skříňka nejblíže
   */
  getNearestWall(position, cabinet, room) {
    const [x, , z] = position
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000

    const distances = {
      left: Math.abs(x + room.width / 2),
      right: Math.abs((x + width) - room.width / 2),
      back: Math.abs(z + room.depth / 2),
      front: Math.abs((z + depth) - room.depth / 2)
    }

    const nearest = Object.entries(distances).reduce((min, [wall, dist]) => {
      return dist < min.distance ? { wall, distance: dist } : min
    }, { wall: null, distance: Infinity })

    return nearest
  }
}
