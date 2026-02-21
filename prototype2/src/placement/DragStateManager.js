/**
 * DragStateManager - Centralizovaný state management pro drag & drop
 *
 * Řeší problém s fragmentovaným stavem (isDragging, draggingCabinetId, draggedCabinet, atd.)
 * Veškerý drag state je v jednom objektu s jasným state machine.
 *
 * State machine:
 *   idle → dragging_catalog → idle
 *   idle → dragging_cabinet → idle
 *
 * Použití:
 *   const dragMgr = new DragStateManager()
 *   dragMgr.startDragFromCatalog(cabinet)
 *   dragMgr.updatePreview(position, rotation)
 *   dragMgr.stopDrag()
 */

export const DragMode = {
  IDLE: 'idle',
  DRAGGING_CATALOG: 'dragging_catalog',   // Táhnutí z katalogu
  DRAGGING_CABINET: 'dragging_cabinet'    // Táhnutí umístěné skříňky
}

export class DragStateManager {
  constructor() {
    this.state = this._createIdleState()

    // Callbacks pro state changes
    this._listeners = []
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Začne táhnout skříňku z katalogu
   * @param {Object} cabinet - Skříňka z katalogu
   */
  startDragFromCatalog(cabinet) {
    if (this.state.mode !== DragMode.IDLE) {
      console.warn('DragStateManager: Cannot start catalog drag - already dragging')
      return false
    }

    this.state = {
      mode: DragMode.DRAGGING_CATALOG,
      draggedItem: {
        type: 'catalog',
        cabinet: cabinet
      },
      dragOffset: { x: 0, z: 0 },
      previewPosition: null,
      previewRotation: 0,
      startTime: Date.now()
    }

    this._notify()
    return true
  }

  /**
   * Začne táhnout umístěnou skříňku
   * @param {Object} cabinet - Umístěná skříňka
   * @param {Object} offset - {x, z} offset pro smooth drag
   */
  startDragCabinet(cabinet, offset = { x: 0, z: 0 }) {
    if (this.state.mode !== DragMode.IDLE) {
      console.warn('DragStateManager: Cannot start cabinet drag - already dragging')
      return false
    }

    this.state = {
      mode: DragMode.DRAGGING_CABINET,
      draggedItem: {
        type: 'placed',
        cabinet: cabinet,
        instanceId: cabinet.instanceId
      },
      dragOffset: offset,
      previewPosition: cabinet.position,
      previewRotation: cabinet.rotation || 0,
      originalPosition: [...cabinet.position], // Backup pro cancel
      originalRotation: cabinet.rotation || 0,
      startTime: Date.now()
    }

    this._notify()
    return true
  }

  /**
   * Aktualizuje preview pozici a rotaci
   * @param {Array<number>} position - [x, y, z]
   * @param {number} rotation - Rotace v radiánech
   */
  updatePreview(position, rotation) {
    if (this.state.mode === DragMode.IDLE) {
      return false
    }

    this.state.previewPosition = position
    this.state.previewRotation = rotation

    this._notify()
    return true
  }

  /**
   * Ukončí drag operaci (success)
   * @returns {Object|null} - Finální data nebo null
   */
  stopDrag() {
    if (this.state.mode === DragMode.IDLE) {
      return null
    }

    const finalData = {
      mode: this.state.mode,
      cabinet: this.state.draggedItem.cabinet,
      instanceId: this.state.draggedItem.instanceId,
      position: this.state.previewPosition,
      rotation: this.state.previewRotation,
      duration: Date.now() - this.state.startTime
    }

    this.state = this._createIdleState()
    this._notify()

    return finalData
  }

  /**
   * Zruší drag operaci (cancel) - vrátí do původního stavu
   * @returns {Object|null} - Původní data nebo null
   */
  cancelDrag() {
    if (this.state.mode === DragMode.IDLE) {
      return null
    }

    const cancelData = {
      mode: this.state.mode,
      instanceId: this.state.draggedItem.instanceId,
      originalPosition: this.state.originalPosition,
      originalRotation: this.state.originalRotation
    }

    this.state = this._createIdleState()
    this._notify()

    return cancelData
  }

  /**
   * Force reset - bezpečné ukončení v jakémkoliv stavu
   */
  reset() {
    this.state = this._createIdleState()
    this._notify()
  }

  // ============================================================================
  // GETTERS - Read-only přístup ke stavu
  // ============================================================================

  isDragging() {
    return this.state.mode !== DragMode.IDLE
  }

  isDraggingFromCatalog() {
    return this.state.mode === DragMode.DRAGGING_CATALOG
  }

  isDraggingCabinet() {
    return this.state.mode === DragMode.DRAGGING_CABINET
  }

  getMode() {
    return this.state.mode
  }

  getDraggedCabinet() {
    return this.state.draggedItem?.cabinet || null
  }

  getDraggedInstanceId() {
    return this.state.draggedItem?.instanceId || null
  }

  getPreviewPosition() {
    return this.state.previewPosition
  }

  getPreviewRotation() {
    return this.state.previewRotation
  }

  getDragOffset() {
    return this.state.dragOffset
  }

  getState() {
    // Vrať copy aby nikdo nemohl přímo modifikovat
    return { ...this.state }
  }

  getDragDuration() {
    if (this.state.mode === DragMode.IDLE) return 0
    return Date.now() - this.state.startTime
  }

  // ============================================================================
  // OBSERVERS - Subscribe na změny stavu
  // ============================================================================

  /**
   * Přidej listener pro změny stavu
   * @param {Function} callback - (newState, oldState) => void
   * @returns {Function} - Unsubscribe funkce
   */
  subscribe(callback) {
    this._listeners.push(callback)

    // Vrať unsubscribe funkci
    return () => {
      const index = this._listeners.indexOf(callback)
      if (index > -1) {
        this._listeners.splice(index, 1)
      }
    }
  }

  // ============================================================================
  // DEBUGGING & VALIDATION
  // ============================================================================

  /**
   * Validuj aktuální stav (pro debugging)
   */
  validate() {
    const issues = []

    // Check mode validity
    if (!Object.values(DragMode).includes(this.state.mode)) {
      issues.push(`Invalid mode: ${this.state.mode}`)
    }

    // Check consistency
    if (this.state.mode !== DragMode.IDLE) {
      if (!this.state.draggedItem) {
        issues.push('Dragging but no draggedItem')
      }
      if (this.state.mode === DragMode.DRAGGING_CABINET && !this.state.draggedItem?.instanceId) {
        issues.push('Dragging cabinet but no instanceId')
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Debug info
   */
  getDebugInfo() {
    return {
      mode: this.state.mode,
      isDragging: this.isDragging(),
      hasPreview: this.state.previewPosition !== null,
      dragType: this.state.draggedItem?.type,
      duration: this.getDragDuration(),
      listeners: this._listeners.length
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  _createIdleState() {
    return {
      mode: DragMode.IDLE,
      draggedItem: null,
      dragOffset: { x: 0, z: 0 },
      previewPosition: null,
      previewRotation: 0,
      originalPosition: null,
      originalRotation: 0,
      startTime: null
    }
  }

  _notify() {
    // Volej všechny listenery
    this._listeners.forEach(callback => {
      try {
        callback(this.state)
      } catch (err) {
        console.error('DragStateManager listener error:', err)
      }
    })
  }
}

// ============================================================================
// HELPER - Pro integraci se Zustand store
// ============================================================================

/**
 * Vytvoří Zustand middleware pro DragStateManager
 * Automaticky synchronizuje DragStateManager se Zustand store
 */
export function createDragMiddleware(dragManager) {
  return (config) => (set, get, api) => {
    // Subscribe na změny v DragStateManageru
    dragManager.subscribe((newState) => {
      // Update Zustand store
      set({
        isDragging: newState.mode !== DragMode.IDLE,
        draggingCabinetId: newState.draggedItem?.instanceId || null,
        draggedCabinet: newState.mode === DragMode.DRAGGING_CATALOG
          ? newState.draggedItem?.cabinet
          : null,
        dragPreviewPosition: newState.previewPosition,
        dragPreviewRotation: newState.previewRotation
      })
    })

    return config(set, get, api)
  }
}
