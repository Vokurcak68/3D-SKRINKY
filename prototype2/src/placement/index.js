/**
 * Placement System - Hlavní export
 *
 * Centrální místo pro import všech placement komponent
 */

export * from './BoundingBox.js'
export { SpatialGrid } from './SpatialGrid.js'
export { CollisionDetector } from './CollisionDetector.js'
export { DragStateManager, DragMode, createDragMiddleware } from './DragStateManager.js'
export { SnapSystem } from './SnapSystem.js'
export { PlacementSystem } from './PlacementSystem.js'

// Snappery
export { WallSnapper } from './snappers/WallSnapper.js'
export { CabinetSnapper } from './snappers/CabinetSnapper.js'
export { GridSnapper } from './snappers/GridSnapper.js'

// Strategie
export { LinearPlacementStrategy } from './strategies/LinearPlacementStrategy.js'
export { SmartPlacementStrategy } from './strategies/SmartPlacementStrategy.js'
export { GridPlacementStrategy } from './strategies/GridPlacementStrategy.js'
