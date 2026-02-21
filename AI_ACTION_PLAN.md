# 🚀 AI INTEGRATION - ACTION PLAN

## Executive Summary

Tento dokument obsahuje **konkrétní akční plán** pro implementaci AI do 3D Kitchen Designer.
Rozděleno do 3 fází s časovým odhadem a prioritami.

**Celkový čas:** 3-4 týdny pro Phase 1 + 2 (high-impact features)

---

# 📅 PHASE 1: MVP (Week 1) - Quick Wins

**Cíl:** Základní AI funkcionality, které okamžitě přidají hodnotu

## ✅ Task 1.1: Setup AI Infrastructure (Day 1)

**Čas:** 2-3 hodiny

**Co udělat:**
1. Vytvořit adresář `src/ai/`
2. Zkopírovat `PlacementSuggestionEngine.js` (už vytvořený)
3. Přidat AI state do `store.js`

**Konkrétní změny:**

```javascript
// store.js - Přidat na konec state objektu

// === AI STATE ===
aiSuggestions: [],
aiSuggestionsEnabled: true,
aiSelectedSuggestion: null,
_aiEngine: null,

// === AI ACTIONS ===
initAI: () => {
  const state = get()
  if (!state._aiEngine) {
    const { PlacementSuggestionEngine } = await import('./ai/PlacementSuggestionEngine.js')
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

getAISuggestions: (cabinet) => {
  const state = get()
  if (!state._aiEngine) state.initAI()
  if (!state.aiSuggestionsEnabled) return []

  const suggestions = state._aiEngine.getSuggestions(
    cabinet,
    state.placedCabinets,
    {} // Room context - můžeš přidat později
  )

  set({ aiSuggestions: suggestions })
  return suggestions
},

applyAISuggestion: (index) => {
  const state = get()
  const suggestion = state.aiSuggestions[index]
  if (!suggestion || !state.draggedCabinet) return

  state.addCabinetAtPosition(
    state.draggedCabinet,
    suggestion.position,
    suggestion.rotation
  )

  set({ aiSuggestions: [], draggedCabinet: null })
},

toggleAISuggestions: () => {
  set(state => ({ aiSuggestionsEnabled: !state.aiSuggestionsEnabled }))
},
```

**Test:** `console.log(useStore.getState()._aiEngine)` by měl zobrazit PlacementSuggestionEngine instance

---

## ✅ Task 1.2: Basic Ghost Preview (Day 1-2)

**Čas:** 4-6 hodin

**Co udělat:**
1. Vytvořit `AISuggestionPreview.jsx` komponentu
2. Integrovat do `Scene3D.jsx`

**Nový soubor:** `src/components/AISuggestionPreview.jsx`

```jsx
import { Html } from '@react-three/drei'
import { useStore } from '../store'

function AISuggestionPreview({ suggestion, index, onSelect }) {
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
          opacity={0.4}
        />
      </mesh>

      {/* Score badge */}
      <Html position={[0, height + 0.2, 0]} center>
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          whiteSpace: 'nowrap'
        }}>
          {suggestion.starRating} {Math.round(suggestion.score)}/100
          <br />
          <span style={{ color: '#FFD700' }}>Press {index + 1}</span>
        </div>
      </Html>
    </group>
  )
}

export default AISuggestionPreview
```

**Změny v `Scene3D.jsx`:**

```jsx
import AISuggestionPreview from './AISuggestionPreview'

function Scene3D() {
  const aiSuggestions = useStore(s => s.aiSuggestions)
  const applyAISuggestion = useStore(s => s.applyAISuggestion)

  return (
    <Canvas>
      {/* ... existing content ... */}

      {/* AI Suggestions */}
      {aiSuggestions.map((suggestion, i) => (
        <AISuggestionPreview
          key={i}
          suggestion={suggestion}
          index={i}
          onSelect={() => applyAISuggestion(i)}
        />
      ))}
    </Canvas>
  )
}
```

**Test:** Při drag operaci by se měly zobrazit 3 ghost previews s badges

---

## ✅ Task 1.3: Trigger AI Suggestions (Day 2)

**Čas:** 2-3 hodiny

**Co udělat:**
1. Zavolat `getAISuggestions()` když začne drag
2. Clear suggestions když drag skončí

**Změny v `CatalogPanel.jsx` nebo kde se volá `setDraggedCabinet`:**

```jsx
// Původní:
const handleDragStart = (cabinet) => {
  setDraggedCabinet(cabinet)
}

// Nové:
const handleDragStart = (cabinet) => {
  setDraggedCabinet(cabinet)

  // Trigger AI suggestions
  setTimeout(() => {
    useStore.getState().getAISuggestions(cabinet)
  }, 100) // Small delay to ensure draggedCabinet is set
}
```

**Nebo elegantněji - v store.js:**

```javascript
// V setDraggedCabinet action
setDraggedCabinet: (cabinet) => {
  set({ draggedCabinet: cabinet })

  // Auto-trigger AI suggestions
  if (cabinet) {
    get().getAISuggestions(cabinet)
  } else {
    set({ aiSuggestions: [] }) // Clear when drag ends
  }
}
```

**Test:** Při tažení skříňky by se měly okamžitě zobrazit 3 suggestions

---

## ✅ Task 1.4: Keyboard Shortcuts (Day 2)

**Čas:** 1-2 hodiny

**Co udělat:**
1. Přidat keyboard listener pro klávesy 1-3
2. Volat `applyAISuggestion()` při stisku

**Nový soubor:** `src/hooks/useAIKeyboardShortcuts.js`

```javascript
import { useEffect } from 'react'
import { useStore } from '../store'

export function useAIKeyboardShortcuts() {
  const draggedCabinet = useStore(s => s.draggedCabinet)
  const applyAISuggestion = useStore(s => s.applyAISuggestion)
  const aiSuggestions = useStore(s => s.aiSuggestions)

  useEffect(() => {
    if (!draggedCabinet || aiSuggestions.length === 0) return

    const handleKeyPress = (e) => {
      // Number keys 1-3
      if (e.key >= '1' && e.key <= '3') {
        const index = parseInt(e.key) - 1
        if (index < aiSuggestions.length) {
          e.preventDefault()
          applyAISuggestion(index)
        }
      }

      // Escape = Cancel
      if (e.key === 'Escape') {
        useStore.getState().setDraggedCabinet(null)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [draggedCabinet, aiSuggestions])
}
```

**Použití v `App.jsx`:**

```jsx
import { useAIKeyboardShortcuts } from './hooks/useAIKeyboardShortcuts'

function App() {
  useAIKeyboardShortcuts()

  return (
    // ... existing JSX ...
  )
}
```

**Test:** Při drag operaci stisk kláves 1/2/3 by měl umístit skříňku

---

## ✅ Task 1.5: AI Toggle UI (Day 3)

**Čas:** 2 hodiny

**Co udělat:**
1. Přidat checkbox do `PropertiesPanel.jsx`

**Změny v `PropertiesPanel.jsx`:**

```jsx
function PropertiesPanel() {
  const aiEnabled = useStore(s => s.aiSuggestionsEnabled)
  const toggleAI = useStore(s => s.toggleAISuggestions)

  return (
    <div className="properties-panel">
      {/* ... existing content ... */}

      {/* AI Section */}
      <div className="section">
        <h3>🤖 AI Asistent</h3>
        <label>
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={toggleAI}
          />
          Inteligentní návrhy pozic
        </label>
        {aiEnabled && (
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Při přidávání skříněk AI navrhne 3 nejlepší pozice.
            Stiskni <kbd>1</kbd>, <kbd>2</kbd>, nebo <kbd>3</kbd> pro rychlé umístění.
          </p>
        )}
      </div>
    </div>
  )
}
```

**Test:** Toggle checkbox by měl zapínat/vypínat ghost previews

---

## 🎉 End of Phase 1 MVP

**Po Week 1 bys měl mít:**
- ✅ AI suggestions funkční
- ✅ Ghost previews zobrazené
- ✅ Keyboard shortcuts (1-3 klávesy)
- ✅ Toggle on/off v UI

**Demo scenario:**
1. User táhne "Dřez 800mm" z katalogu
2. Okamžitě se zobrazí 3 ghost previews s score badges
3. User vidí že první pozice je u okna (⭐⭐⭐⭐⭐ 95/100)
4. Stiskne klávesu "1"
5. Dřez se umístí perfektně u okna

**→ Uživatel je wow-ed! 🎉**

---

# 📅 PHASE 2: Enhanced Features (Week 2-3)

## ✅ Task 2.1: Purpose Detection Tuning (Day 4-5)

**Čas:** 4 hodiny

**Co udělat:**
1. Vylepšit `_identifyPurpose()` metodu
2. Přidat více pattern matching rules
3. Testovat na reálném katalogu

**Soubor:** `PlacementSuggestionEngine.js`

**Rozšíř pattern matching:**

```javascript
_identifyPurpose(cabinet) {
  const name = (cabinet.name || '').toLowerCase()
  const code = (cabinet.code || '').toLowerCase()
  const group = (cabinet.group || '').toLowerCase()

  // === EXPLICIT MATCHING ===
  // Dřez
  if (name.includes('dřez') || name.includes('sink') || code.includes('sink')) {
    return 'sink'
  }

  // Sporák / Trouba
  if (name.includes('sporák') || name.includes('stove') ||
      name.includes('trouba') || name.includes('oven') ||
      code.includes('oven')) {
    return 'stove'
  }

  // Lednička
  if (name.includes('lednič') || name.includes('fridge') || name.includes('chlad')) {
    return 'fridge'
  }

  // Myčka
  if (name.includes('myčka') || name.includes('dishwasher')) {
    return 'dishwasher'
  }

  // Rohové skříňky
  if (name.includes('roh') || name.includes('corner') || code.includes('corner')) {
    return 'corner'
  }

  // Cargo / Výsuvné
  if (name.includes('cargo') || name.includes('výsuv') || name.includes('pullout')) {
    return 'storage-pullout'
  }

  // === HEURISTICS (když není explicitní) ===
  // Široké base = pravděpodobně dřez
  if (cabinet.width >= 800 && cabinet.type === 'base') {
    return 'sink-candidate'
  }

  // Střední base = prostor pro spotřebiče
  if (cabinet.width >= 600 && cabinet.width < 800 && cabinet.type === 'base') {
    return 'appliance-space'
  }

  // Úzké base = zásuvky / úložný prostor
  if (cabinet.width < 500 && cabinet.type === 'base') {
    return 'drawer-unit'
  }

  // Tall = storage
  if (cabinet.type === 'tall') {
    return cabinet.width >= 600 ? 'storage-tall' : 'pantry'
  }

  // Wall = horní skříňky
  if (cabinet.type === 'wall') {
    return 'wall-storage'
  }

  return 'general-storage'
}
```

**Test:**
- Vytvoř unit test s reálným katalogem
- Ověř že identifikace funguje správně pro top 20 skříněk

---

## ✅ Task 2.2: Work Triangle Scoring (Day 5-6)

**Čas:** 6 hodin

**Co udělat:**
1. Implementovat precizní work triangle calculation
2. Přidat vizualizaci (debug mode)

**Soubor:** `PlacementSuggestionEngine.js`

**Vylepšit `_scoreWorkTriangle()`:**

```javascript
_scoreWorkTriangle(cabinet, position, existing, purpose) {
  const elements = {
    sink: existing.find(c => this._identifyPurpose(c) === 'sink'),
    stove: existing.find(c => this._identifyPurpose(c) === 'stove'),
    fridge: existing.find(c => this._identifyPurpose(c) === 'fridge')
  }

  // Add current cabinet
  elements[purpose] = { position }

  // Count present elements
  const present = Object.values(elements).filter(e => e).length
  if (present < 2) return { score: 50, partial: true } // Neutral - nedost dat

  // Calculate distances
  const distances = {
    sinkToStove: elements.sink && elements.stove
      ? this._distance(elements.sink.position, elements.stove.position)
      : null,
    stoveToFridge: elements.stove && elements.fridge
      ? this._distance(elements.stove.position, elements.fridge.position)
      : null,
    fridgeToSink: elements.fridge && elements.sink
      ? this._distance(elements.fridge.position, elements.sink.position)
      : null
  }

  // Filter null distances
  const validDistances = Object.values(distances).filter(d => d !== null)
  if (validDistances.length === 0) return { score: 50, partial: true }

  const total = validDistances.reduce((sum, d) => sum + d, 0)
  const avg = total / validDistances.length

  // === SCORING FORMULA ===
  let score = 50
  let details = {}

  // Optimální: 4-7m celkem
  if (total >= 4 && total <= 7) {
    score = 100
    details.quality = 'optimal'
  } else if (total >= 3 && total <= 8) {
    score = 80
    details.quality = 'good'
  } else if (total < 3) {
    score = 40
    details.quality = 'too-close'
    details.issue = 'Prvky pracovního trojúhelníku jsou moc blízko'
  } else {
    score = Math.max(0, 100 - (total - 7) * 10)
    details.quality = 'too-far'
    details.issue = 'Prvky pracovního trojúhelníku jsou moc daleko'
  }

  // Bonus za balanced triangle (ne lineární)
  if (validDistances.length === 3) {
    const maxDist = Math.max(...validDistances)
    const minDist = Math.min(...validDistances)
    const ratio = minDist / maxDist
    if (ratio > 0.6) { // Roughly equilateral
      score += 10
      details.balanced = true
    }
  }

  return { score, total, avg, distances, details, complete: present === 3 }
}
```

**Debug visualization (optional):**

```jsx
// WorkTriangleDebugOverlay.jsx
function WorkTriangleDebugOverlay() {
  const cabinets = useStore(s => s.placedCabinets)

  const sink = cabinets.find(c => /* identify sink */)
  const stove = cabinets.find(c => /* identify stove */)
  const fridge = cabinets.find(c => /* identify fridge */)

  if (!sink || !stove || !fridge) return null

  return (
    <group>
      {/* Draw lines between elements */}
      <Line points={[sink.position, stove.position]} color="yellow" lineWidth={2} />
      <Line points={[stove.position, fridge.position]} color="yellow" lineWidth={2} />
      <Line points={[fridge.position, sink.position]} color="yellow" lineWidth={2} />
    </group>
  )
}
```

---

## ✅ Task 2.3: Aesthetic Scoring (Day 7-8)

**Čas:** 6-8 hodin

**Co udělat:**
1. Implementovat alignment detection
2. Implementovat symmetry calculation
3. Implementovat balance scoring

**Algoritmy:**

### Alignment Detection

```javascript
_checkAlignment(position, existing) {
  if (existing.length === 0) return { aligned: true, count: 0 }

  const [x, y, z] = position
  const tolerance = 0.05 // 5cm

  // Check Z alignment (řada)
  const zAligned = existing.filter(cab =>
    Math.abs(cab.position[2] - z) < tolerance
  )

  // Check X alignment (sloupec)
  const xAligned = existing.filter(cab =>
    Math.abs(cab.position[0] - x) < tolerance
  )

  return {
    aligned: zAligned.length > 0 || xAligned.length > 0,
    zAligned: zAligned.length,
    xAligned: xAligned.length,
    total: Math.max(zAligned.length, xAligned.length)
  }
}
```

### Symmetry Calculation

```javascript
_checkSymmetry(position, existing) {
  if (existing.length === 0) return 0

  const [x, y, z] = position

  // Find mirrored position (přes X osu - střed místnosti)
  const mirroredX = -x

  // Check if there's a cabinet at mirrored position
  const mirrorCabinet = existing.find(cab => {
    const dist = Math.sqrt(
      Math.pow(cab.position[0] - mirroredX, 2) +
      Math.pow(cab.position[2] - z, 2)
    )
    return dist < 0.2 // 20cm tolerance
  })

  if (mirrorCabinet) {
    // Check if it's similar type/size
    const similarSize = Math.abs(mirrorCabinet.width - cabinet.width) < 100
    return similarSize ? 1.0 : 0.7
  }

  return 0
}
```

### Balance Scoring

```javascript
_checkBalance(cabinet, position, existing) {
  if (existing.length === 0) return 1.0

  // Calculate weight distribution
  const allCabinets = [...existing, { position, width: cabinet.width }]

  // Center of mass
  const totalWeight = allCabinets.reduce((sum, cab) =>
    sum + (cab.width || 600), 0
  )

  const centerOfMass = allCabinets.reduce((sum, cab) =>
    sum + cab.position[0] * (cab.width || 600), 0
  ) / totalWeight

  // Ideal center = 0 (střed místnosti)
  const deviation = Math.abs(centerOfMass)

  // Score: 1.0 if perfectly balanced, 0.0 if very unbalanced
  return Math.max(0, 1 - deviation / 2)
}
```

---

## ✅ Task 2.4: AI Feedback Panel (Day 9)

**Čas:** 4 hodiny

**Co udělat:**
1. Vytvořit floating panel s AI feedback
2. Zobrazit layout score
3. Zobrazit tips

**Nový soubor:** `src/components/AIFeedbackPanel.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useStore } from '../store'

function AIFeedbackPanel() {
  const cabinets = useStore(s => s.placedCabinets)
  const [analysis, setAnalysis] = useState(null)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (cabinets.length === 0) {
      setAnalysis(null)
      return
    }

    // Analyze layout
    const result = analyzeLayout(cabinets)
    setAnalysis(result)
  }, [cabinets])

  if (!analysis) return null

  return (
    <div className={`ai-feedback-panel ${minimized ? 'minimized' : ''}`}>
      {minimized ? (
        <button onClick={() => setMinimized(false)}>
          🤖 AI Assistant ({analysis.score}/100)
        </button>
      ) : (
        <>
          <div className="header">
            <h3>🤖 AI Assistant</h3>
            <button onClick={() => setMinimized(true)}>−</button>
          </div>

          <div className="score-section">
            <h4>Layout Score: {analysis.score}/100</h4>
            <div className="score-bar">
              <div
                className="score-fill"
                style={{
                  width: `${analysis.score}%`,
                  background: getScoreColor(analysis.score)
                }}
              />
            </div>
          </div>

          <div className="breakdown">
            <ScoreItem
              label="Ergonomie"
              score={analysis.ergonomics}
              icon="⚡"
            />
            <ScoreItem
              label="Využití prostoru"
              score={analysis.spaceEfficiency}
              icon="📏"
            />
            <ScoreItem
              label="Estetika"
              score={analysis.aesthetics}
              icon="🎨"
            />
            <ScoreItem
              label="Přístupnost"
              score={analysis.accessibility}
              icon="🚪"
            />
          </div>

          {analysis.tips.length > 0 && (
            <div className="tips">
              <h4>💡 Tipy</h4>
              {analysis.tips.map((tip, i) => (
                <div key={i} className="tip">
                  {tip.text}
                  {tip.action && (
                    <button onClick={tip.action}>
                      {tip.actionLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ScoreItem({ label, score, icon }) {
  return (
    <div className="score-item">
      <span>{icon} {label}</span>
      <span className="score">{score}/100</span>
    </div>
  )
}

function analyzeLayout(cabinets) {
  // TODO: Implement comprehensive layout analysis
  // Pro teď placeholder
  return {
    score: 75,
    ergonomics: 80,
    spaceEfficiency: 70,
    aesthetics: 75,
    accessibility: 75,
    tips: [
      {
        text: 'Dřez je daleko od sporáku (1.8m). Ideálně 1.2-1.5m.',
        action: () => console.log('Fix work triangle'),
        actionLabel: 'Opravit'
      }
    ]
  }
}

function getScoreColor(score) {
  if (score >= 80) return '#4CAF50'
  if (score >= 60) return '#FFC107'
  if (score >= 40) return '#FF9800'
  return '#F44336'
}

export default AIFeedbackPanel
```

**CSS:** `src/components/AIFeedbackPanel.css`

```css
.ai-feedback-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  padding: 16px;
  z-index: 1000;
}

.ai-feedback-panel.minimized {
  width: auto;
  padding: 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.score-section {
  margin-bottom: 16px;
}

.score-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.score-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.breakdown {
  margin-bottom: 16px;
}

.score-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.tips {
  margin-top: 16px;
}

.tip {
  background: #fff3cd;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
}

.tip button {
  margin-top: 8px;
  padding: 4px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

---

## 🎉 End of Phase 2

**Po Week 2-3 bys měl mít:**
- ✅ Vylepšené purpose detection
- ✅ Precizní work triangle scoring
- ✅ Aesthetic analysis (alignment, symmetry, balance)
- ✅ AI feedback panel s live scoring
- ✅ Proactive tips

**Demo scenario:**
1. User vytvoří L-shaped kuchyň
2. AI feedback panel zobrazí score 78/100
3. Tip: "Dřez je moc daleko od sporáku"
4. User klikne "Opravit" → AI navrhne optimální pozici
5. Score se zvýší na 92/100

---

# 📅 PHASE 3: Advanced (Week 4+) - Optional

Tyto features jsou "nice to have" ale ne kritické:

## Task 3.1: Layout Optimizer

- Genetic algorithm pro optimalizaci
- "Optimalizuj můj layout" tlačítko
- Čas: 1 týden

## Task 3.2: Natural Language Control

- Chat interface
- "Přesuň dřez doleva"
- Čas: 1-2 týdny

## Task 3.3: Cost Optimizer

- Najdi levnější alternativy
- Budget-aware suggestions
- Čas: 3-4 dny

## Task 3.4: Style Transfer

- Claude Vision API
- "Navrhni jako tato fotka"
- Čas: 1-2 týdny

---

# 📊 EXPECTED TIMELINE

```
Week 1: Phase 1 MVP
├─ Day 1: Setup (2-3h)
├─ Day 1-2: Ghost Preview (4-6h)
├─ Day 2: Trigger + Keyboard (3-5h)
└─ Day 3: UI Toggle (2h)
Total: 11-16 hours

Week 2-3: Phase 2 Enhanced
├─ Day 4-5: Purpose Detection (4h)
├─ Day 5-6: Work Triangle (6h)
├─ Day 7-8: Aesthetics (6-8h)
└─ Day 9: Feedback Panel (4h)
Total: 20-22 hours

Week 4+: Phase 3 Advanced (optional)
├─ Layout Optimizer (1 week)
├─ NL Control (1-2 weeks)
├─ Cost Optimizer (3-4 days)
└─ Style Transfer (1-2 weeks)
Total: 3-5 weeks
```

---

# ✅ DAILY CHECKLIST

## Week 1 - Day by Day

### Monday (Day 1)
- [ ] Create `src/ai/` directory
- [ ] Copy `PlacementSuggestionEngine.js`
- [ ] Add AI state to `store.js`
- [ ] Test: `console.log(useStore.getState()._aiEngine)`
- [ ] Create `AISuggestionPreview.jsx`
- [ ] Integrate into `Scene3D.jsx`

### Tuesday (Day 2)
- [ ] Test ghost preview rendering
- [ ] Trigger AI on drag start
- [ ] Create `useAIKeyboardShortcuts` hook
- [ ] Test keyboard shortcuts (1-3 keys)

### Wednesday (Day 3)
- [ ] Add AI toggle to `PropertiesPanel`
- [ ] Test toggle functionality
- [ ] Write basic README for AI features
- [ ] **DEMO to stakeholders** 🎉

### Thursday (Day 4) - START WEEK 2
- [ ] Tune purpose detection
- [ ] Test on real catalog
- [ ] Write unit tests

### Friday (Day 5-6)
- [ ] Implement work triangle scoring
- [ ] Add work triangle visualization (optional)
- [ ] Test scoring accuracy

### Monday (Day 7-8) - WEEK 2 CONTINUED
- [ ] Implement alignment detection
- [ ] Implement symmetry calculation
- [ ] Implement balance scoring
- [ ] Test aesthetic scoring

### Tuesday (Day 9)
- [ ] Create `AIFeedbackPanel` component
- [ ] Integrate into App
- [ ] Test real-time analysis
- [ ] **DEMO Phase 2** 🎉

---

# 💡 TIPS & BEST PRACTICES

## Performance

1. **Throttle suggestions** - Max 1 call per 300ms
2. **Cache scores** - LRU cache max 100 entries
3. **Lazy load AI engine** - Only initialize when needed

## UX

1. **Show loading state** - "AI analyzing..."
2. **Keyboard shortcuts** - Always show hints
3. **Minimize distractions** - Ghost previews subtle
4. **Progressive disclosure** - Minimizable panels

## Testing

1. **Unit tests** - Každý scorer samostatně
2. **Integration tests** - End-to-end workflow
3. **Performance tests** - Max 100ms per suggestion
4. **User testing** - A/B test suggestion frequency

## Debugging

1. **Console logs** - Důležité AI decisions
2. **Debug overlay** - Visual AI reasoning
3. **Metrics tracking** - Score distribution
4. **Error handling** - Graceful fallbacks

---

# 🎯 SUCCESS METRICS

**Phase 1 Success:**
- ✅ AI suggestions zobrazeny < 500ms po drag start
- ✅ 90%+ suggestions jsou collision-free
- ✅ Users používají keyboard shortcuts (analytics)

**Phase 2 Success:**
- ✅ Work triangle score > 80 pro 70%+ auto-generated layouts
- ✅ Layout score improvement > 15 points po AI suggestions
- ✅ User engagement s AI panel > 60%

**Overall Success:**
- ✅ 30%+ reduction v čase na vytvoření layoutu
- ✅ 40%+ users používají AI suggestions actively
- ✅ 4.5+ star rating pro AI features

---

# 🚀 LET'S GO!

**Start here:**
```bash
cd prototype2
git checkout -b feature/ai-integration
mkdir src/ai
# Copy PlacementSuggestionEngine.js
# Start with Task 1.1
```

**Questions? Issues?**
- Check `AI_INTEGRATION_PROPOSAL.md` for details
- Check `AI_INTEGRATION_EXAMPLES.md` for code examples
- Ask me! 🤖

---

**Ready to build the future of kitchen design? Let's do this! 🔥**
