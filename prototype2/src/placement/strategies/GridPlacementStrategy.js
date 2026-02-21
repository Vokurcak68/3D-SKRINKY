/**
 * GridPlacementStrategy - Umístění do pravidelné mřížky
 *
 * Umisťuje skříňky do pravidelného gridu s pevnými rozestupy.
 * Užitečné pro symetrické layouts nebo showroomy.
 */

export class GridPlacementStrategy {
  constructor(gridSpacing = 0.1) {
    this.gridSpacing = gridSpacing // Mezera mezi skříňkami
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
    const y = this._getYForType(type)

    // Filtruj skříňky stejné úrovně
    const sameLevel = this._filterSameLevel(existingCabinets, type)

    // Najdi obsazená grid místa
    const occupiedCells = this._getOccupiedCells(sameLevel, room)

    // Najdi první volnou buňku
    const freeCell = this._findFreeCell(occupiedCells, width, depth, room)

    if (freeCell) {
      return {
        position: [freeCell.x, y, freeCell.z],
        rotation: 0
      }
    }

    // Fallback - první pozice
    return {
      position: [-room.width / 2, y, -room.depth / 2 + depth],
      rotation: 0
    }
  }

  // ============================================================================
  // PRIVATE METHODS
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
    })
  }

  /**
   * Převede skříňky na grid cells
   */
  _getOccupiedCells(cabinets, room) {
    const occupied = new Set()

    cabinets.forEach(cab => {
      const x = cab.position[0]
      const z = cab.position[2]
      const w = (cab.width || 600) / 1000
      const d = (cab.depth || 560) / 1000

      // Zaokrouhli na grid
      const cellX = Math.round((x + room.width / 2) / (w + this.gridSpacing))
      const cellZ = Math.round((z + room.depth / 2) / (d + this.gridSpacing))

      occupied.add(`${cellX},${cellZ}`)
    })

    return occupied
  }

  /**
   * Najde první volnou grid cell
   */
  _findFreeCell(occupiedCells, width, depth, room) {
    const cellWidth = width + this.gridSpacing
    const cellDepth = depth + this.gridSpacing

    const cols = Math.floor(room.width / cellWidth)
    const rows = Math.floor(room.depth / cellDepth)

    // Hledej row by row, column by column
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = `${col},${row}`

        if (!occupiedCells.has(key)) {
          // Volná buňka - převeď na world coordinates
          const x = -room.width / 2 + col * cellWidth
          const z = -room.depth / 2 + row * cellDepth + depth // +depth pro správnou pozici

          return { x, z, col, row }
        }
      }
    }

    return null
  }
}
