/**
 * SpatialGrid - Prostorová indexace pro rychlé vyhledávání a collision detection
 *
 * Rozdělí prostor na buňky (grid cells) a přiřadí každou skříňku do příslušných buněk.
 * Díky tomu můžeme najít sousední skříňky v O(1) čase místo O(n).
 *
 * Použití:
 *   const grid = new SpatialGrid(4.0, 3.0, 0.5) // roomW, roomD, cellSize
 *   grid.add(cabinet)
 *   const nearby = grid.getNearby(x, z, radius)
 *   const collides = grid.checkCollision(x, z, width, depth)
 */

import { getBoundingBox, bbOverlap } from './BoundingBox.js'

export class SpatialGrid {
  /**
   * @param {number} roomWidth - Šířka místnosti v metrech
   * @param {number} roomDepth - Hloubka místnosti v metrech
   * @param {number} cellSize - Velikost buňky v metrech (default 0.5m = 50cm)
   */
  constructor(roomWidth, roomDepth, cellSize = 0.5) {
    this.roomWidth = roomWidth
    this.roomDepth = roomDepth
    this.cellSize = cellSize

    // Grid storage - Map<cellKey, Set<cabinet>>
    this.grid = new Map()

    // Lookup pro rychlé odstranění - Map<instanceId, Set<cellKeys>>
    this.cabinetCells = new Map()

    // Počet buněk v každém směru
    this.gridCols = Math.ceil(roomWidth / cellSize)
    this.gridRows = Math.ceil(roomDepth / cellSize)
  }

  /**
   * Přidá skříňku do gridu
   * @param {Object} cabinet - Skříňka s position, width, depth, rotation
   */
  add(cabinet) {
    if (!cabinet.instanceId) {
      console.warn('SpatialGrid.add: cabinet missing instanceId')
      return
    }

    // Najdi všechny buňky, které skříňka obsazuje
    const cells = this._getCellsForCabinet(cabinet)
    const cellKeys = new Set()

    cells.forEach(cellKey => {
      // Přidej do gridu
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, new Set())
      }
      this.grid.get(cellKey).add(cabinet)
      cellKeys.add(cellKey)
    })

    // Ulož pro rychlé odstranění
    this.cabinetCells.set(cabinet.instanceId, cellKeys)
  }

  /**
   * Odstraní skříňku z gridu
   * @param {string|Object} cabinetOrId - Skříňka nebo její instanceId
   */
  remove(cabinetOrId) {
    let instanceId = typeof cabinetOrId === 'string'
      ? cabinetOrId
      : cabinetOrId?.instanceId

    if (!instanceId) {
      console.warn('SpatialGrid.remove: missing instanceId', cabinetOrId)
      return
    }

    let cellKeys = this.cabinetCells.get(instanceId)

    // BUGFIX: Pokud nenalezeno, zkus najít s konverzí typu (number vs string)
    if (!cellKeys) {
      // Zkus najít klíč s odpovídající hodnotou po konverzi na string
      for (const [key, value] of this.cabinetCells.entries()) {
        if (String(key) === String(instanceId)) {
          console.log('SpatialGrid.remove: found with type conversion', { original: instanceId, found: key })
          instanceId = key  // Použij skutečný klíč
          cellKeys = value
          break
        }
      }
    }

    if (!cellKeys) {
      console.warn('SpatialGrid.remove: cabinet not found in grid:', instanceId, 'Grid has:', this.cabinetCells.size, 'cabinets')
      return
    }

    console.log('SpatialGrid.remove: removing cabinet', instanceId, 'from', cellKeys.size, 'cells')

    // Odeber ze všech buněk
    cellKeys.forEach(cellKey => {
      const cell = this.grid.get(cellKey)
      if (cell) {
        // DŮLEŽITÉ: Odstraň VŠECHNY kopie s tímto instanceId (ne jen první!)
        // Může být více referencí na stejnou skříňku pokud se někde pokazil update
        for (const cab of cell) {
          if (cab.instanceId === instanceId) {
            cell.delete(cab)
            // NEPOUŽÍVEJ break - pokračuj a odstraň všechny kopie!
          }
        }
        // Vyčisti prázdné buňky
        if (cell.size === 0) {
          this.grid.delete(cellKey)
        }
      }
    })

    this.cabinetCells.delete(instanceId)
    console.log('SpatialGrid.remove: successfully removed cabinet', instanceId, 'Grid now has:', this.cabinetCells.size, 'cabinets')
  }

  /**
   * Aktualizuje pozici skříňky (remove + add)
   * @param {Object} cabinet - Aktualizovaná skříňka
   */
  update(cabinet) {
    this.remove(cabinet.instanceId)
    this.add(cabinet)
  }

  /**
   * Najde skříňky v okolí dané pozice
   * @param {number} x - X pozice v metrech
   * @param {number} z - Z pozice v metrech
   * @param {number} radius - Poloměr hledání v metrech
   * @returns {Array<Object>} - Array skříněk v okolí
   */
  getNearby(x, z, radius = 1.0) {
    const cells = this._getCellsInRadius(x, z, radius)
    const nearby = new Set()

    cells.forEach(cellKey => {
      const cell = this.grid.get(cellKey)
      if (cell) {
        cell.forEach(cab => nearby.add(cab))
      }
    })

    return Array.from(nearby)
  }

  /**
   * Vypočítá skutečný bounding box skříňky podle rotace
   * Deleguje na sdílený BoundingBox.js
   */
  _getBoundingBox(x, z, width, depth, rotation) {
    return getBoundingBox(x, z, width, depth, rotation)
  }

  /**
   * Kontroluje kolizi s existujícími skříňkami
   * @param {number} x - X pozice (origin)
   * @param {number} z - Z pozice (origin)
   * @param {number} width - Šířka v metrech
   * @param {number} depth - Hloubka v metrech
   * @param {number} rotation - Rotace v radiánech
   * @param {string} excludeId - ID skříňky k vyloučení (pro update)
   * @returns {Array<Object>} - Array skříněk, se kterými koliduje
   */
  checkCollisions(x, z, width, depth, rotation = 0, excludeId = null) {
    // Vypočítej skutečný bounding box této skříňky
    const myBB = this._getBoundingBox(x, z, width, depth, rotation)

    // Najdi skříňky v okolí (použij větší radius pro jistotu)
    const searchRadius = Math.max(width, depth) * 2
    const centerX = (myBB.minX + myBB.maxX) / 2
    const centerZ = (myBB.minZ + myBB.maxZ) / 2

    console.log('  SpatialGrid.checkCollisions:', {
      searchFrom: [centerX, centerZ],
      searchRadius,
      myBB,
      gridStats: this.getStats()
    })

    const nearby = this.getNearby(centerX, centerZ, searchRadius)

    console.log('  getNearby returned:', nearby.length, 'cabinets')

    // DŮLEŽITÉ: Deduplikuj podle instanceId (Set porovnává reference, ne instanceId!)
    const seenIds = new Set()
    const uniqueNearby = []
    nearby.forEach(cab => {
      if (!seenIds.has(cab.instanceId)) {
        seenIds.add(cab.instanceId)
        uniqueNearby.push(cab)
      }
    })

    const collisions = []

    uniqueNearby.forEach(other => {
      if (other.instanceId === excludeId) return

      const otherX = other.position[0]
      const otherZ = other.position[2]
      const otherW = (other.width || 600) / 1000
      const otherD = (other.depth || 560) / 1000
      const otherRotation = other.rotation || 0

      // Vypočítej bounding box druhé skříňky
      const otherBB = this._getBoundingBox(otherX, otherZ, otherW, otherD, otherRotation)

      // AABB collision check s 2mm tolerancí pro floating point
      if (bbOverlap(myBB, otherBB)) {
        collisions.push(other)
      }
    })

    return collisions
  }

  /**
   * Najde všechny skříňky stejného typu v okolí
   * @param {number} x - X pozice
   * @param {number} z - Z pozice
   * @param {string} type - Typ skříňky (base, wall, tall)
   * @param {number} radius - Poloměr hledání
   * @returns {Array<Object>}
   */
  getNearbyByType(x, z, type, radius = 2.0) {
    const nearby = this.getNearby(x, z, radius)
    return nearby.filter(cab => cab.type === type)
  }

  /**
   * Vyčistí celý grid
   */
  clear() {
    this.grid.clear()
    this.cabinetCells.clear()
  }

  /**
   * Vrátí statistiky gridu (pro debugging)
   */
  getStats() {
    let totalCabinets = this.cabinetCells.size
    let totalCells = this.grid.size
    let avgCabinetsPerCell = 0

    if (totalCells > 0) {
      let sum = 0
      this.grid.forEach(cell => { sum += cell.size })
      avgCabinetsPerCell = sum / totalCells
    }

    return {
      totalCabinets,
      totalCells,
      avgCabinetsPerCell: avgCabinetsPerCell.toFixed(2),
      gridSize: `${this.gridCols}x${this.gridRows}`,
      cellSize: this.cellSize
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Převede world coordinates na grid coordinates
   */
  _worldToGrid(x, z) {
    // Přesuň origin do [0,0] (world používá center místnosti jako [0,0])
    const offsetX = x + this.roomWidth / 2
    const offsetZ = z + this.roomDepth / 2

    const col = Math.floor(offsetX / this.cellSize)
    const row = Math.floor(offsetZ / this.cellSize)

    return { col, row }
  }

  /**
   * Vytvoří klíč buňky
   */
  _cellKey(col, row) {
    return `${col},${row}`
  }

  /**
   * Najde všechny buňky, které skříňka obsazuje
   */
  _getCellsForCabinet(cabinet) {
    const x = cabinet.position[0]
    const z = cabinet.position[2]
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const rotation = cabinet.rotation || 0

    // Vypočítej skutečný bounding box podle rotace
    const bb = this._getBoundingBox(x, z, width, depth, rotation)

    // Najdi rozsah buněk
    const minCell = this._worldToGrid(bb.minX, bb.minZ)
    const maxCell = this._worldToGrid(bb.maxX, bb.maxZ)

    const cells = []
    for (let row = minCell.row; row <= maxCell.row; row++) {
      for (let col = minCell.col; col <= maxCell.col; col++) {
        cells.push(this._cellKey(col, row))
      }
    }

    return cells
  }

  /**
   * Najde buňky v daném poloměru
   */
  _getCellsInRadius(x, z, radius) {
    const minCell = this._worldToGrid(x - radius, z - radius)
    const maxCell = this._worldToGrid(x + radius, z + radius)

    const cells = []
    for (let row = minCell.row; row <= maxCell.row; row++) {
      for (let col = minCell.col; col <= maxCell.col; col++) {
        cells.push(this._cellKey(col, row))
      }
    }

    return cells
  }
}
