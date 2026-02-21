import { create } from 'zustand'
import { broadcastState, broadcastSelection } from './sync/channelSync'
import decorsData from './data/decors.json'

// Import nových placement systémů
import {
  SpatialGrid,
  CollisionDetector,
  DragStateManager,
  SnapSystem,
  PlacementSystem
} from './placement/index.js'

// ============================================================================
// INICIALIZACE PLACEMENT SUBSYSTÉMŮ
// ============================================================================

const ROOM_CONFIG = { width: 4, depth: 3, height: 2.6 }

// Vytvoř placement subsystémy (singleton instances)
const spatialGrid = new SpatialGrid(ROOM_CONFIG.width, ROOM_CONFIG.depth, 0.5)
const collisionDetector = new CollisionDetector(spatialGrid, ROOM_CONFIG)
const dragManager = new DragStateManager()
const snapSystem = new SnapSystem({
  wallThreshold: 0.5,  // 50cm snap to wall - dostatečně velké pro snadné umístění
  cabinetThreshold: 0.35,  // ZVÝŠENO: 35cm pro silný magnetismus a gap detection
  gridSize: 0.05,
  enableWall: true,
  enableCabinet: true,
  enableGrid: true
})
const placementSystem = new PlacementSystem(ROOM_CONFIG)

// ============================================================================
// ZUSTAND STORE - Zjednodušený díky delegaci na subsystémy
// ============================================================================

export const useStore = create((set, get) => ({
  // ========== STATE ==========
  placedCabinets: [],
  selectedCabinet: null,
  catalog: { cabinets: [], models: {} },

  // Room Wizard metadata (pro 2D zobrazení)
  roomFeatures: {
    doors: [],
    windows: [],
    plumbing: null
  },

  // Dekory
  decors: decorsData,
  globalDecors: {
    frontDecor: decorsData.defaults.frontDecor,
    bodyDecor: decorsData.defaults.bodyDecor,
    countertopDecor: decorsData.defaults.countertopDecor
  },
  decorTexturesLoaded: false,

  // Rozměry místnosti (v mm)
  roomWidth: 4000,
  roomDepth: 3000,
  roomHeight: 2600,

  // Nastavení snapů (synchronizováno se SnapSystem)
  snapToGrid: true,
  snapToWall: true,
  snapToCabinet: true,
  gridSize: 0.05,

  // Constraint mode
  constraintMode: false,
  constraintConfig: {
    minSinkCookGap: 600, // mm
    requireDishwasherAdjacent: true,
    workTriangleMin: 4000, // mm
    workTriangleMax: 7000 // mm
  },
  constraintIssues: [],
  constraintDetails: [],
  constraintViolations: [],
  _isApplyingConstraints: false,

  // Drag state (synchronizováno s DragStateManager)
  isDragging: false,
  draggingCabinetId: null,
  dragOffset: { x: 0, z: 0 },
  dragOriginalPosition: null,  // Původní pozice před tažením (pro revert při kolizi)
  dragOriginalRotation: 0,
  draggedCabinet: null,
  dragPreviewPosition: null,
  dragPreviewRotation: 0,

  // 1D Wall Composer - aktivní skříňka pro vkládání do stěny
  wallInsertCabinet: null,
  wallInsertError: null,

  // Výběr stěny pro umístění skříněk
  selectedWall: 'back', // 'back' | 'left' | 'right' | null (default: zadní stěna)

  // Subsystémy (exposed pro advanced use a debugging)
  _spatialGrid: spatialGrid,
  _collision: collisionDetector,
  _dragManager: dragManager,
  _snapSystem: snapSystem,
  _placementSystem: placementSystem,

  // ========== ACTIONS - ZJEDNODUŠENÉ ==========

  setCatalog: (catalog) => set({ catalog }),

  /**
   * Přidá skříňku - NOVÝ: s collision detection
   */
  addCabinet: (cabinet) => {
    const { placedCabinets, _placementSystem, _collision, _spatialGrid, selectedWall } = get()

    console.log('🆕 addCabinet called:', {
      placedCabinetsCount: placedCabinets.length,
      spatialGridStats: _spatialGrid.getStats(),
      selectedWall,
      cabinetToAdd: { width: cabinet.width, depth: cabinet.depth, type: cabinet.type }
    })

    // Najdi pozici pomocí PlacementSystem (předej vybranou stěnu)
    const placement = _placementSystem.findNextPosition(cabinet, placedCabinets, 'smart', selectedWall)

    console.log('📍 PlacementSystem result:', placement)

    // Pokud PlacementSystem vrátí null, stěna je plná
    if (!placement) {
      console.warn('❌ No space left on selected wall:', selectedWall)
      return
    }

    // Validuj pomocí CollisionDetector
    const validation = _collision.canPlace(cabinet, placement.position, placement.rotation)

    console.log('🔍 CollisionDetector validation:', validation)

    if (!validation.valid) {
      console.warn('❌ Cannot place cabinet:', validation.message)
      // Zkus najít nejbližší validní pozici
      const corrected = _collision.findNearestValidPosition(cabinet, placement.position, placement.rotation)
      console.log('🔄 Trying to find corrected position:', corrected)
      if (corrected) {
        placement.position = corrected.position
        placement.rotation = corrected.rotation
      } else {
        console.error('❌ No valid position found for cabinet')
        return
      }
    }

    console.log('✅ Placing cabinet at:', placement.position, 'rotation:', placement.rotation)

    const newCabinet = {
      ...cabinet,
      instanceId: Date.now() + Math.random(),
      position: placement.position,
      rotation: placement.rotation
    }

    // Přidej do spatial gridu
    _spatialGrid.add(newCabinet)

    set({ placedCabinets: [...placedCabinets, newCabinet] })
  },

  /**
   * Přidá skříňku na konkrétní pozici (pro drag & drop)
   * Unified flow: snap → clamp → collision check → auto-swap
   */
  addCabinetAtPosition: (cabinet, position, rotation = 0) => {
    const { _spatialGrid, _collision, _snapSystem, placedCabinets } = get()

    const roomW = _collision.room.width
    const roomD = _collision.room.depth

    // Unified flow: snap → clamp → collision check
    const result = _collision.checkPlacement(
      cabinet,
      position,
      rotation,
      null,
      {
        snap: placedCabinets.length > 0,
        snapSystem: _snapSystem,
        snapContext: {
          spatialGrid: _spatialGrid,
          excludeId: null,
          cabinetType: cabinet.type,
          room: { width: roomW, depth: roomD }
        }
      }
    )

    // Pokud kolize a jen 1 kolize se stejným typem → auto-swap
    if (!result.valid && result.collisions.length === 1) {
      const existing = result.collisions[0]
      if (existing.type === cabinet.type) {
        console.log('🔄 Auto-swap: replacing', existing.instanceId, 'with new cabinet')
        get().swapCabinet(existing.instanceId, cabinet)
        return
      }
    }

    // Vysoká skříňka koliduje s horními (wall) skříňkami → automaticky je odstraň
    // Vysoká skříňka nahrazuje obě úrovně (base + wall), takže kolize s wall je očekávaná
    if (!result.valid && cabinet.type === 'tall') {
      const wallCollisions = result.collisions.filter(c => c.type === 'wall')
      if (wallCollisions.length > 0 && wallCollisions.length === result.collisions.length) {
        console.log('🗑️ Auto-removing', wallCollisions.length, 'wall cabinet(s) for tall placement')
        wallCollisions.forEach(wc => {
          _spatialGrid.remove(wc.instanceId)
        })
        // Odeber z placedCabinets
        const wallIds = new Set(wallCollisions.map(wc => wc.instanceId))
        const filtered = get().placedCabinets.filter(c => !wallIds.has(c.instanceId))
        set({ placedCabinets: filtered })

        // Znovu zkontroluj umístění bez odstraněných skříněk
        const recheck = _collision.checkPlacement(
          cabinet, result.position, result.rotation, null,
          {
            snap: false  // Pozice už je nasnappovaná
          }
        )
        if (recheck.valid) {
          const newCabinet = {
            ...cabinet,
            instanceId: Date.now() + Math.random(),
            position: recheck.position,
            rotation: recheck.rotation
          }
          _spatialGrid.add(newCabinet)
          set((state) => ({
            placedCabinets: [...state.placedCabinets, newCabinet],
            selectedCabinet: newCabinet,
            draggedCabinet: null,
            dragPreviewPosition: null,
            dragPreviewRotation: 0
          }))
          return
        } else {
          // Recheck failed - restore wall cabinets to prevent data loss
          console.warn('Tall placement recheck failed - restoring wall cabinets')
          wallCollisions.forEach(wc => _spatialGrid.add(wc))
          set((state) => ({
            placedCabinets: [...state.placedCabinets, ...wallCollisions]
          }))
        }
      }
    }

    if (!result.valid) {
      console.warn('Collision detected - NOT placed')
      set({
        draggedCabinet: null,
        dragPreviewPosition: null,
        dragPreviewRotation: 0
      })
      return
    }

    const newCabinet = {
      ...cabinet,
      instanceId: Date.now() + Math.random(),
      position: result.position,
      rotation: result.rotation
    }

    _spatialGrid.add(newCabinet)

    set((state) => ({
      placedCabinets: [...state.placedCabinets, newCabinet],
      draggedCabinet: null,
      dragPreviewPosition: null,
      dragPreviewRotation: 0
    }))
  },

  /**
   * Aplikuje celý layout přesně (bez clampu/kolizní korekce)
   * Používá se pro AI návrhy s absolutními pozicemi
   */
  applyCabinetLayoutExact: (cabinets) => {
    const { _spatialGrid } = get()
    if (!Array.isArray(cabinets)) return

    const prepared = cabinets.map(cab => ({
      ...cab,
      instanceId: cab.instanceId || (Date.now() + Math.random())
    }))

    _spatialGrid.clear()
    prepared.forEach(cab => _spatialGrid.add(cab))

    set({
      placedCabinets: prepared,
      selectedCabinet: null,
      draggedCabinet: null,
      dragPreviewPosition: null,
      dragPreviewRotation: 0,
      wallInsertError: null
    })
  },

  /**
   * Odstraní skříňku - NOVÝ: update spatial grid
   */
  removeCabinet: (instanceId) => {
    const { _spatialGrid } = get()

    // Odstraň ze spatial gridu
    _spatialGrid.remove(instanceId)

    set((state) => ({
      placedCabinets: state.placedCabinets.filter(c => c.instanceId !== instanceId),
      selectedCabinet: state.selectedCabinet?.instanceId === instanceId ? null : state.selectedCabinet
    }))
  },

  /**
   * Vymění existující skříňku za novou (zachová pozici a rotaci)
   * Automaticky voláno z addCabinetAtPosition při kolizi se stejným typem
   */
  swapCabinet: (existingInstanceId, newCabinet) => {
    const { _spatialGrid, _collision, placedCabinets } = get()

    const existing = placedCabinets.find(c => c.instanceId === existingInstanceId)
    if (!existing) return false

    // Zapamatuj pozici a rotaci
    const position = [...existing.position]
    const rotation = existing.rotation || 0

    // Odstraň existující ze spatial gridu
    _spatialGrid.remove(existingInstanceId)

    // Collision check nové skříňky BEZ existující
    const width = (newCabinet.width || 600) / 1000
    const depth = (newCabinet.depth || 560) / 1000
    const height = (newCabinet.height || 720) / 1000
    const collisions = _spatialGrid.checkCollisions(
      position[0], position[2], width, depth, rotation, null
    )
    const realCollisions = collisions.filter(other => {
      const otherY = other.position[1]
      const otherH = (other.height || 720) / 1000
      return !(position[1] + height <= otherY + 0.01 || position[1] >= otherY + otherH - 0.01)
    })

    if (realCollisions.length > 0) {
      // Nová se nevejde - vrať existující zpět
      _spatialGrid.add(existing)
      console.warn('Swap failed: new cabinet does not fit')
      return false
    }

    // Vytvoř novou skříňku na stejné pozici
    const swapped = {
      ...newCabinet,
      instanceId: Date.now() + Math.random(),
      position,
      rotation
    }

    _spatialGrid.add(swapped)

    set((state) => ({
      placedCabinets: state.placedCabinets
        .filter(c => c.instanceId !== existingInstanceId)
        .concat(swapped),
      selectedCabinet: swapped,
      draggedCabinet: null,
      dragPreviewPosition: null,
      dragPreviewRotation: 0
    }))

    console.log(`🔄 Swapped cabinet ${existingInstanceId} → ${swapped.instanceId}`)
    return true
  },

  selectCabinet: (cabinet) => set({ selectedCabinet: cabinet }),

  /**
   * Update pozice - NOVÝ: update spatial grid
   */
  updateCabinetPosition: (instanceId, position) => {
    const { _spatialGrid, placedCabinets, constraintMode } = get()

    // Najdi skříňku
    const cabinet = placedCabinets.find(c => c.instanceId === instanceId)
    if (cabinet) {
      // Update spatial grid
      const updatedCabinet = { ...cabinet, position }
      _spatialGrid.update(updatedCabinet)
    }

    set((state) => ({
      placedCabinets: state.placedCabinets.map(c =>
        c.instanceId === instanceId ? { ...c, position } : c
      ),
      selectedCabinet: state.selectedCabinet?.instanceId === instanceId
        ? { ...state.selectedCabinet, position }
        : state.selectedCabinet
    }))

    if (constraintMode) {
      get().applyConstraints()
    }
  },

  /**
   * Update rotace - NOVÝ: update spatial grid
   */
  updateCabinetRotation: (instanceId, rotation) => {
    const { _spatialGrid, placedCabinets, constraintMode } = get()

    // Najdi skříňku
    const cabinet = placedCabinets.find(c => c.instanceId === instanceId)
    if (cabinet) {
      // Update spatial grid
      const updatedCabinet = { ...cabinet, rotation }
      _spatialGrid.update(updatedCabinet)
    }

    set((state) => ({
      placedCabinets: state.placedCabinets.map(c =>
        c.instanceId === instanceId ? { ...c, rotation } : c
      ),
      selectedCabinet: state.selectedCabinet?.instanceId === instanceId
        ? { ...state.selectedCabinet, rotation }
        : state.selectedCabinet
    }))

    if (constraintMode) {
      get().applyConstraints()
    }
  },

  /**
   * Inteligentní rotace skříňky s validací
   * @param {string} instanceId - ID skříňky
   * @param {number} direction - +1 pro otočení doleva (CCW), -1 pro doprava (CW)
   */
  rotateCabinet: (instanceId, direction = 1) => {
    const { placedCabinets, _spatialGrid, roomWidth, roomDepth } = get()

    const cabinet = placedCabinets.find(c => c.instanceId === instanceId)
    if (!cabinet) return

    // Aktuální stav
    const currentRotation = cabinet.rotation || 0
    const [x, y, z] = cabinet.position
    const cabW = (cabinet.width || 600) / 1000
    const cabD = (cabinet.depth || 560) / 1000
    const cabH = (cabinet.height || 720) / 1000
    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000

    // Vypočítej novou rotaci (±90°)
    let newRotation = currentRotation + (Math.PI / 2) * direction

    // Normalizuj do rozsahu [-π, π]
    while (newRotation > Math.PI) newRotation -= 2 * Math.PI
    while (newRotation < -Math.PI) newRotation += 2 * Math.PI

    // ========================================================================
    // PIVOT POINT CALCULATION - Používá maticovou transformaci
    // ========================================================================
    // V Three.js:
    //   - Position = World-space pozice lokálního originu (levý zadní roh)
    //   - Rotation = Rotace kolem lokálního originu
    //   - Geometrie má střed na (cabW/2, cabH/2, cabD/2) v local space
    //
    // World position středu = Position + Rotate(localCenter)

    const localCenterX = cabW / 2
    const localCenterZ = cabD / 2

    // Three.js coordinate system: right-handed, +Y up
    // Rotation kolem Y osy: skupina se otáčí, ale local center zůstává (cabW/2, cabD/2)

    // OPRAVA: Three.js používá LEFT-HANDED rotaci pro Y osu!
    // Správný vzorec pro Three.js:
    // x' = x + lx * cos(θ) + lz * sin(θ)  (ZMĚNĚNÝ SIGN!)
    // z' = z - lx * sin(θ) + lz * cos(θ)  (ZMĚNĚNÝ SIGN!)

    const cosOld = Math.cos(currentRotation)
    const sinOld = Math.sin(currentRotation)
    const oldWorldCenterX = x + localCenterX * cosOld + localCenterZ * sinOld
    const oldWorldCenterZ = z - localCenterX * sinOld + localCenterZ * cosOld

    // Pro novou rotaci - jaká pozice originu dá stejný world-space střed?
    const cosNew = Math.cos(newRotation)
    const sinNew = Math.sin(newRotation)
    const rotatedCenterX = localCenterX * cosNew + localCenterZ * sinNew
    const rotatedCenterZ = -localCenterX * sinNew + localCenterZ * cosNew

    let newX = oldWorldCenterX - rotatedCenterX
    let newZ = oldWorldCenterZ - rotatedCenterZ

    // Boundary clamp - vypočítej bounding box s novou rotací a clampuj
    // Pro každou rotaci máme 4 rohy geometrie, musíme najít min/max v world space
    const corners = [
      [0, 0], [cabW, 0], [0, cabD], [cabW, cabD]
    ]
    let minX = Infinity, maxX = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (const [lx, lz] of corners) {
      const wx = newX + lx * cosNew + lz * sinNew
      const wz = newZ - lx * sinNew + lz * cosNew
      minX = Math.min(minX, wx)
      maxX = Math.max(maxX, wx)
      minZ = Math.min(minZ, wz)
      maxZ = Math.max(maxZ, wz)
    }

    // Clampuj bounding box do místnosti
    if (minX < -roomW/2) newX += (-roomW/2 - minX)
    if (maxX > roomW/2) newX -= (maxX - roomW/2)
    if (minZ < -roomD/2) newZ += (-roomD/2 - minZ)
    if (maxZ > roomD/2) newZ -= (maxZ - roomD/2)

    // Collision check
    const collisions = _spatialGrid.checkCollisions(newX, newZ, cabW, cabD, newRotation, instanceId)
    const realCollisions = collisions.filter(other => {
      const otherY = other.position[1]
      const otherH = (other.height || 720) / 1000
      return !(y + cabH <= otherY + 0.01 || y >= otherY + otherH - 0.01)
    })

    if (realCollisions.length > 0) {
      console.warn('Cannot rotate: collision detected')
      return
    }

    // Aplikuj rotaci
    const updatedCabinet = { ...cabinet, position: [newX, y, newZ], rotation: newRotation }
    _spatialGrid.update(updatedCabinet)

    set((state) => ({
      placedCabinets: state.placedCabinets.map(c =>
        c.instanceId === instanceId ? updatedCabinet : c
      ),
      selectedCabinet: state.selectedCabinet?.instanceId === instanceId
        ? updatedCabinet
        : state.selectedCabinet
    }))
  },

  /**
   * Snap pozice - NOVÝ: delegace na SnapSystem
   */
  snapPosition: (x, y, z, cabinetWidth, cabinetDepth, cabinetType, currentInstanceId, currentRotation = 0) => {
    const { _snapSystem, _spatialGrid, roomWidth, roomDepth } = get()

    const cabinet = {
      width: cabinetWidth,
      depth: cabinetDepth,
      type: cabinetType
    }

    const context = {
      spatialGrid: _spatialGrid,
      excludeId: currentInstanceId,
      cabinetType: cabinetType,
      room: {
        width: roomWidth / 1000,
        depth: roomDepth / 1000
      }
    }

    const result = _snapSystem.snap(
      { position: [x, y, z], rotation: currentRotation },
      cabinet,
      context
    )

    return {
      position: result.position,
      rotation: result.rotation,
      snapped: result.snapped || false,
      snapType: result.snapType
    }
  },

  /**
   * Začátek tažení - NOVÝ: delegace na DragStateManager
   * Ukládá původní pozici pro případ revertu při kolizi
   */
  startDragging: (instanceId, offsetX, offsetZ) => {
    const { _dragManager, placedCabinets } = get()

    const cabinet = placedCabinets.find(c => c.instanceId === instanceId)
    if (!cabinet) return

    _dragManager.startDragCabinet(cabinet, { x: offsetX, z: offsetZ })

    set({
      isDragging: true,
      draggingCabinetId: instanceId,
      dragOffset: { x: offsetX, z: offsetZ },
      dragOriginalPosition: [...cabinet.position],  // Ulož původní pozici
      dragOriginalRotation: cabinet.rotation || 0
    })
  },

  /**
   * Konec tažení - NOVÝ: delegace na DragStateManager
   */
  stopDragging: () => {
    const state = get()
    const { _dragManager } = state
    _dragManager.stopDrag()

    set({
      isDragging: false,
      draggingCabinetId: null,
      dragOffset: { x: 0, z: 0 },
      dragOriginalPosition: null,
      dragOriginalRotation: 0
    })
  },

  /**
   * Začátek drag z katalogu
   */
  setDraggedCabinet: (cabinet) => {
    const { _dragManager } = get()

    if (cabinet) {
      _dragManager.startDragFromCatalog(cabinet)
    } else {
      _dragManager.stopDrag()
    }

    set({
      draggedCabinet: cabinet,
      dragPreviewPosition: cabinet ? [0, 0, 0] : null,
      dragPreviewRotation: 0
    })
  },

  /**
   * Update drag preview - S přichytáváním ke skříňkám
   * Používá unified checkPlacement (snap + clamp, bez collision)
   */
  updateDragPreview: (position, rotation = 0) => {
    const { _dragManager, _snapSystem, _spatialGrid, _collision, draggedCabinet, placedCabinets } = get()

    let finalPosition = position
    let finalRotation = rotation

    // Unified flow: snap + clamp pro vizuální feedback
    if (position && draggedCabinet && placedCabinets.length > 0) {
      const roomW = _collision.room.width
      const roomD = _collision.room.depth
      const result = _collision.checkPlacement(
        draggedCabinet,
        position,
        rotation,
        null,
        {
          snap: true,
          snapSystem: _snapSystem,
          snapContext: {
            spatialGrid: _spatialGrid,
            excludeId: null,
            cabinetType: draggedCabinet.type,
            room: { width: roomW, depth: roomD }
          }
        }
      )
      finalPosition = result.position
      finalRotation = result.rotation
    }

    if (finalPosition) {
      _dragManager.updatePreview(finalPosition, finalRotation)
    }

    set({
      dragPreviewPosition: finalPosition,
      dragPreviewRotation: finalRotation
    })
  },

  /**
   * Nastaví aktivní skříňku pro vkládání do stěny (Wall Composer)
   */
  setWallInsertCabinet: (cabinet) => set({ wallInsertCabinet: cabinet }),

  clearWallInsertError: () => set({ wallInsertError: null }),

  /**
   * Vloží skříňku do vybrané stěny na pozici (mm od začátku stěny)
   * Posune ostatní skříňky na stejné stěně doprava.
   */
  insertCabinetOnWall: (cabinet, wall, startMM, endMM = null) => {
    const { placedCabinets, roomWidth, roomDepth, _spatialGrid, _collision } = get()
    if (!cabinet || !wall) return

    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000
    const wallLength = wall === 'back' ? roomWidth : roomDepth

    const widthMM = cabinet.width || 600
    const depthMM = cabinet.depth || 560
    const sizeMM = wall === 'back' ? widthMM : widthMM

    const maxStartMM = (endMM !== null ? endMM : wallLength) - sizeMM
    if (startMM > maxStartMM) {
      set({ wallInsertError: 'Skříňka se nevejde do zvolené mezery.' })
      return
    }

    let rotation = 0
    if (wall === 'left') rotation = Math.PI / 2
    if (wall === 'right') rotation = -Math.PI / 2

    const y = cabinet.type === 'wall' ? 1.4 : cabinet.type === 'worktop' ? 0.72 : 0

    // Offset od stěny pro spodní skříňky hloubky 500mm
    const wallOffset = (cabinet.type === 'base' && depthMM === 500) ? 0.065 : 0

    const buildCandidates = (startAtMM) => {
      const zStartM = -roomD / 2 + (startAtMM / 1000)
      const zForLeft = zStartM + (widthMM / 1000) // left wall uses front edge (z) with width offset

      const newCab = {
        ...cabinet,
        instanceId: Date.now() + Math.random(),
        position: wall === 'back'
          ? [-roomW / 2 + (startAtMM / 1000), y, -roomD / 2 + wallOffset]
          : [wall === 'left' ? -roomW / 2 + wallOffset : roomW / 2 - wallOffset, y, wall === 'left' ? zForLeft : zStartM],
        rotation
      }

      // Posuň skříňky na stejné stěně, které jsou za vložením
      const moved = placedCabinets.map(cab => {
        const rot = cab.rotation || 0
        const onWall = wall === 'back'
          ? Math.abs(rot) < 0.15
          : wall === 'left'
            ? Math.abs(rot - Math.PI / 2) < 0.15
            : Math.abs(rot + Math.PI / 2) < 0.15

        if (!onWall) return cab

        const cabWidthM = (cab.width || 600) / 1000
        const startM = wall === 'back'
          ? cab.position[0] + roomW / 2
          : (wall === 'left'
            ? (cab.position[2] - cabWidthM) + roomD / 2
            : cab.position[2] + roomD / 2)

        const startMMCab = startM * 1000
        if (startMMCab < startAtMM) return cab

        const shiftM = sizeMM / 1000
        if (wall === 'back') {
          return { ...cab, position: [cab.position[0] + shiftM, cab.position[1], cab.position[2]] }
        }
        return { ...cab, position: [cab.position[0], cab.position[1], cab.position[2] + shiftM] }
      })

      return { newCab, allCandidates: [...moved, newCab] }
    }

    const validateCandidates = (candidates) => {
      const exceedsWall = candidates.some(cab => {
        const rot = cab.rotation || 0
        const onWall = wall === 'back'
          ? Math.abs(rot) < 0.15
          : wall === 'left'
            ? Math.abs(rot - Math.PI / 2) < 0.15
            : Math.abs(rot + Math.PI / 2) < 0.15
        if (!onWall) return false

        const widthMMCab = cab.width || 600
        const sizeMMCab = wall === 'back' ? widthMMCab : widthMMCab

        const cabWidthM = (cab.width || 600) / 1000
        const startM = wall === 'back'
          ? cab.position[0] + roomW / 2
          : (wall === 'left'
            ? (cab.position[2] - cabWidthM) + roomD / 2
            : cab.position[2] + roomD / 2)
        const startMMCab = startM * 1000
        return startMMCab < -1 || (startMMCab + sizeMMCab) > (wallLength + 1)
      })

      if (exceedsWall) {
        return { valid: false, message: 'Po vložení by skříňka přesáhla délku stěny.' }
      }

      // Validace kolizí vůči kandidátskému layoutu (dočasný grid)
      const tempGrid = new SpatialGrid(_collision.room.width, _collision.room.depth, 0.5)
      candidates.forEach(cab => tempGrid.add(cab))
      const tempCollision = new CollisionDetector(tempGrid, _collision.room)
      const validation = tempCollision.validateLayout(candidates)
      if (!validation.valid) {
        const firstIssue = validation.issues[0]
        return { valid: false, message: firstIssue?.message || 'Vložením by došlo ke kolizi skříněk.' }
      }

      return { valid: true }
    }

    const stepMM = 10
    let attemptStart = startMM
    let chosen = null
    let lastError = null

    while (attemptStart <= maxStartMM + 0.1) {
      const { newCab, allCandidates } = buildCandidates(attemptStart)
      const validation = validateCandidates(allCandidates)
      if (validation.valid) {
        chosen = { newCab, allCandidates }
        break
      }
      lastError = validation.message
      attemptStart += stepMM
    }

    if (!chosen) {
      set({ wallInsertError: lastError || 'Vložení se nepodařilo.' })
      return
    }

    // Rebuild spatial grid only after validation
    _spatialGrid.clear()
    chosen.allCandidates.forEach(cab => _spatialGrid.add(cab))

    set({
      placedCabinets: chosen.allCandidates,
      selectedCabinet: chosen.newCab,
      wallInsertError: null
    })
  },

  /**
   * Nastavení rozměrů místnosti - NOVÝ: update subsystémů
   */
  setRoomDimensions: (width, depth, height) => {
    const { _spatialGrid, _collision, _placementSystem } = get()

    const roomConfig = {
      width: width / 1000,
      depth: depth / 1000,
      height: height / 1000
    }

    // Update subsystémů
    _collision.updateRoom(roomConfig)
    _placementSystem.updateRoom(roomConfig)

    // Reinitializuj spatial grid s novou velikostí
    _spatialGrid.clear()
    const { placedCabinets } = get()
    placedCabinets.forEach(cab => _spatialGrid.add(cab))

    set({
      roomWidth: width,
      roomDepth: depth,
      roomHeight: height
    })
  },

  setRoomFeatures: (features) => set({ roomFeatures: features }),

  /**
   * Toggle snap settings - NOVÝ: synchronizuj se SnapSystem
   */
  toggleSnapToGrid: () => {
    const { _snapSystem } = get()
    const newValue = !get().snapToGrid
    _snapSystem.setEnabled('grid', newValue)
    set({ snapToGrid: newValue })
  },

  toggleSnapToWall: () => {
    const { _snapSystem } = get()
    const newValue = !get().snapToWall
    _snapSystem.setEnabled('wall', newValue)
    set({ snapToWall: newValue })
  },

  toggleSnapToCabinet: () => {
    const { _snapSystem } = get()
    const newValue = !get().snapToCabinet
    _snapSystem.setEnabled('cabinet', newValue)
    set({ snapToCabinet: newValue })
  },

  setGridSize: (size) => {
    const { _snapSystem } = get()
    _snapSystem.updateConfig({ gridSize: size })
    set({ gridSize: size })
  },

  setConstraintMode: (enabled) => set({ constraintMode: enabled }),
  setConstraintConfig: (partial) => set((state) => ({
    constraintConfig: { ...state.constraintConfig, ...partial }
  })),

  /**
   * Nastaví stěnu pro umístění skříněk
   * @param {string} wall - 'back' | 'left' | 'right' | null
   */
  setSelectedWall: (wall) => set({ selectedWall: wall }),

  // ========== DEKOR ACTIONS (beze změny) ==========

  setDecorTexturesLoaded: (loaded) => set({ decorTexturesLoaded: loaded }),

  setGlobalDecor: (type, decorId) => set((state) => ({
    globalDecors: { ...state.globalDecors, [type]: decorId }
  })),

  setCabinetDecor: (instanceId, decorType, decorId) => set((state) => ({
    placedCabinets: state.placedCabinets.map(c =>
      c.instanceId === instanceId
        ? { ...c, decors: { ...(c.decors || {}), [decorType]: decorId } }
        : c
    ),
    selectedCabinet: state.selectedCabinet?.instanceId === instanceId
      ? { ...state.selectedCabinet, decors: { ...(state.selectedCabinet.decors || {}), [decorType]: decorId } }
      : state.selectedCabinet
  })),

  clearCabinetDecor: (instanceId, decorType) => set((state) => ({
    placedCabinets: state.placedCabinets.map(c => {
      if (c.instanceId !== instanceId) return c
      const newDecors = { ...(c.decors || {}) }
      delete newDecors[decorType]
      return { ...c, decors: Object.keys(newDecors).length > 0 ? newDecors : undefined }
    }),
    selectedCabinet: state.selectedCabinet?.instanceId === instanceId
      ? (() => {
          const newDecors = { ...(state.selectedCabinet.decors || {}) }
          delete newDecors[decorType]
          return { ...state.selectedCabinet, decors: Object.keys(newDecors).length > 0 ? newDecors : undefined }
        })()
      : state.selectedCabinet
  })),

  getEffectiveDecor: (cabinet, decorType) => {
    const { globalDecors } = get()
    if (cabinet?.decors?.[decorType]) {
      return cabinet.decors[decorType]
    }
    return globalDecors[decorType]
  },

  findDecorById: (decorId) => {
    const { decors } = get()
    for (const collection of decors.collections) {
      const found = collection.decors.find(d => d.id === decorId)
      if (found) return { ...found, collection: collection.name }
    }
    return null
  },

  // ========== WORKTOP GENERATION ==========

  /**
   * Generuje pracovní desku pro skupinu sousedících base skříněk
   * @param {string} selectedCabinetId - ID vybrané skříňky (volitelné, jinak použije selectedCabinet)
   */
  generateWorktop: (selectedCabinetId = null) => {
    const { placedCabinets, selectedCabinet, roomWidth, roomDepth, _spatialGrid } = get()

    // Najdi výchozí skříňku
    const startCabinet = selectedCabinetId
      ? placedCabinets.find(c => c.instanceId === selectedCabinetId)
      : selectedCabinet

    if (!startCabinet) {
      console.warn('generateWorktop: No cabinet selected')
      return null
    }

    // Pouze pro base skříňky
    if (startCabinet.type !== 'base') {
      console.warn('generateWorktop: Selected cabinet is not a base cabinet')
      return null
    }

    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000

    // Zjisti stěnu podle rotace
    const getWall = (cab) => {
      const rot = cab.rotation || 0
      if (Math.abs(rot) < 0.1) return 'back'
      if (Math.abs(rot - Math.PI / 2) < 0.1) return 'left'
      if (Math.abs(rot + Math.PI / 2) < 0.1) return 'right'
      return 'back'
    }

    const startWall = getWall(startCabinet)

    // Najdi všechny base skříňky na stejné stěně
    const sameLevelCabinets = placedCabinets.filter(cab => {
      if (cab.type !== 'base') return false
      return getWall(cab) === startWall
    })

    if (sameLevelCabinets.length === 0) return null

    // Najdi sousedící skupinu (flood fill od vybrané skříňky)
    const connectedGroup = new Set()
    const toVisit = [startCabinet.instanceId]
    const tolerance = 0.02 // 2cm tolerance pro sousedství

    while (toVisit.length > 0) {
      const currentId = toVisit.pop()
      if (connectedGroup.has(currentId)) continue
      connectedGroup.add(currentId)

      const current = sameLevelCabinets.find(c => c.instanceId === currentId)
      if (!current) continue

      const currentW = (current.width || 600) / 1000
      const currentD = (current.depth || 560) / 1000
      const currentRot = current.rotation || 0
      const isRotated = Math.abs(currentRot) > 0.1

      // Efektivní rozměry
      const effW = isRotated ? currentD : currentW
      const effD = isRotated ? currentW : currentD

      // Bounding box
      let minX, maxX, minZ, maxZ
      if (startWall === 'back') {
        minX = current.position[0]
        maxX = current.position[0] + effW
        minZ = current.position[2]
        maxZ = current.position[2] + effD
      } else if (startWall === 'left') {
        minX = current.position[0]
        maxX = current.position[0] + effD
        minZ = current.position[2] - effW
        maxZ = current.position[2]
      } else { // right
        minX = current.position[0] - effD
        maxX = current.position[0]
        minZ = current.position[2]
        maxZ = current.position[2] + effW
      }

      // Najdi sousedy
      sameLevelCabinets.forEach(other => {
        if (connectedGroup.has(other.instanceId)) return

        const otherW = (other.width || 600) / 1000
        const otherD = (other.depth || 560) / 1000
        const otherRot = other.rotation || 0
        const otherRotated = Math.abs(otherRot) > 0.1
        const otherEffW = otherRotated ? otherD : otherW
        const otherEffD = otherRotated ? otherW : otherD

        let oMinX, oMaxX, oMinZ, oMaxZ
        if (startWall === 'back') {
          oMinX = other.position[0]
          oMaxX = other.position[0] + otherEffW
          oMinZ = other.position[2]
          oMaxZ = other.position[2] + otherEffD
        } else if (startWall === 'left') {
          oMinX = other.position[0]
          oMaxX = other.position[0] + otherEffD
          oMinZ = other.position[2] - otherEffW
          oMaxZ = other.position[2]
        } else { // right
          oMinX = other.position[0] - otherEffD
          oMaxX = other.position[0]
          oMinZ = other.position[2]
          oMaxZ = other.position[2] + otherEffW
        }

        // Test sousedství - hrany se dotýkají
        const touchesX = Math.abs(maxX - oMinX) < tolerance || Math.abs(oMaxX - minX) < tolerance
        const touchesZ = Math.abs(maxZ - oMinZ) < tolerance || Math.abs(oMaxZ - minZ) < tolerance
        const overlapsX = !(oMaxX < minX - tolerance || oMinX > maxX + tolerance)
        const overlapsZ = !(oMaxZ < minZ - tolerance || oMinZ > maxZ + tolerance)

        // Sousedí pokud se dotýkají na jedné ose a překrývají na druhé
        if ((touchesX && overlapsZ) || (touchesZ && overlapsX)) {
          toVisit.push(other.instanceId)
        }
      })
    }

    // Vypočítej celkový rozsah skupiny
    const groupCabinets = sameLevelCabinets.filter(c => connectedGroup.has(c.instanceId))

    // Detekce dřezové skříňky - podle group "dřezové" v katalogu
    const isSinkCabinet = (cab) => {
      const group = (cab.group || '').toLowerCase()
      return group.includes('dřezové') || group.includes('drezove')
    }

    let groupMinX = Infinity, groupMaxX = -Infinity
    let groupMinZ = Infinity, groupMaxZ = -Infinity
    let maxDepth = 0

    groupCabinets.forEach(cab => {
      const w = (cab.width || 600) / 1000
      const d = (cab.depth || 560) / 1000
      const rot = cab.rotation || 0
      const isRot = Math.abs(rot) > 0.1
      const effW = isRot ? d : w
      const effD = isRot ? w : d

      maxDepth = Math.max(maxDepth, effD)

      if (startWall === 'back') {
        groupMinX = Math.min(groupMinX, cab.position[0])
        groupMaxX = Math.max(groupMaxX, cab.position[0] + effW)
        groupMinZ = Math.min(groupMinZ, cab.position[2])
        groupMaxZ = Math.max(groupMaxZ, cab.position[2] + effD)
      } else if (startWall === 'left') {
        groupMinX = Math.min(groupMinX, cab.position[0])
        groupMaxX = Math.max(groupMaxX, cab.position[0] + effD)
        groupMinZ = Math.min(groupMinZ, cab.position[2] - effW)
        groupMaxZ = Math.max(groupMaxZ, cab.position[2])
      } else { // right
        groupMinX = Math.min(groupMinX, cab.position[0] - effD)
        groupMaxX = Math.max(groupMaxX, cab.position[0])
        groupMinZ = Math.min(groupMinZ, cab.position[2])
        groupMaxZ = Math.max(groupMaxZ, cab.position[2] + effW)
      }
    })

    // Najdi dřezovou skříňku a vypočítej její pozici relativně k worktop
    let sinkInfo = null
    groupCabinets.forEach(cab => {
      if (isSinkCabinet(cab)) {
        const w = (cab.width || 600) / 1000
        const d = (cab.depth || 560) / 1000
        const rot = cab.rotation || 0
        const isRot = Math.abs(rot) > 0.1
        const effW = isRot ? d : w

        // Offset od levého okraje worktop (v mm)
        let offsetFromLeft
        if (startWall === 'back') {
          offsetFromLeft = (cab.position[0] - groupMinX) * 1000
        } else if (startWall === 'left') {
          offsetFromLeft = (groupMaxZ - cab.position[2]) * 1000
        } else { // right
          offsetFromLeft = (cab.position[2] - groupMinZ) * 1000
        }

        sinkInfo = {
          offsetFromLeft: Math.round(offsetFromLeft),
          width: Math.round(effW * 1000),
          cabinetId: cab.instanceId
        }
        console.log(`🚰 Detected sink cabinet: ${cab.name} at offset ${sinkInfo.offsetFromLeft}mm, width ${sinkInfo.width}mm`)
      }
    })

    // Vytvoř pracovní desku
    const worktopHeight = 0.038 // 38mm
    const worktopDepth = 0.6 // 600mm
    const baseHeight = 0.72 // Výška base skříněk

    let worktopWidth, worktopPosition, worktopRotation

    // DŮLEŽITÉ: Pracovní deska je PŘÍMO u stěny (bez offsetu 65mm)
    // protože přesahuje přes skříňky směrem do místnosti
    if (startWall === 'back') {
      worktopWidth = (groupMaxX - groupMinX) * 1000 // v mm
      worktopPosition = [groupMinX, baseHeight, -roomD / 2] // Přímo u zadní stěny
      worktopRotation = 0
    } else if (startWall === 'left') {
      worktopWidth = (groupMaxZ - groupMinZ) * 1000 // v mm (délka podél stěny)
      worktopPosition = [-roomW / 2, baseHeight, groupMaxZ] // Přímo u levé stěny
      worktopRotation = Math.PI / 2
    } else { // right
      worktopWidth = (groupMaxZ - groupMinZ) * 1000 // v mm
      worktopPosition = [roomW / 2, baseHeight, groupMinZ] // Přímo u pravé stěny
      worktopRotation = -Math.PI / 2
    }

    const worktop = {
      id: 14115, // ID pracovní desky z katalogu
      instanceId: Date.now() + Math.random(),
      name: `Pracovní deska ${Math.round(worktopWidth)}mm`,
      code: 'PD-AUTO',
      brand: 'Oresi',
      brandId: 1,
      type: 'worktop',
      width: Math.round(worktopWidth),
      height: 38,
      depth: 600,
      position: worktopPosition,
      rotation: worktopRotation,
      // Info o dřezu (pokud je pod worktop skříňka s dřezem)
      sink: sinkInfo
    }

    // Přidej do scény
    const updatedCabinets = [...placedCabinets, worktop]
    _spatialGrid.add(worktop)

    set({
      placedCabinets: updatedCabinets,
      selectedCabinet: worktop
    })

    console.log(`✅ Generated worktop: ${worktop.name} at [${worktopPosition.map(v => v.toFixed(2)).join(', ')}]`)
    return worktop
  },

  // ========== UTILITY ACTIONS ==========

  clearAllCabinets: () => {
    const { _spatialGrid } = get()
    _spatialGrid.clear()

    set({
      placedCabinets: [],
      selectedCabinet: null
    })
  },

  /**
   * Constraint engine - základní ergonomická pravidla s auto-fixem
   */
  applyConstraints: () => {
    const state = get()
    if (state._isApplyingConstraints) return

    const { placedCabinets, constraintConfig, _collision, roomWidth, roomDepth } = state
    if (!placedCabinets || placedCabinets.length === 0) return

    const issues = []
    const details = []
    const violations = new Set()

    const keywordMatch = (cab, keywords) => {
      const text = `${cab.name || ''} ${cab.code || ''}`.toLowerCase()
      return keywords.some(k => text.includes(k))
    }

    const findCab = (keywords) => placedCabinets.find(c => keywordMatch(c, keywords))

    const sink = findCab(['sink', 'drez', 'dřez'])
    const dishwasher = findCab(['dish', 'myc', 'myčka'])
    const cook = findCab(['cook', 'var', 'varn', 'varná'])
    const fridge = findCab(['fridge', 'led', 'chlad'])

    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000

    const axisInfo = (cab) => {
      const rot = cab.rotation || 0
      const w = (cab.width || 600) / 1000
      if (Math.abs(rot) < 0.1) {
        return { axis: 'x', s: cab.position[0], e: cab.position[0] + w, rot }
      }
      if (Math.abs(rot - Math.PI / 2) < 0.1) {
        return { axis: 'z', s: cab.position[2] - w, e: cab.position[2], rot }
      }
      if (Math.abs(rot + Math.PI / 2) < 0.1) {
        return { axis: 'z', s: cab.position[2], e: cab.position[2] + w, rot }
      }
      return { axis: 'x', s: cab.position[0], e: cab.position[0] + w, rot }
    }

    const tryPlace = (cab, newPos) => {
      const result = _collision.canPlace(cab, newPos, cab.rotation || 0, cab.instanceId)
      return result.valid
    }

    const updated = new Map()
    const updateCab = (cab, pos) => {
      updated.set(cab.instanceId, { ...cab, position: pos })
    }

    // 1) Dishwasher adjacent to sink (same wall/axis)
    if (constraintConfig.requireDishwasherAdjacent && sink && dishwasher) {
      const a = axisInfo(sink)
      const b = axisInfo(dishwasher)
      if (a.axis === b.axis && Math.abs(a.rot - b.rot) < 0.1) {
        const gapRight = b.s - a.e
        const gapLeft = a.s - b.e
        const needsMove = Math.abs(gapRight) > 0.02 && Math.abs(gapLeft) > 0.02
        if (needsMove) {
          const dwW = (dishwasher.width || 600) / 1000
          let targetPos = null
          if (a.axis === 'x') {
            const rightX = a.e
            const leftX = a.s - dwW
            const y = dishwasher.position[1]
            const z = dishwasher.position[2]
            if (rightX + dwW <= roomW / 2 && tryPlace(dishwasher, [rightX, y, z])) {
              targetPos = [rightX, y, z]
            } else if (leftX >= -roomW / 2 && tryPlace(dishwasher, [leftX, y, z])) {
              targetPos = [leftX, y, z]
            }
          } else {
            const rightZ = a.e
            const leftZ = a.s - dwW
            const y = dishwasher.position[1]
            const x = dishwasher.position[0]
            if (rightZ + dwW <= roomD / 2 && tryPlace(dishwasher, [x, y, rightZ])) {
              targetPos = [x, y, rightZ]
            } else if (leftZ >= -roomD / 2 && tryPlace(dishwasher, [x, y, leftZ])) {
              targetPos = [x, y, leftZ]
            }
          }
          if (targetPos) {
            updateCab(dishwasher, targetPos)
          } else {
            issues.push('Myčka nemůže být umístěna vedle dřezu.')
            details.push({ rule: 'dishwasher_adjacent', message: 'Myčka nemůže být umístěna vedle dřezu.' })
            if (dishwasher?.instanceId) violations.add(dishwasher.instanceId)
            if (sink?.instanceId) violations.add(sink.instanceId)
          }
        }
      }
    }

    // 2) Min gap between sink and cooktop (same wall/axis)
    if (sink && cook && constraintConfig.minSinkCookGap > 0) {
      const a = axisInfo(sink)
      const b = axisInfo(cook)
      if (a.axis === b.axis && Math.abs(a.rot - b.rot) < 0.1) {
        const gap = (b.s >= a.e) ? (b.s - a.e) : (a.s - b.e)
        if (gap < (constraintConfig.minSinkCookGap / 1000)) {
          const cookW = (cook.width || 600) / 1000
          let targetPos = null
          if (a.axis === 'x') {
            const moveRight = b.s >= a.e
            const baseX = moveRight ? (a.e + constraintConfig.minSinkCookGap / 1000) : (a.s - cookW - constraintConfig.minSinkCookGap / 1000)
            const x = Math.max(-roomW / 2, Math.min(roomW / 2 - cookW, baseX))
            const y = cook.position[1]
            const z = cook.position[2]
            if (tryPlace(cook, [x, y, z])) targetPos = [x, y, z]
          } else {
            const moveRight = b.s >= a.e
            const baseZ = moveRight ? (a.e + constraintConfig.minSinkCookGap / 1000) : (a.s - cookW - constraintConfig.minSinkCookGap / 1000)
            const z = Math.max(-roomD / 2, Math.min(roomD / 2 - cookW, baseZ))
            const y = cook.position[1]
            const x = cook.position[0]
            if (tryPlace(cook, [x, y, z])) targetPos = [x, y, z]
          }
          if (targetPos) {
            updateCab(cook, targetPos)
          } else {
            issues.push('Nelze dodržet min. vzdálenost dřez–varná deska.')
            details.push({ rule: 'sink_cook_gap', message: 'Nelze dodržet min. vzdálenost dřez–varná deska.' })
            if (cook?.instanceId) violations.add(cook.instanceId)
            if (sink?.instanceId) violations.add(sink.instanceId)
          }
        }
      }
    }

    // 3) Work triangle
    if (sink && cook && fridge) {
      const dist = (a, b) => {
        const dx = a.position[0] - b.position[0]
        const dz = a.position[2] - b.position[2]
        return Math.sqrt(dx * dx + dz * dz)
      }
      const triangle = (dist(sink, cook) + dist(cook, fridge) + dist(fridge, sink)) * 1000
      if (triangle < constraintConfig.workTriangleMin || triangle > constraintConfig.workTriangleMax) {
        const msg = `Pracovní trojúhelník je ${Math.round(triangle)} mm (doporučeno ${constraintConfig.workTriangleMin}-${constraintConfig.workTriangleMax} mm).`
        issues.push(msg)
        details.push({ rule: 'work_triangle', message: msg })
        if (sink?.instanceId) violations.add(sink.instanceId)
        if (cook?.instanceId) violations.add(cook.instanceId)
        if (fridge?.instanceId) violations.add(fridge.instanceId)
      }
    }

    if (updated.size > 0) {
      set({ _isApplyingConstraints: true })
      updated.forEach((cab) => {
        state._spatialGrid.update(cab)
      })
      set((s) => ({
        placedCabinets: s.placedCabinets.map(c => updated.get(c.instanceId) || c),
        selectedCabinet: s.selectedCabinet?.instanceId && updated.get(s.selectedCabinet.instanceId)
          ? updated.get(s.selectedCabinet.instanceId)
          : s.selectedCabinet,
        constraintIssues: issues,
        constraintDetails: details,
        constraintViolations: Array.from(violations),
        _isApplyingConstraints: false
      }))
    } else {
      set({
        constraintIssues: issues,
        constraintDetails: details,
        constraintViolations: Array.from(violations)
      })
    }
  },

  /**
   * Vzorová kuchyně (beze změny)
   */
  loadSampleKitchen: () => {
    const { catalog, roomDepth, _spatialGrid } = get()
    if (catalog.cabinets.length === 0) return

    const sampleCabinets = []
    const zBase = -(roomDepth / 1000) / 2 + 0.3
    const zWall = -(roomDepth / 1000) / 2 + 0.2

    const baseCabs = catalog.cabinets.filter(c => c.type === 'base')
    const wallCabs = catalog.cabinets.filter(c => c.type === 'wall')
    const tallCabs = catalog.cabinets.filter(c => c.type === 'tall')

    let xPos = -1.5

    // Vysoká skříňka
    if (tallCabs.length > 0) {
      const tall = tallCabs[0]
      const width = (tall.width || 600) / 1000
      const newCab = {
        ...tall,
        instanceId: Date.now() + Math.random(),
        position: [xPos, 0, zBase],
        rotation: 0
      }
      sampleCabinets.push(newCab)
      _spatialGrid.add(newCab)
      xPos += width + 0.002
    }

    // Spodní skříňky
    for (let i = 0; i < Math.min(4, baseCabs.length); i++) {
      const cab = baseCabs[i]
      const width = (cab.width || 600) / 1000
      const newCab = {
        ...cab,
        instanceId: Date.now() + Math.random() + i,
        position: [xPos, 0, zBase],
        rotation: 0
      }
      sampleCabinets.push(newCab)
      _spatialGrid.add(newCab)
      xPos += width + 0.002
    }

    // Horní skříňky
    let xPosWall = -1.5
    if (tallCabs.length > 0) {
      xPosWall += (tallCabs[0].width || 600) / 1000 + 0.002
    }

    for (let i = 0; i < Math.min(4, wallCabs.length); i++) {
      const cab = wallCabs[i]
      const width = (cab.width || 600) / 1000
      const newCab = {
        ...cab,
        instanceId: Date.now() + Math.random() + i + 100,
        position: [xPosWall, 1.4, zWall],
        rotation: 0
      }
      sampleCabinets.push(newCab)
      _spatialGrid.add(newCab)
      xPosWall += width + 0.002
    }

    set({ placedCabinets: sampleCabinets, selectedCabinet: null })
  },

  /**
   * Broadcast do preview okna
   */
  broadcastToPreview: () => {
    const state = get()
    broadcastState(state)
  },

  // ========== NOVÉ UTILITY FUNKCE ==========

  /**
   * Validuj celý layout (collision check pro všechny skříňky)
   */
  validateLayout: () => {
    const { placedCabinets, _collision } = get()
    return _collision.validateLayout(placedCabinets)
  },

  /**
   * Debug info o placement subsystémech
   */
  getPlacementDebugInfo: () => {
    const { _spatialGrid, _dragManager, _snapSystem, _placementSystem } = get()

    return {
      spatialGrid: _spatialGrid.getStats(),
      dragManager: _dragManager.getDebugInfo(),
      snapSystem: {
        wall: _snapSystem.isEnabled('wall'),
        cabinet: _snapSystem.isEnabled('cabinet'),
        grid: _snapSystem.isEnabled('grid')
      },
      placementSystem: _placementSystem.getStats()
    }
  },

  // ========== SAVE/LOAD DESIGN ==========

  /**
   * Uloží aktuální návrh do localStorage
   * @param {string} name - Název návrhu
   */
  saveDesign: (name) => {
    const {
      placedCabinets,
      roomWidth, roomDepth, roomHeight,
      globalDecors, roomFeatures
    } = get()

    const design = {
      version: 1,
      name,
      savedAt: new Date().toISOString(),
      room: { width: roomWidth, depth: roomDepth, height: roomHeight },
      cabinets: placedCabinets.map(cab => ({
        ...cab,
        // Odstraň runtime properties které se regenerují
        _runtime: undefined
      })),
      globalDecors,
      roomFeatures
    }

    // Načti existující seznam návrhů
    const savedDesigns = JSON.parse(localStorage.getItem('kitchenDesigns') || '{}')
    savedDesigns[name] = design
    localStorage.setItem('kitchenDesigns', JSON.stringify(savedDesigns))

    console.log(`💾 Design "${name}" saved with ${placedCabinets.length} cabinets`)
    return true
  },

  /**
   * Načte návrh z localStorage
   * @param {string} name - Název návrhu
   */
  loadDesign: (name) => {
    const { _spatialGrid, _collision, _placementSystem } = get()

    const savedDesigns = JSON.parse(localStorage.getItem('kitchenDesigns') || '{}')
    const design = savedDesigns[name]

    if (!design) {
      console.error(`Design "${name}" not found`)
      return false
    }

    // Vyčisti spatial grid
    _spatialGrid.clear()

    // Nastav rozměry místnosti
    const roomConfig = {
      width: design.room.width / 1000,
      depth: design.room.depth / 1000,
      height: design.room.height / 1000
    }
    _collision.updateRoom(roomConfig)
    _placementSystem.updateRoom(roomConfig)

    // Regeneruj instanceId pro každou skříňku (aby byl unikátní)
    const cabinetsWithNewIds = design.cabinets.map(cab => {
      const newCab = {
        ...cab,
        instanceId: Date.now() + Math.random()
      }
      _spatialGrid.add(newCab)
      return newCab
    })

    set({
      placedCabinets: cabinetsWithNewIds,
      selectedCabinet: null,
      roomWidth: design.room.width,
      roomDepth: design.room.depth,
      roomHeight: design.room.height,
      globalDecors: design.globalDecors || get().globalDecors,
      roomFeatures: design.roomFeatures || get().roomFeatures
    })

    console.log(`📂 Design "${name}" loaded with ${cabinetsWithNewIds.length} cabinets`)
    return true
  },

  /**
   * Vrátí seznam uložených návrhů
   */
  getSavedDesigns: () => {
    const savedDesigns = JSON.parse(localStorage.getItem('kitchenDesigns') || '{}')
    return Object.entries(savedDesigns).map(([name, design]) => ({
      name,
      savedAt: design.savedAt,
      cabinetCount: design.cabinets?.length || 0,
      room: design.room
    }))
  },

  /**
   * Smaže uložený návrh
   * @param {string} name - Název návrhu
   */
  deleteDesign: (name) => {
    const savedDesigns = JSON.parse(localStorage.getItem('kitchenDesigns') || '{}')
    delete savedDesigns[name]
    localStorage.setItem('kitchenDesigns', JSON.stringify(savedDesigns))
    console.log(`🗑️ Design "${name}" deleted`)
    return true
  },

  /**
   * Exportuje návrh jako JSON string (pro stažení)
   */
  exportDesign: () => {
    const {
      placedCabinets,
      roomWidth, roomDepth, roomHeight,
      globalDecors, roomFeatures
    } = get()

    const design = {
      version: 1,
      exportedAt: new Date().toISOString(),
      room: { width: roomWidth, depth: roomDepth, height: roomHeight },
      cabinets: placedCabinets,
      globalDecors,
      roomFeatures
    }

    return JSON.stringify(design, null, 2)
  },

  /**
   * Importuje návrh z JSON stringu
   * @param {string} jsonString - JSON string s návrhem
   */
  importDesign: (jsonString) => {
    const { _spatialGrid, _collision, _placementSystem } = get()

    try {
      const design = JSON.parse(jsonString)

      if (!design.cabinets || !design.room) {
        console.error('Invalid design format')
        return false
      }

      // Vyčisti spatial grid
      _spatialGrid.clear()

      // Nastav rozměry místnosti
      const roomConfig = {
        width: design.room.width / 1000,
        depth: design.room.depth / 1000,
        height: design.room.height / 1000
      }
      _collision.updateRoom(roomConfig)
      _placementSystem.updateRoom(roomConfig)

      // Regeneruj instanceId
      const cabinetsWithNewIds = design.cabinets.map(cab => {
        const newCab = {
          ...cab,
          instanceId: Date.now() + Math.random()
        }
        _spatialGrid.add(newCab)
        return newCab
      })

      set({
        placedCabinets: cabinetsWithNewIds,
        selectedCabinet: null,
        roomWidth: design.room.width,
        roomDepth: design.room.depth,
        roomHeight: design.room.height,
        globalDecors: design.globalDecors || get().globalDecors,
        roomFeatures: design.roomFeatures || get().roomFeatures
      })

      console.log(`📥 Design imported with ${cabinetsWithNewIds.length} cabinets`)
      return true
    } catch (e) {
      console.error('Failed to import design:', e)
      return false
    }
  }
}))

// Subscribe na změny a automaticky broadcast do preview okna
let broadcastTimeout = null
useStore.subscribe((state, prevState) => {
  const shouldBroadcast =
    state.placedCabinets !== prevState.placedCabinets ||
    state.selectedCabinet !== prevState.selectedCabinet ||
    state.roomWidth !== prevState.roomWidth ||
    state.roomDepth !== prevState.roomDepth ||
    state.roomHeight !== prevState.roomHeight ||
    state.globalDecors !== prevState.globalDecors

  if (shouldBroadcast) {
    if (broadcastTimeout) clearTimeout(broadcastTimeout)
    broadcastTimeout = setTimeout(() => {
      broadcastState(state)
    }, 50)
  }
})
