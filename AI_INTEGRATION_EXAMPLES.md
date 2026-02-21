# 🔧 AI INTEGRATION - PRACTICAL EXAMPLES

## Example 1: Integrace PlacementSuggestionEngine do Store

### store.js - Přidání AI state a actions

```javascript
import { PlacementSuggestionEngine } from './ai/PlacementSuggestionEngine.js'

const useStore = create((set, get) => ({
  // ... existující state ...

  // === AI STATE ===
  aiSuggestions: [],              // Array of suggestions { position, rotation, score, reasons, ... }
  aiSuggestionsEnabled: true,     // Toggle AI suggestions on/off
  aiSelectedSuggestion: null,     // Currently highlighted suggestion (0-2)

  // === AI ENGINE (singleton) ===
  _aiEngine: null,

  // === INITIALIZE AI ENGINE ===
  initAI: () => {
    const state = get()
    if (!state._aiEngine) {
      set({
        _aiEngine: new PlacementSuggestionEngine(
          state._spatialGrid,
          state._collision,
          state._placementSystem,
          state.catalog
        )
      })
    }
  },

  // === GET AI SUGGESTIONS ===
  getAISuggestions: (cabinet, roomContext = {}) => {
    const state = get()

    // Initialize engine if needed
    if (!state._aiEngine) {
      state.initAI()
    }

    // Skip if disabled
    if (!state.aiSuggestionsEnabled) {
      return []
    }

    // Get suggestions
    const suggestions = state._aiEngine.getSuggestions(
      cabinet,
      state.placedCabinets,
      roomContext
    )

    // Update state
    set({ aiSuggestions: suggestions })

    return suggestions
  },

  // === APPLY AI SUGGESTION ===
  applyAISuggestion: (suggestionIndex) => {
    const state = get()
    const suggestion = state.aiSuggestions[suggestionIndex]

    if (!suggestion) {
      console.warn('Invalid suggestion index:', suggestionIndex)
      return
    }

    // Přidej skříňku na navrhovanou pozici
    const cabinet = state.draggedCabinet
    if (!cabinet) {
      console.warn('No dragged cabinet')
      return
    }

    state.addCabinetAtPosition(
      cabinet,
      suggestion.position,
      suggestion.rotation
    )

    // Clear suggestions
    set({ aiSuggestions: [], draggedCabinet: null })
  },

  // === TOGGLE AI SUGGESTIONS ===
  toggleAISuggestions: () => {
    set(state => ({
      aiSuggestionsEnabled: !state.aiSuggestionsEnabled,
      aiSuggestions: state.aiSuggestionsEnabled ? [] : state.aiSuggestions
    }))
  },

  // === HIGHLIGHT SUGGESTION (keyboard navigation) ===
  highlightSuggestion: (index) => {
    const state = get()
    if (index >= 0 && index < state.aiSuggestions.length) {
      set({ aiSelectedSuggestion: index })
    }
  },

  // === CLEAR AI SUGGESTIONS ===
  clearAISuggestions: () => {
    set({ aiSuggestions: [], aiSelectedSuggestion: null })
  }
}))
```

---

## Example 2: Scene3D - Zobrazení AI Suggestions jako Ghost Previews

### Scene3D.jsx - Rendering AI suggestions

```jsx
import { Html } from '@react-three/drei'
import { useStore } from '../store'

function Scene3D() {
  const placedCabinets = useStore(s => s.placedCabinets)
  const aiSuggestions = useStore(s => s.aiSuggestions)
  const aiSelectedSuggestion = useStore(s => s.aiSelectedSuggestion)
  const applyAISuggestion = useStore(s => s.applyAISuggestion)

  return (
    <Canvas>
      {/* Existing scene content */}
      <Room />
      {placedCabinets.map(cab => <Cabinet3D key={cab.instanceId} cabinet={cab} />)}

      {/* AI Suggestions - Ghost Previews */}
      {aiSuggestions.map((suggestion, index) => (
        <AISuggestionPreview
          key={index}
          suggestion={suggestion}
          index={index}
          isSelected={aiSelectedSuggestion === index}
          onSelect={() => applyAISuggestion(index)}
        />
      ))}

      {/* Existing controls */}
      <OrbitControls />
    </Canvas>
  )
}

/**
 * AI Suggestion Preview Component
 * Zobrazuje ghost preview s score badge
 */
function AISuggestionPreview({ suggestion, index, isSelected, onSelect }) {
  const draggedCabinet = useStore(s => s.draggedCabinet)

  if (!draggedCabinet) return null

  const width = (draggedCabinet.width || 600) / 1000
  const height = (draggedCabinet.height || 720) / 1000
  const depth = (draggedCabinet.depth || 560) / 1000

  return (
    <group
      position={suggestion.position}
      rotation={[0, suggestion.rotation, 0]}
      onClick={onSelect}
    >
      {/* Ghost box */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={suggestion.color}
          transparent
          opacity={isSelected ? 0.5 : 0.3}
          wireframe={!isSelected}
        />
      </mesh>

      {/* Score badge */}
      <Html
        position={[0, height + 0.2, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="ai-suggestion-badge"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            minWidth: '150px',
            border: isSelected ? '2px solid #4CAF50' : 'none'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {suggestion.starRating} {Math.round(suggestion.score)}/100
          </div>
          <div style={{ fontSize: '12px', color: '#FFD700' }}>
            Press {suggestion.hotkey}
          </div>
          {isSelected && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#ccc' }}>
              {suggestion.reasons.slice(0, 2).map((reason, i) => (
                <div key={i}>{reason}</div>
              ))}
            </div>
          )}
        </div>
      </Html>

      {/* Ground shadow */}
      <mesh
        position={[0, -suggestion.position[1] + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width * 1.2, depth * 1.2]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
    </group>
  )
}

export default Scene3D
```

---

## Example 3: DropZoneHandler - Trigger AI Suggestions během drag

### components/DropZoneHandler.jsx

```jsx
import { useEffect } from 'react'
import { useStore } from '../store'

function DropZoneHandler() {
  const draggedCabinet = useStore(s => s.draggedCabinet)
  const getAISuggestions = useStore(s => s.getAISuggestions)
  const applyAISuggestion = useStore(s => s.applyAISuggestion)
  const highlightSuggestion = useStore(s => s.highlightSuggestion)

  // Keyboard shortcuts pro suggestions (1, 2, 3)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!draggedCabinet) return

      // Number keys 1-3 = Apply suggestion
      if (e.key >= '1' && e.key <= '3') {
        const index = parseInt(e.key) - 1
        applyAISuggestion(index)
      }

      // Arrow keys = Highlight suggestion
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = useStore.getState().aiSelectedSuggestion || 0
        const newIndex = e.key === 'ArrowUp'
          ? Math.max(0, currentIndex - 1)
          : Math.min(2, currentIndex + 1)
        highlightSuggestion(newIndex)
      }

      // Enter = Apply highlighted suggestion
      if (e.key === 'Enter') {
        const index = useStore.getState().aiSelectedSuggestion || 0
        applyAISuggestion(index)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [draggedCabinet])

  // Get AI suggestions when drag starts
  useEffect(() => {
    if (draggedCabinet) {
      // Room context (okna, dveře, atd.)
      const roomContext = {
        windowPosition: [0, 1.5, -1.5], // Okno uprostřed zadní stěny
        doorPosition: [2, 0, 1.5]        // Dveře vpravo na přední stěně
      }

      // Throttle - nezískávej suggestions při každém pohybu
      const timer = setTimeout(() => {
        getAISuggestions(draggedCabinet, roomContext)
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [draggedCabinet])

  return null // Pure logic component
}

export default DropZoneHandler
```

---

## Example 4: AI Settings Panel

### components/AISettingsPanel.jsx

```jsx
import { useStore } from '../store'

function AISettingsPanel() {
  const aiSuggestionsEnabled = useStore(s => s.aiSuggestionsEnabled)
  const toggleAISuggestions = useStore(s => s.toggleAISuggestions)
  const aiEngine = useStore(s => s._aiEngine)

  const [maxSuggestions, setMaxSuggestions] = React.useState(3)
  const [minScore, setMinScore] = React.useState(30)

  const handleUpdateConfig = () => {
    if (aiEngine) {
      aiEngine.updateConfig({ maxSuggestions, minScore })
    }
  }

  return (
    <div className="ai-settings-panel">
      <h3>🤖 AI Assistant</h3>

      {/* Toggle */}
      <label>
        <input
          type="checkbox"
          checked={aiSuggestionsEnabled}
          onChange={toggleAISuggestions}
        />
        Zapnout AI návrhy
      </label>

      {/* Config */}
      {aiSuggestionsEnabled && (
        <div className="ai-config">
          <label>
            Max počet návrhů:
            <input
              type="number"
              min="1"
              max="5"
              value={maxSuggestions}
              onChange={(e) => setMaxSuggestions(parseInt(e.target.value))}
            />
          </label>

          <label>
            Min. skóre:
            <input
              type="range"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
            />
            {minScore}/100
          </label>

          <button onClick={handleUpdateConfig}>
            Aplikovat nastavení
          </button>
        </div>
      )}

      {/* Info */}
      <div className="ai-info">
        <p>
          AI asistent navrhuje optimální pozice na základě:
        </p>
        <ul>
          <li>⚡ Ergonomie (pracovní trojúhelník)</li>
          <li>🎨 Estetiky (symetrie, balance)</li>
          <li>🚪 Přístupnosti (otevírání dvířek)</li>
          <li>📏 Využití prostoru</li>
        </ul>
      </div>
    </div>
  )
}

export default AISettingsPanel
```

---

## Example 5: Usage - Complete Workflow

### Krok 1: Uživatel začne drag operaci

```javascript
// User clicks on cabinet in CatalogPanel
setDraggedCabinet(cabinet)

// Store automatically:
// 1. Detekuje draggedCabinet !== null
// 2. Calls getAISuggestions(cabinet)
// 3. PlacementSuggestionEngine generates 3 suggestions
// 4. Suggestions stored in aiSuggestions state
```

### Krok 2: Scene3D zobrazí ghost previews

```javascript
// Scene3D re-renders with aiSuggestions
// Shows 3 ghost previews at suggested positions
// Each with score badge and hotkey (1, 2, 3)
```

### Krok 3: Uživatel vybere suggestion

**Option A: Klikne na ghost preview**
```javascript
<AISuggestionPreview onClick={() => applyAISuggestion(0)} />
// → Calls addCabinetAtPosition(cabinet, suggestion.position, suggestion.rotation)
```

**Option B: Stiskne klávesu 1-3**
```javascript
// DropZoneHandler listens for keypress
window.addEventListener('keydown', (e) => {
  if (e.key === '1') applyAISuggestion(0)
  if (e.key === '2') applyAISuggestion(1)
  if (e.key === '3') applyAISuggestion(2)
})
```

**Option C: Použije arrow keys + Enter**
```javascript
// Arrow Up/Down = Navigate suggestions
// Enter = Apply highlighted suggestion
```

### Krok 4: Cabinet umístěn

```javascript
// addCabinetAtPosition() už existuje v store.js
// Využívá:
// - CollisionDetector pro validaci
// - SpatialGrid.add() pro indexaci
// - SnapSystem pro final snap
// → Žádné změny potřeba!
```

---

## Example 6: Advanced - Custom Scoring Function

### Custom scoring pro specifické use cases

```javascript
// Scenario: Showroom preference - maximize visual impact

const engine = new PlacementSuggestionEngine(...)

// Override scoring method
const originalScore = engine._scoreAesthetics.bind(engine)
engine._scoreAesthetics = function(cabinet, candidate, existing) {
  let result = originalScore(cabinet, candidate, existing)

  // Bonus pro centrální pozice (showroom effect)
  const distFromCenter = Math.abs(candidate.position[0])
  if (distFromCenter < 0.5) {
    result.score += 30
    result.reasons.push('🌟 Centrální pozice - maximální visual impact')
  }

  // Penalty pro skryté pozice
  if (candidate.position[2] > 0) { // Vpředu (daleko od zadní stěny)
    result.score -= 20
    result.reasons.push('⚠️ Méně viditelná pozice')
  }

  return result
}
```

---

## Example 7: Testing AI Suggestions

### Unit test pro PlacementSuggestionEngine

```javascript
import { PlacementSuggestionEngine } from '../ai/PlacementSuggestionEngine'
import { SpatialGrid } from '../placement/SpatialGrid'
import { CollisionDetector } from '../placement/CollisionDetector'
import { PlacementSystem } from '../placement/PlacementSystem'

describe('PlacementSuggestionEngine', () => {
  let engine
  let spatialGrid
  let collision
  let placement

  beforeEach(() => {
    spatialGrid = new SpatialGrid(4, 3, 0.5)
    collision = new CollisionDetector(spatialGrid, { width: 4, depth: 3, height: 2.6 })
    placement = new PlacementSystem(spatialGrid, collision)
    engine = new PlacementSuggestionEngine(spatialGrid, collision, placement, mockCatalog)
  })

  test('identifies sink purpose correctly', () => {
    const cabinet = { name: 'Dřez 800mm', width: 800, type: 'base' }
    const purpose = engine._identifyPurpose(cabinet)
    expect(purpose).toBe('sink')
  })

  test('suggests position near window for sink', () => {
    const sinkCabinet = { name: 'Dřez', width: 800, type: 'base', depth: 560, height: 720 }
    const existing = []

    const suggestions = engine.getSuggestions(sinkCabinet, existing)

    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0].position[0]).toBeCloseTo(0, 1) // Near center (window)
    expect(suggestions[0].reasons).toContain(expect.stringContaining('okno'))
  })

  test('penalizes stove next to fridge', () => {
    const fridge = {
      name: 'Lednička',
      position: [-1.5, 0, -1],
      width: 600,
      type: 'tall'
    }
    const stove = {
      name: 'Sporák',
      width: 600,
      type: 'base',
      depth: 560,
      height: 720
    }

    const suggestions = engine.getSuggestions(stove, [fridge])

    // Najdi suggestion blízko lednice
    const nearFridge = suggestions.find(s =>
      engine._distance(s.position, fridge.position) < 0.6
    )

    if (nearFridge) {
      expect(nearFridge.score).toBeLessThan(50) // Low score
      expect(nearFridge.reasons.some(r => r.includes('lednic'))).toBe(true)
    }
  })

  test('returns max 3 suggestions', () => {
    const cabinet = { name: 'Test', width: 600, type: 'base', depth: 560, height: 720 }
    const suggestions = engine.getSuggestions(cabinet, [])
    expect(suggestions.length).toBeLessThanOrEqual(3)
  })

  test('filters out invalid positions', () => {
    const cabinet = {
      name: 'Huge',
      width: 5000, // Neférově velká
      type: 'base',
      depth: 560,
      height: 720
    }
    const suggestions = engine.getSuggestions(cabinet, [])
    expect(suggestions.length).toBe(0) // Žádná validní pozice
  })
})
```

---

## Example 8: Performance Optimization

### Throttling AI suggestions během real-time drag

```javascript
import { throttle } from '../utils/throttle'

// V DropZoneHandler nebo DragStateManager

const throttledGetSuggestions = throttle((cabinet, roomContext) => {
  useStore.getState().getAISuggestions(cabinet, roomContext)
}, 300) // Max 1 call per 300ms

// Usage
useEffect(() => {
  if (draggedCabinet && currentMousePosition) {
    throttledGetSuggestions(draggedCabinet, roomContext)
  }
}, [draggedCabinet, currentMousePosition])
```

### Memoization pro expensive scoring

```javascript
// PlacementSuggestionEngine.js

constructor(...) {
  // ...
  this._scoreCache = new Map()
}

_scorePosition(cabinet, candidate, existing, purpose, roomContext) {
  // Cache key
  const key = JSON.stringify({
    cabinetId: cabinet.id,
    position: candidate.position,
    rotation: candidate.rotation,
    existingCount: existing.length
  })

  // Check cache
  if (this._scoreCache.has(key)) {
    return this._scoreCache.get(key)
  }

  // Compute
  const result = this._computeScore(cabinet, candidate, existing, purpose, roomContext)

  // Cache
  this._scoreCache.set(key, result)

  // LRU eviction (max 100 entries)
  if (this._scoreCache.size > 100) {
    const firstKey = this._scoreCache.keys().next().value
    this._scoreCache.delete(firstKey)
  }

  return result
}
```

---

## Example 9: Debugging AI Suggestions

### Visual debug overlay

```jsx
function AIDebugOverlay() {
  const aiSuggestions = useStore(s => s.aiSuggestions)
  const [showDebug, setShowDebug] = React.useState(false)

  if (!showDebug) {
    return (
      <button
        style={{ position: 'absolute', top: 10, right: 10 }}
        onClick={() => setShowDebug(true)}
      >
        🐛 Debug AI
      </button>
    )
  }

  return (
    <div className="ai-debug-overlay" style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '20px',
      borderRadius: '8px',
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <h3>🐛 AI Debug Info</h3>
      <button onClick={() => setShowDebug(false)}>Close</button>

      {aiSuggestions.map((suggestion, i) => (
        <div key={i} style={{ marginTop: '20px', borderTop: '1px solid #444', paddingTop: '10px' }}>
          <h4>Suggestion {i + 1}</h4>
          <div><strong>Score:</strong> {suggestion.score.toFixed(2)}/100</div>
          <div><strong>Position:</strong> [{suggestion.position.map(p => p.toFixed(2)).join(', ')}]</div>
          <div><strong>Rotation:</strong> {(suggestion.rotation * 180 / Math.PI).toFixed(0)}°</div>
          <div><strong>Strategy:</strong> {suggestion.strategy}</div>
          <div><strong>Purpose:</strong> {suggestion.purpose}</div>
          <div><strong>Reasons:</strong></div>
          <ul>
            {suggestion.reasons.map((r, j) => (
              <li key={j}>{r}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

---

## Shrnutí

**Klíčové integrace:**
1. ✅ Store.js - AI state a actions
2. ✅ Scene3D - Ghost preview rendering
3. ✅ DropZoneHandler - Keyboard shortcuts
4. ✅ AISettingsPanel - Konfigurace
5. ✅ Testing - Unit tests
6. ✅ Performance - Throttling & caching
7. ✅ Debugging - Visual overlay

**Všechny integrace jsou:**
- ✅ Non-invasive (neruší existující funkcionalitu)
- ✅ Modular (lze zapnout/vypnout)
- ✅ Performant (throttling, caching)
- ✅ Testovatelné (unit tests)
- ✅ User-friendly (keyboard shortcuts, visual feedback)

**Estimated development time:** 2-3 dny pro základní integraci
