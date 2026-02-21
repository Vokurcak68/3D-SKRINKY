/**
 * CollisionDetector - Detekce kolizí a validace umístění skříněk
 *
 * Kontroluje:
 * - Kolize s ostatními skříňkami
 * - Boundary check (zda je v místnosti)
 * - Fyzikální validitu (např. wall cabinets musí být na správné výšce)
 *
 * Použití:
 *   const detector = new CollisionDetector(spatialGrid, roomConfig)
 *   const result = detector.canPlace(cabinet, position, rotation)
 *   if (!result.valid) console.log(result.reason)
 */

import { getBoundingBox, clampToRoom, yOverlap as bbYOverlap } from './BoundingBox.js'

export class CollisionDetector {
  /**
   * @param {SpatialGrid} spatialGrid - Instance prostorového indexu
   * @param {Object} roomConfig - Konfigurace místnosti
   * @param {number} roomConfig.width - Šířka v metrech
   * @param {number} roomConfig.depth - Hloubka v metrech
   * @param {number} roomConfig.height - Výška v metrech
   */
  constructor(spatialGrid, roomConfig) {
    this.spatial = spatialGrid
    this.room = roomConfig
  }

  /**
   * Hlavní metoda - kontroluje zda lze umístit skříňku
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Array<number>} position - [x, y, z] pozice v metrech
   * @param {number} rotation - Rotace v radiánech
   * @param {string} excludeId - ID skříňky k vyloučení (pro update existující)
   * @returns {Object} - { valid: boolean, reason?: string, collisions?: Array }
   */
  canPlace(cabinet, position, rotation = 0, excludeId = null) {
    const [x, y, z] = position
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const height = (cabinet.height || 720) / 1000

    console.log('🔍 CollisionDetector.canPlace:', {
      position: [x, y, z],
      dimensions: [width, depth, height],
      rotation,
      excludeId,
      spatialGridStats: this.spatial.getStats()
    })

    // 1. Boundary check - musí být v místnosti
    const boundaryCheck = this.checkBoundaries(x, y, z, width, height, depth, rotation)
    if (!boundaryCheck.valid) {
      console.log('❌ Boundary check failed:', boundaryCheck)
      return boundaryCheck
    }

    // 2. Collision check - nesmí se překrývat s jinými skříňkami
    const potentialCollisions = this.spatial.checkCollisions(x, z, width, depth, rotation, excludeId)

    console.log('  Potential collisions:', potentialCollisions.length, potentialCollisions.map(c => ({
      id: c.instanceId,
      pos: c.position,
      dims: [c.width/1000, c.depth/1000, c.height/1000]
    })))

    // Filtruj pouze kolize, které se také překrývají ve výšce (Y axis)
    const collisions = potentialCollisions.filter(other => {
      const otherY = other.position[1]
      const otherH = (other.height || 720) / 1000
      return bbYOverlap(y, height, otherY, otherH)
    })

    console.log('  Real collisions after Y-filter:', collisions.length)

    if (collisions.length > 0) {
      console.log('❌ Collision detected!')
      return {
        valid: false,
        reason: 'collision',
        collisions: collisions,
        message: `Koliduje s ${collisions.length} skříňkami`
      }
    }

    console.log('✅ No collision - placement is valid')

    // 3. Type-specific validation
    const typeCheck = this.checkTypeSpecific(cabinet, y)
    if (!typeCheck.valid) {
      return typeCheck
    }

    // Vše OK
    return { valid: true }
  }

  /**
   * Kontrola zda je skříňka v rámci místnosti
   * Používá sdílený getBoundingBox z BoundingBox.js
   */
  checkBoundaries(x, y, z, width, height, depth, rotation = 0) {
    const roomW = this.room.width
    const roomD = this.room.depth
    const roomH = this.room.height

    // Vypočítej skutečný bounding box pomocí sdílené funkce
    const bb = getBoundingBox(x, z, width, depth, rotation)

    // X boundaries (s tolerancí 1mm pro floating point)
    const tolerance = 0.001
    if (bb.minX < -roomW / 2 - tolerance || bb.maxX > roomW / 2 + tolerance) {
      return {
        valid: false,
        reason: 'out_of_bounds_x',
        message: 'Skříňka přesahuje hranice místnosti (X osa)'
      }
    }

    // Z boundaries (s tolerancí 1mm pro floating point)
    if (bb.minZ < -roomD / 2 - tolerance || bb.maxZ > roomD / 2 + tolerance) {
      return {
        valid: false,
        reason: 'out_of_bounds_z',
        message: 'Skříňka přesahuje hranice místnosti (Z osa)'
      }
    }

    // Y boundaries
    if (y < 0 || y + height > roomH) {
      return {
        valid: false,
        reason: 'out_of_bounds_y',
        message: 'Skříňka přesahuje výšku místnosti'
      }
    }

    return { valid: true }
  }

  /**
   * Type-specific validace
   */
  checkTypeSpecific(cabinet, y) {
    const type = cabinet.type || 'base'

    // Wall cabinets musí být ve správné výšce
    if (type === 'wall') {
      if (y < 1.0) {
        return {
          valid: false,
          reason: 'invalid_wall_height',
          message: 'Horní skříňky musí být min. 1m nad zemí'
        }
      }
      if (y > 1.8) {
        return {
          valid: false,
          reason: 'invalid_wall_height',
          message: 'Horní skříňky nesmí být výše než 1.8m'
        }
      }
    }

    // Base a tall cabinets musí být na zemi
    if (type === 'base' || type === 'tall') {
      if (Math.abs(y) > 0.01) {
        return {
          valid: false,
          reason: 'invalid_base_height',
          message: 'Spodní skříňky musí stát na zemi'
        }
      }
    }

    return { valid: true }
  }

  /**
   * Najde nejbližší validní pozici k dané pozici
   * Užitečné pro auto-korekci nevalidního umístění
   */
  findNearestValidPosition(cabinet, invalidPosition, rotation = 0) {
    const [x, y, z] = invalidPosition
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000

    // Zkus malé offsety okolo původní pozice
    const offsets = [
      [0, 0],      // Original
      [0.05, 0],   // Doprava
      [-0.05, 0],  // Doleva
      [0, 0.05],   // Dopředu
      [0, -0.05],  // Dozadu
      [0.1, 0],
      [-0.1, 0],
      [0, 0.1],
      [0, -0.1],
      [0.05, 0.05],
      [-0.05, -0.05],
      [0.05, -0.05],
      [-0.05, 0.05]
    ]

    for (const [dx, dz] of offsets) {
      const testPos = [x + dx, y, z + dz]
      const result = this.canPlace(cabinet, testPos, rotation)
      if (result.valid) {
        return { position: testPos, rotation }
      }
    }

    // Pokud nenajdeme žádnou validní pozici, vrať null
    return null
  }

  /**
   * Kontrola zda skříňka "leží" na worktop/countertop jiné skříňky
   * (pro budoucí implementaci stackování)
   */
  isOnTop(cabinet, position) {
    const [x, y, z] = position
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000

    // Najdi skříňky přímo pod
    const below = this.spatial.getNearby(x + width/2, z + depth/2, Math.max(width, depth))
      .filter(other => {
        const otherY = other.position[1]
        const otherH = (other.height || 720) / 1000
        const otherTop = otherY + otherH

        // Je y pozice této skříňky na vrcholu jiné?
        return Math.abs(y - otherTop) < 0.05 // 5cm tolerance
      })

    return below.length > 0
  }

  /**
   * Najde "gap" (mezeru) mezi dvěma skříňkami
   * Užitečné pro smart placement
   */
  findGaps(type, minGapSize = 0.3) {
    const gaps = []

    // Najdi všechny skříňky daného typu
    const cabinets = Array.from(this.spatial.cabinetCells.keys())
      .map(id => {
        // Získej skříňku ze spatial gridu (workaround - potřebovali bychom reference)
        // Pro teď vrátíme pouze prázdný array
        return null
      })
      .filter(c => c && c.type === type)

    // TODO: Implementovat gap detection
    // Vyžaduje seřazení skříněk podle pozice a detekci mezer

    return gaps
  }

  /**
   * Validuje celý layout (všechny skříňky)
   * Vrací seznam všech problémů
   */
  validateLayout(cabinets) {
    const issues = []

    cabinets.forEach((cabinet, index) => {
      const result = this.canPlace(
        cabinet,
        cabinet.position,
        cabinet.rotation || 0,
        cabinet.instanceId
      )

      if (!result.valid) {
        issues.push({
          cabinetIndex: index,
          cabinetId: cabinet.instanceId,
          issue: result.reason,
          message: result.message
        })
      }
    })

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Vypočítá "collision score" - jak moc skříňka koliduje
   * 0 = žádná kolize, vyšší číslo = větší překryv
   */
  getCollisionScore(x, z, width, depth, rotation = 0, excludeId = null) {
    const collisions = this.spatial.checkCollisions(x, z, width, depth, rotation, excludeId)

    if (collisions.length === 0) return 0

    // Spočítej celkovou plochu překryvu
    let totalOverlap = 0
    const isRotated = Math.abs(rotation) > 0.1
    const myW = isRotated ? depth : width
    const myD = isRotated ? width : depth

    collisions.forEach(other => {
      const otherX = other.position[0]
      const otherZ = other.position[2]
      const otherW = (other.width || 600) / 1000
      const otherD = (other.depth || 560) / 1000

      // Vypočítej překryv v X a Z
      const overlapX = Math.max(0, Math.min(x + myW, otherX + otherW) - Math.max(x, otherX))
      const overlapZ = Math.max(0, Math.min(z + myD, otherZ + otherD) - Math.max(z, otherZ))

      totalOverlap += overlapX * overlapZ
    })

    return totalOverlap
  }

  /**
   * Unified placement flow: snap → clamp → validate
   *
   * Toto je HLAVNÍ metoda pro validaci a korekci umístění.
   * Volá se z Cabinet3D (drag), store.js (drop), a SmartPlacementStrategy.
   *
   * @param {Object} cabinet - { width, depth, height, type }
   * @param {Array<number>} position - [x, y, z]
   * @param {number} rotation - Rotace v radiánech
   * @param {string|null} excludeId - ID skříňky k vyloučení (pro drag update)
   * @param {Object} options - { snap: boolean, snapSystem: SnapSystem, snapContext: Object }
   * @returns {{ position: [x,y,z], rotation: number, valid: boolean, snapped: boolean, collisions: Array }}
   */
  checkPlacement(cabinet, position, rotation = 0, excludeId = null, options = {}) {
    const [x, y, z] = position
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const height = (cabinet.height || 720) / 1000

    let finalX = x
    let finalZ = z
    let finalRotation = rotation
    let snapped = false

    // 1. SNAP (pokud povoleno a existuje snapSystem)
    if (options.snap && options.snapSystem) {
      const snapResult = options.snapSystem.snap(
        { position: [finalX, y, finalZ], rotation: finalRotation },
        cabinet,
        options.snapContext || {}
      )
      if (snapResult.applied) {
        finalX = snapResult.position[0]
        finalZ = snapResult.position[2]
        finalRotation = snapResult.rotation
        snapped = true
      }
    }

    // 2. BOUNDARY CLAMP
    const clamped = clampToRoom(finalX, finalZ, width, depth, finalRotation, this.room)
    finalX = clamped.x
    finalZ = clamped.z

    // 3. COLLISION CHECK
    const potentialCollisions = this.spatial.checkCollisions(finalX, finalZ, width, depth, finalRotation, excludeId)
    const realCollisions = potentialCollisions.filter(other => {
      const otherY = other.position[1]
      const otherH = (other.height || 720) / 1000
      return bbYOverlap(y, height, otherY, otherH)
    })

    return {
      position: [finalX, y, finalZ],
      rotation: finalRotation,
      valid: realCollisions.length === 0,
      snapped,
      collisions: realCollisions
    }
  }

  /**
   * Update room konfigurace
   */
  updateRoom(roomConfig) {
    this.room = roomConfig
  }
}
