/**
 * LinearPlacementStrategy - Jednoduché umísťování v přímé řadě
 *
 * Umisťuje skříňky jedna vedle druhé v přímé linii podél zadní stěny.
 * Nejjednodušší strategie - žádné mezery, žádné složité hledání.
 */

export class LinearPlacementStrategy {
  constructor() {
    // Offset od stěny pro spodní skříňky hloubky 500mm
    this.baseDepth500Offset = 0.065 // 65mm
  }

  /**
   * Vypočítá offset od stěny pro danou skříňku
   */
  _getWallOffset(cabinet) {
    if (cabinet.type === 'base' && cabinet.depth === 500) {
      return this.baseDepth500Offset
    }
    return 0
  }

  /**
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Array} existingCabinets - Existující skříňky
   * @param {Object} room - { width, depth, height } v metrech
   * @returns {Object} - { position: [x,y,z], rotation: number }
   */
  place(cabinet, existingCabinets, room) {
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const type = cabinet.type || 'base'
    const wallOffset = this._getWallOffset(cabinet)

    // Y pozice podle typu
    const y = this._getYForType(type)

    // Filtruj skříňky stejné úrovně
    const sameLevel = this._filterSameLevel(existingCabinets, type)

    // Pokud žádné, začni v levém rohu
    if (sameLevel.length === 0) {
      return {
        position: this._getStartPosition(room, depth, y, wallOffset),
        rotation: 0
      }
    }

    // Najdi nejpravější skříňku (nejvyšší X + width)
    const rightmost = this._findRightmost(sameLevel)

    const nextX = rightmost.x + rightmost.width

    // Zkontroluj zda se vejde
    // DŮLEŽITÉ: Z pozice podle offsetu NOVÉ skříňky, ne předchozí!
    if (nextX + width <= room.width / 2) {
      return {
        position: [nextX, y, -room.depth / 2 + wallOffset],
        rotation: 0
      }
    }

    // Nevejde se - vrať pozici uprostřed (fallback)
    return {
      position: [0, y, -room.depth / 2 + wallOffset],
      rotation: 0
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  _getYForType(type) {
    if (type === 'wall') return 1.4
    if (type === 'worktop') return 0.72
    return 0
  }

  _filterSameLevel(cabinets, type) {
    return cabinets.filter(c => {
      if (type === 'wall') {
        return c.type === 'wall'
      } else {
        return c.type === 'base' || c.type === 'tall' || !c.type
      }
    }).filter(c => Math.abs(c.rotation || 0) < 0.1) // Pouze nerotované
  }

  _getStartPosition(room, depth, y, wallOffset = 0) {
    return [
      -room.width / 2,
      y,
      -room.depth / 2 + wallOffset
    ]
  }

  _findRightmost(cabinets) {
    let rightmost = null
    let maxRight = -Infinity

    cabinets.forEach(cab => {
      const x = cab.position[0]
      const w = (cab.width || 600) / 1000
      const right = x + w

      if (right > maxRight) {
        maxRight = right
        rightmost = {
          x,
          width: w,
          z: cab.position[2]
        }
      }
    })

    return rightmost
  }
}
