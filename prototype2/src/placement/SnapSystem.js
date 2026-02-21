/**
 * SnapSystem - Modulární systém pro přichytávání skříněk
 *
 * Aplikuje různé typy snapování v pořadí priority.
 * Každý snapper může být nezávisle zapnut/vypnut.
 *
 * Použití:
 *   const snap = new SnapSystem(config)
 *   const result = snap.snap(position, rotation, cabinet, context)
 */

import { WallSnapper } from './snappers/WallSnapper.js'
import { CabinetSnapper } from './snappers/CabinetSnapper.js'
import { GridSnapper } from './snappers/GridSnapper.js'

export class SnapSystem {
  /**
   * @param {Object} config - Konfigurace snapperů
   * @param {number} config.wallThreshold - Vzdálenost pro snap ke stěně (metry)
   * @param {number} config.cabinetThreshold - Vzdálenost pro snap ke skříňce (metry)
   * @param {number} config.gridSize - Velikost mřížky (metry)
   * @param {boolean} config.enableWall - Zapnout wall snap
   * @param {boolean} config.enableCabinet - Zapnout cabinet snap
   * @param {boolean} config.enableGrid - Zapnout grid snap
   */
  constructor(config = {}) {
    this.config = {
      wallThreshold: config.wallThreshold || 0.2,
      cabinetThreshold: config.cabinetThreshold || 0.12,
      gridSize: config.gridSize || 0.05,
      enableWall: config.enableWall !== false,
      enableCabinet: config.enableCabinet !== false,
      enableGrid: config.enableGrid !== false
    }

    // Vytvoř snappery
    this.snappers = [
      new WallSnapper(this.config.wallThreshold),
      new CabinetSnapper(this.config.cabinetThreshold),
      new GridSnapper(this.config.gridSize)
    ]
  }

  /**
   * Aplikuj všechny snapy v pořadí priority
   * @param {Object} input - { position: [x,y,z], rotation: number }
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Object} context - { spatialGrid, room, ... }
   * @returns {Object} - { position, rotation, snapped, snapType }
   */
  snap(input, cabinet, context) {
    const originalRotation = input.rotation
    let result = {
      position: [...input.position],
      rotation: input.rotation,
      snapped: false,
      snapType: null
    }

    // Sleduj jestli se rotace změnila (pro inteligentní magnetismus)
    let rotationJustChanged = false

    // Aplikuj každý snapper v pořadí
    for (const snapper of this.snappers) {
      // Skip pokud je vypnutý
      if (!this._isEnabled(snapper)) continue

      // Předej info o změně rotace do kontextu (pro CabinetSnapper)
      const enrichedContext = {
        ...context,
        rotationJustChanged
      }

      const snapped = snapper.snap(result, cabinet, enrichedContext)

      if (snapped.applied) {
        // Detekuj změnu rotace (např. WallSnapper změnil rotaci)
        if (Math.abs(snapped.rotation - result.rotation) > 0.1) {
          rotationJustChanged = true
        }

        result = snapped
        result.snapped = true
        result.snapType = snapper.constructor.name

        // Strong snap = přeruš další snapování
        if (snapped.strong) {
          break
        }
      }
    }

    return result
  }

  /**
   * Najde nejbližší snap point
   * @param {Array<number>} position - [x, y, z]
   * @param {Object} cabinet
   * @param {Object} context
   * @returns {Object} - { position, rotation, distance, type }
   */
  findNearestSnap(position, cabinet, context) {
    let nearest = null
    let minDistance = Infinity

    for (const snapper of this.snappers) {
      if (!this._isEnabled(snapper)) continue

      const snapPoints = snapper.getSnapPoints(
        { position, rotation: 0 },
        cabinet,
        context
      )

      snapPoints.forEach(point => {
        const dist = this._distance2D(position, point.position)
        if (dist < minDistance) {
          minDistance = dist
          nearest = {
            ...point,
            distance: dist,
            type: snapper.constructor.name
          }
        }
      })
    }

    return nearest
  }

  /**
   * Visualizační data pro debug rendering
   * @returns {Array<Object>} - Snap pointy pro zobrazení
   */
  getVisualizationData(cabinet, context) {
    const data = []

    for (const snapper of this.snappers) {
      if (!this._isEnabled(snapper)) continue

      const points = snapper.getSnapPoints(
        { position: [0, 0, 0], rotation: 0 },
        cabinet,
        context
      )

      points.forEach(point => {
        data.push({
          ...point,
          snapperType: snapper.constructor.name,
          color: this._getSnapperColor(snapper)
        })
      })
    }

    return data
  }

  /**
   * Update konfigurace
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }

    // Update individual snappers
    this.snappers.forEach(snapper => {
      if (snapper instanceof WallSnapper) {
        snapper.threshold = this.config.wallThreshold
      } else if (snapper instanceof CabinetSnapper) {
        snapper.threshold = this.config.cabinetThreshold
      } else if (snapper instanceof GridSnapper) {
        snapper.gridSize = this.config.gridSize
      }
    })
  }

  /**
   * Zapni/vypni konkrétní snapper
   */
  setEnabled(snapperName, enabled) {
    if (snapperName === 'wall') this.config.enableWall = enabled
    if (snapperName === 'cabinet') this.config.enableCabinet = enabled
    if (snapperName === 'grid') this.config.enableGrid = enabled
  }

  isEnabled(snapperName) {
    if (snapperName === 'wall') return this.config.enableWall
    if (snapperName === 'cabinet') return this.config.enableCabinet
    if (snapperName === 'grid') return this.config.enableGrid
    return false
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  _isEnabled(snapper) {
    if (snapper instanceof WallSnapper) return this.config.enableWall
    if (snapper instanceof CabinetSnapper) return this.config.enableCabinet
    if (snapper instanceof GridSnapper) return this.config.enableGrid
    return false
  }

  _distance2D(pos1, pos2) {
    const dx = pos1[0] - pos2[0]
    const dz = pos1[2] - pos2[2]
    return Math.sqrt(dx * dx + dz * dz)
  }

  _getSnapperColor(snapper) {
    if (snapper instanceof WallSnapper) return '#ff6b6b'
    if (snapper instanceof CabinetSnapper) return '#4caf50'
    if (snapper instanceof GridSnapper) return '#2196f3'
    return '#999'
  }
}
