/**
 * GridSnapper - Přichytávání k mřížce
 *
 * Nejjednodušší snapper - zaokrouhlí pozici na nejbližší grid point.
 * Má nejnižší prioritu (aplikuje se jako poslední).
 */

export class GridSnapper {
  constructor(gridSize = 0.05) {
    this.gridSize = gridSize // 5cm default
  }

  /**
   * @param {Object} current - { position: [x,y,z], rotation: number }
   * @param {Object} cabinet - Skříňka (unused pro grid snap)
   * @param {Object} context - Kontext (unused pro grid snap)
   * @returns {Object} - { position, rotation, applied, strong }
   */
  snap(current, cabinet, context) {
    const [x, y, z] = current.position
    const rotation = current.rotation

    // Grid snap pouze pro nerotované skříňky
    // (rotované mají wall snap, grid by jim překážel)
    if (Math.abs(rotation) >= 0.1) {
      return { ...current, applied: false }
    }

    // Snap X a Z na mřížku
    const snappedX = this._snapToGrid(x)
    const snappedZ = this._snapToGrid(z)

    // Kontrola zda se něco změnilo
    const changed = Math.abs(snappedX - x) > 0.001 || Math.abs(snappedZ - z) > 0.001

    if (changed) {
      return {
        position: [snappedX, y, snappedZ],
        rotation: rotation,
        applied: true,
        strong: false // Weak snap - ostatní snapy mají prioritu
      }
    }

    return { ...current, applied: false }
  }

  /**
   * Vrátí grid pointy pro vizualizaci
   */
  getSnapPoints(current, cabinet, context) {
    const { room } = context || { room: { width: 4, depth: 3 } }
    const points = []

    // Generuj grid pointy v místnosti
    const cols = Math.ceil(room.width / this.gridSize)
    const rows = Math.ceil(room.depth / this.gridSize)

    const startX = -room.width / 2
    const startZ = -room.depth / 2

    // Pro vizualizaci generuj pouze subset (každý 2. bod)
    for (let row = 0; row < rows; row += 2) {
      for (let col = 0; col < cols; col += 2) {
        const x = startX + col * this.gridSize
        const z = startZ + row * this.gridSize

        points.push({
          type: 'grid_point',
          position: [x, 0, z],
          rotation: 0
        })
      }
    }

    return points
  }

  /**
   * Najdi nejbližší grid point
   */
  findNearestGridPoint(position) {
    const [x, y, z] = position
    return [
      this._snapToGrid(x),
      y,
      this._snapToGrid(z)
    ]
  }

  /**
   * Kontrola zda je pozice na gridu
   */
  isOnGrid(position, tolerance = 0.001) {
    const [x, , z] = position
    const snappedX = this._snapToGrid(x)
    const snappedZ = this._snapToGrid(z)

    return (
      Math.abs(x - snappedX) < tolerance &&
      Math.abs(z - snappedZ) < tolerance
    )
  }

  /**
   * Vypočítá grid offset pro danou pozici
   * (kolik je pozice offset od gridu)
   */
  getGridOffset(position) {
    const [x, , z] = position
    const snappedX = this._snapToGrid(x)
    const snappedZ = this._snapToGrid(z)

    return {
      x: x - snappedX,
      z: z - snappedZ,
      distance: Math.sqrt(
        Math.pow(x - snappedX, 2) +
        Math.pow(z - snappedZ, 2)
      )
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  _snapToGrid(value) {
    return Math.round(value / this.gridSize) * this.gridSize
  }
}
