# 🤖 AI INTEGRATION PROPOSAL - 3D Kitchen Designer

## Executive Summary

Tento dokument navrhuje komplexní integraci AI do 3D Kitchen Designer aplikace. Projekt má **vynikající technickou základnu** (modulární placement systém, spatial indexing, collision detection) a je **ideální kandidát pro AI augmentaci**.

**Klíčové příležitosti:**
1. ✅ **Existující placement systém** - Připravený pro AI automatizaci
2. ✅ **Strukturovaný katalog** - 200+ skříněk s metadaty
3. ✅ **Collision detection** - Validace AI návrhů
4. ✅ **Spatial grid** - Real-time performance pro AI operace
5. 🟡 **Basic AI** - ClaudeKitchenAssistant funguje, ale je prostor pro zlepšení

---

## 📊 PRIORITY MATRIX

| Priorita | Feature | Impact | Effort | ROI |
|----------|---------|--------|--------|-----|
| 🔴 P0 | **Smart Layout Generator** | 🟢 High | 🟢 Low | ⭐⭐⭐⭐⭐ |
| 🔴 P0 | **Real-time Placement Suggestions** | 🟢 High | 🟡 Med | ⭐⭐⭐⭐⭐ |
| 🟠 P1 | **Natural Language Manipulation** | 🟢 High | 🟡 Med | ⭐⭐⭐⭐ |
| 🟠 P1 | **Layout Optimization** | 🟡 Med | 🟢 Low | ⭐⭐⭐⭐ |
| 🟠 P1 | **Visual AI Assistant** | 🟡 Med | 🟡 Med | ⭐⭐⭐⭐ |
| 🟢 P2 | **Style Transfer** | 🟡 Med | 🔴 High | ⭐⭐⭐ |
| 🟢 P2 | **Cost Optimizer** | 🟡 Med | 🟢 Low | ⭐⭐⭐ |
| 🟢 P2 | **AR Preview Generator** | 🟡 Med | 🔴 High | ⭐⭐ |

---

# 🎯 PHASE 1: FOUNDATION (Quick Wins)

## 1.1 Smart Layout Generator (P0)

**Problém:** Současný ClaudeKitchenAssistant generuje generický JSON. Nevyužívá placement systém.

**Řešení:** AI-powered layout generator s přímou integrací do placement systému.

### Architektura

```
User Input (Natural Language)
    ↓
Claude API (prompt engineering)
    ↓
AI Planning Layer
    ├── Parse requirements
    ├── Select cabinets from catalog
    ├── Calculate space constraints
    └── Generate placement instructions
    ↓
Layout Executor
    ├── PlacementSystem.findBestPosition()
    ├── CollisionDetector.canPlace()
    ├── SnapSystem.snap()
    └── SpatialGrid.add()
    ↓
3D Scene (validated layout)
```

### Implementation

**Soubor:** `src/ai/SmartLayoutGenerator.js`

```javascript
export class SmartLayoutGenerator {
  constructor(placementSystem, collisionDetector, spatialGrid, catalog) {
    this.placement = placementSystem
    this.collision = collisionDetector
    this.spatial = spatialGrid
    this.catalog = catalog
  }

  /**
   * Generuje layout z natural language
   *
   * @example
   * generateFromPrompt("Chci L-shaped kuchyň s dřezem u okna,
   *                     sporákem vedle a velkou lednicí v rohu")
   */
  async generateFromPrompt(userPrompt, roomDimensions) {
    // 1. Parse požadavky pomocí Claude
    const requirements = await this._parseRequirements(userPrompt, roomDimensions)

    // 2. Vytvoř placement plán
    const plan = this._createPlacementPlan(requirements)

    // 3. Validuj a optimalizuj
    const validatedPlan = this._validateAndOptimize(plan)

    // 4. Execute placement (real collision checking!)
    const placedCabinets = this._executePlacement(validatedPlan)

    return {
      cabinets: placedCabinets,
      metadata: {
        requirements,
        plan,
        validationReport: this._generateReport(validatedPlan)
      }
    }
  }

  /**
   * Scoring funkce pro optimalizaci layoutu
   */
  _scorePlacement(cabinets) {
    let score = 0

    // 1. Ergonomie (work triangle)
    score += this._scoreWorkTriangle(cabinets) * 0.3

    // 2. Space utilization
    score += this._scoreSpaceEfficiency(cabinets) * 0.25

    // 3. Accessibility (dveře se otevřou?)
    score += this._scoreDoorClearance(cabinets) * 0.2

    // 4. Aesthetics (symetrie, balance)
    score += this._scoreAesthetics(cabinets) * 0.15

    // 5. Cost efficiency
    score += this._scoreCostEfficiency(cabinets) * 0.1

    return score
  }

  /**
   * Validace work triangle (dřez-sporák-lednička)
   * Optimální: 4-7 metrů celkem
   */
  _scoreWorkTriangle(cabinets) {
    const sink = cabinets.find(c => c.purpose === 'sink')
    const stove = cabinets.find(c => c.purpose === 'stove')
    const fridge = cabinets.find(c => c.purpose === 'fridge')

    if (!sink || !stove || !fridge) return 0

    const distances = [
      this._distance(sink.position, stove.position),
      this._distance(stove.position, fridge.position),
      this._distance(fridge.position, sink.position)
    ]

    const total = distances.reduce((sum, d) => sum + d, 0)

    // Optimální: 4-7m
    if (total >= 4 && total <= 7) return 100
    if (total < 4) return 50 // Moc blízko
    return Math.max(0, 100 - (total - 7) * 10) // Moc daleko
  }
}
```

### Klíčové vylepšení oproti současnému

| Feature | Současný | Nový SmartLayoutGenerator |
|---------|----------|---------------------------|
| Collision check | ❌ Po umístění | ✅ Během generování |
| Placement validation | ❌ Žádná | ✅ Real-time |
| Space optimization | ❌ | ✅ Scoring funkce |
| Work triangle | ❌ | ✅ Ergonomie check |
| Door clearance | ❌ | ✅ Accessibility |
| Cost optimization | ❌ | ✅ Budget-aware |
| Iterative refinement | ❌ | ✅ Monte Carlo sampling |

---

## 1.2 Real-time Placement Suggestions (P0)

**Use Case:** Uživatel táhne skříňku. AI navrhuje optimální pozice.

### Vizualizace

```
User drags cabinet "Sink 800mm"
     ↓
AI detects: "Likely sink cabinet"
     ↓
AI suggests 3 positions (real-time):
  1. ⭐⭐⭐⭐⭐ Near window (optimal light)
  2. ⭐⭐⭐⭐   Near plumbing wall
  3. ⭐⭐⭐     Corner position

User sees ghost previews at all 3 positions
User presses 1/2/3 or clicks to select
```

### Implementation

**Soubor:** `src/ai/PlacementSuggestionEngine.js`

```javascript
export class PlacementSuggestionEngine {
  constructor(spatialGrid, collision, placement, catalog) {
    this.spatial = spatialGrid
    this.collision = collision
    this.placement = placement
    this.catalog = catalog
  }

  /**
   * Real-time suggestions během drag operace
   */
  getSuggestions(cabinet, existingCabinets, roomContext) {
    // 1. Identifikuj typ skříňky a její "účel"
    const purpose = this._identifyPurpose(cabinet)

    // 2. Najdi všechny možné pozice
    const candidates = this.placement.findAllPossiblePositions(
      cabinet,
      existingCabinets
    )

    // 3. Filtruj validní (collision-free)
    const valid = candidates.filter(pos => {
      return this.collision.canPlace(cabinet, pos.position, pos.rotation).valid
    })

    // 4. Score každou pozici
    const scored = valid.map(pos => ({
      ...pos,
      score: this._scorePosition(cabinet, pos, existingCabinets, roomContext),
      reasoning: this._explainScore(cabinet, pos, existingCabinets)
    }))

    // 5. Vrať top 3
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }

  /**
   * Inteligentní detekce účelu skříňky
   */
  _identifyPurpose(cabinet) {
    const name = cabinet.name?.toLowerCase() || ''
    const code = cabinet.code?.toLowerCase() || ''

    // Pattern matching
    if (name.includes('dřez') || name.includes('sink')) return 'sink'
    if (name.includes('sporák') || name.includes('stove')) return 'stove'
    if (name.includes('lednič') || name.includes('fridge')) return 'fridge'
    if (name.includes('myčka') || name.includes('dishwasher')) return 'dishwasher'
    if (name.includes('roh') || name.includes('corner')) return 'corner'

    // Heuristiky podle rozměrů
    if (cabinet.width >= 800 && cabinet.type === 'base') return 'sink-candidate'
    if (cabinet.width >= 600 && cabinet.type === 'base') return 'appliance-space'
    if (cabinet.type === 'tall') return 'storage-tall'

    return 'general-storage'
  }

  /**
   * Scoring s kontextovým reasoning
   */
  _scorePosition(cabinet, position, existing, context) {
    const purpose = this._identifyPurpose(cabinet)
    let score = 50 // Base
    let reasons = []

    // Sink preferuje pozici u okna
    if (purpose === 'sink' && this._isNearWindow(position, context)) {
      score += 30
      reasons.push('Dřez u okna = přirozené světlo')
    }

    // Lednička ne vedle sporáku
    if (purpose === 'fridge') {
      const stove = existing.find(c => this._identifyPurpose(c) === 'stove')
      if (stove && this._distance(position.position, stove.position) < 0.6) {
        score -= 40
        reasons.push('⚠️ Lednička moc blízko sporáku')
      }
    }

    // Myčka vedle dřezu
    if (purpose === 'dishwasher') {
      const sink = existing.find(c => this._identifyPurpose(c) === 'sink')
      if (sink && this._distance(position.position, sink.position) < 0.9) {
        score += 25
        reasons.push('Myčka vedle dřezu = efektivnější')
      }
    }

    // Wall cabinets nad base cabinets
    if (cabinet.type === 'wall') {
      const hasBaseBelow = existing.some(c =>
        c.type === 'base' &&
        this._isDirectlyBelow(c.position, position.position, cabinet.width)
      )
      if (hasBaseBelow) {
        score += 20
        reasons.push('Horní skříňka nad spodní = koherentní vzhled')
      }
    }

    return { score, reasons }
  }
}
```

### UI Integration

**Visual feedback:**
```jsx
// Scene3D.jsx - Během drag
{placementSuggestions.map((suggestion, i) => (
  <group key={i} position={suggestion.position}>
    {/* Ghost preview */}
    <mesh opacity={0.3}>
      <boxGeometry args={[cabinet.width/1000, cabinet.height/1000, cabinet.depth/1000]} />
      <meshBasicMaterial color={suggestion.score > 80 ? 'green' : 'yellow'} transparent />
    </mesh>

    {/* Score badge */}
    <Html position={[0, 1, 0]}>
      <div className="suggestion-badge">
        <div className="score">⭐ {Math.round(suggestion.score)}/100</div>
        <div className="hotkey">Press {i+1}</div>
        {suggestion.reasons.map(r => <div className="reason">{r}</div>)}
      </div>
    </Html>
  </group>
))}
```

---

## 1.3 Layout Optimization (P1)

**Use Case:** "Optimalizuj můj stávající layout"

### Algoritmus

```javascript
export class LayoutOptimizer {
  /**
   * Genetic Algorithm pro optimalizaci layoutu
   */
  async optimize(currentLayout, constraints, options = {}) {
    const {
      maxIterations = 100,
      populationSize = 50,
      mutationRate = 0.1,
      objectives = ['ergonomics', 'space', 'cost']
    } = options

    // 1. Inicializuj populaci (variations of current layout)
    let population = this._initializePopulation(currentLayout, populationSize)

    // 2. Evolve přes generace
    for (let gen = 0; gen < maxIterations; gen++) {
      // Evaluate fitness
      const scored = population.map(layout => ({
        layout,
        fitness: this._evaluateFitness(layout, objectives)
      }))

      // Select nejlepší
      const parents = this._selectParents(scored)

      // Crossover + mutation
      population = this._breed(parents, mutationRate)

      // Validuj (collision free)
      population = population.filter(layout =>
        this._isValid(layout)
      )

      // Early stop pokud konvergováno
      if (this._hasConverged(scored)) break
    }

    // 3. Vrať nejlepší layout
    const best = population[0]

    return {
      optimizedLayout: best,
      improvements: this._compareLayouts(currentLayout, best),
      report: this._generateOptimizationReport(currentLayout, best)
    }
  }

  /**
   * Mutations:
   * - Swap two cabinets
   * - Rotate cabinet
   * - Move cabinet slightly
   * - Replace cabinet with similar one
   */
  _mutate(layout, rate) {
    return layout.map(cabinet => {
      if (Math.random() < rate) {
        const mutationType = this._chooseMutation()
        return this._applyMutation(cabinet, mutationType)
      }
      return cabinet
    })
  }
}
```

---

# 🎯 PHASE 2: ADVANCED FEATURES (High Impact)

## 2.1 Natural Language Manipulation (P1)

**Use Case:** Chat interface pro úpravy layoutu

**Příklad:**
```
User: "Přesuň dřez doleva"
AI: ✅ Dřez přesunut o 1.2m doleva

User: "Otočí tu velkou skříňku o 90 stupňů"
AI: ✅ Skříňka A1-800 otočena

User: "Potřebuju víc místa pro lednici"
AI: 💡 Našel jsem 3 možnosti:
     1. Přesunout skříňku X → uvolní 900mm
     2. Vyměnit skříňku Y za užší → uvolní 600mm
     3. Změnit layout na L-shape → uvolní 1200mm

User: "Udělej variantu 1"
AI: ✅ Hotovo! Lednice má teперь 900mm prostoru
```

### Implementation

**Soubor:** `src/ai/NaturalLanguageController.js`

```javascript
export class NaturalLanguageController {
  constructor(store, catalog, claude) {
    this.store = store
    this.catalog = catalog
    this.claude = claude
  }

  async executeCommand(userMessage) {
    // 1. Parse intent pomocí Claude
    const intent = await this._parseIntent(userMessage)

    // 2. Execute based on intent type
    switch (intent.type) {
      case 'move':
        return this._handleMove(intent)

      case 'rotate':
        return this._handleRotate(intent)

      case 'delete':
        return this._handleDelete(intent)

      case 'add':
        return this._handleAdd(intent)

      case 'swap':
        return this._handleSwap(intent)

      case 'optimize':
        return this._handleOptimize(intent)

      case 'question':
        return this._handleQuestion(intent)

      default:
        return this._handleUnknown(userMessage)
    }
  }

  /**
   * Intent parsing pomocí Claude (structured output)
   */
  async _parseIntent(message) {
    const prompt = `Parse tento příkaz uživatele a vrať JSON:

Uživatel: "${message}"

Současný stav:
${this._getCurrentStateDescription()}

Vrať:
{
  "type": "move|rotate|delete|add|swap|optimize|question",
  "target": "ID nebo popis skříňky",
  "action": {
    "direction": "left|right|forward|back",
    "amount": "number nebo 'auto'",
    "rotation": "90|-90|180",
    ...
  },
  "constraints": ["constraint1", "constraint2"]
}
`

    const response = await this.claude.sendMessage(prompt, {
      expectJSON: true,
      temperature: 0.1 // Low temp pro přesnost
    })

    return JSON.parse(response)
  }

  /**
   * Execute move command
   */
  async _handleMove(intent) {
    // 1. Najdi target cabinet
    const cabinet = this._findCabinet(intent.target)
    if (!cabinet) {
      return {
        success: false,
        message: `Nenašel jsem skříňku: ${intent.target}`
      }
    }

    // 2. Vypočítej novou pozici
    const newPosition = this._calculateNewPosition(
      cabinet.position,
      intent.action.direction,
      intent.action.amount
    )

    // 3. Validuj
    const validation = this.store._collision.canPlace(
      cabinet,
      newPosition,
      cabinet.rotation,
      cabinet.instanceId
    )

    if (!validation.valid) {
      // AI suggestion pro fix
      const suggestion = await this._suggestFix(cabinet, newPosition, validation)
      return {
        success: false,
        message: `Nemohu přesunout: ${validation.message}`,
        suggestion
      }
    }

    // 4. Execute
    this.store.updateCabinetPosition(cabinet.instanceId, newPosition)

    return {
      success: true,
      message: `✅ ${cabinet.name} přesunut`,
      newPosition
    }
  }
}
```

### Příklady příkazů

```javascript
// Podporované příkazy:
const SUPPORTED_COMMANDS = [
  // Movement
  "přesuň dřez doleva",
  "posuň tu skříňku o 50cm doprava",
  "dej lednici do rohu",

  // Rotation
  "otoč skříňku o 90 stupňů",
  "rotuj všechny skříňky u pravé stěny",

  // Add/Delete
  "přidej skříňku 800mm vedle dřezu",
  "odeber tu malou skříňku",
  "vymaž všechny horní skříňky",

  // Swap
  "vyměň dřez za širší",
  "nahraď tuhle skříňku za vyšší",

  // Optimize
  "optimalizuj pracovní trojúhelník",
  "maximalizuj úložný prostor",
  "minimalizuj cenu",

  // Questions
  "kolik stojí tahle kuchyně?",
  "vejde se sem ještě jedna skříňka?",
  "která skříňka je nejdražší?",
  "je tenhle layout ergonomický?"
]
```

---

## 2.2 Visual AI Assistant (P1)

**Koncept:** Persistent AI buddy s real-time feedback

### UI Design

```
┌─────────────────────────────────────────┐
│  3D SCENE                               │
│                                         │
│              [Skříňky]                  │
│                                         │
│  ┌──────────────────────────────┐      │
│  │  🤖 AI Assistant             │ ◀─── Floating panel
│  │  ────────────────────────    │      (minimizable)
│  │  💡 Tip:                     │
│  │  Dřez je moc daleko od       │
│  │  sporáku (1.8m). Ideálně     │
│  │  1.2-1.5m.                   │
│  │                              │
│  │  [Opravit automaticky]       │
│  │  [Ignorovat]                 │
│  │  ────────────────────────    │
│  │  📊 Layout Score: 78/100     │
│  │  ⭐ Ergonomie: 85/100        │
│  │  ⭐ Využití prostoru: 72/100  │
│  │  ⭐ Estetika: 80/100         │
│  └──────────────────────────────┘      │
└─────────────────────────────────────────┘
```

### Features

1. **Real-time Analysis**
   - Sleduje každou změnu layoutu
   - Analyzuje ergonomii, prostor, estetiku
   - Zobrazuje live score

2. **Proactive Suggestions**
   - "Všiml jsem si, že nemáš myčku. Vejde se sem."
   - "Tenhle layout by byl levnější s jinými skříňkami."
   - "Zkusil bys L-shape místo lineární?"

3. **Quick Actions**
   - One-click fixes
   - "Optimalizuj work triangle" button
   - "Vycentruj skříňky" button

---

## 2.3 Cost Optimizer (P2)

**Use Case:** "Najdi nejlevnější alternativu"

```javascript
export class CostOptimizer {
  async findCheaperAlternatives(currentLayout) {
    const alternatives = []

    for (const cabinet of currentLayout) {
      // Najdi podobné skříňky z jiné značky
      const similar = this.catalog.cabinets.filter(c =>
        Math.abs(c.width - cabinet.width) < 50 &&
        Math.abs(c.height - cabinet.height) < 50 &&
        c.type === cabinet.type &&
        c.price < cabinet.price
      )

      if (similar.length > 0) {
        alternatives.push({
          original: cabinet,
          alternatives: similar.sort((a, b) => a.price - b.price),
          savings: cabinet.price - similar[0].price
        })
      }
    }

    return {
      alternatives,
      totalSavings: alternatives.reduce((sum, a) => sum + a.savings, 0),
      report: this._generateCostReport(alternatives)
    }
  }
}
```

---

# 🎯 PHASE 3: CUTTING EDGE (Future)

## 3.1 Style Transfer

**Use Case:** "Chci kuchyň ve stylu jako tato fotka"

**Tech:**
- Vision API (Claude Vision)
- Style extraction
- Cabinet matching

## 3.2 AR Preview Generator

**Use Case:** "Vygeneruj AR preview pro mobile"

**Output:**
- QR kód → mobile app
- AR overlay v reálném prostoru

## 3.3 Multi-modal Chat

**Use Case:** Screenshot + "Co je špatně?"

**Tech:**
- Claude Vision
- Scene analysis
- Visual debugging

---

# 🛠 TECHNICAL IMPLEMENTATION GUIDE

## Doporučená architektura

```
src/ai/
├── core/
│   ├── AIEngine.js              # Main orchestrator
│   ├── ClaudeClient.js          # API wrapper
│   └── PromptLibrary.js         # Reusable prompts
│
├── generators/
│   ├── SmartLayoutGenerator.js  # Phase 1.1
│   └── StyleTransferEngine.js   # Phase 3.1
│
├── analyzers/
│   ├── LayoutAnalyzer.js        # Scoring system
│   ├── ErgonomicsAnalyzer.js    # Work triangle, etc.
│   └── SpaceAnalyzer.js         # Utilization metrics
│
├── controllers/
│   ├── NaturalLanguageController.js  # Phase 2.1
│   └── PlacementSuggestionEngine.js  # Phase 1.2
│
├── optimizers/
│   ├── LayoutOptimizer.js       # Phase 1.3
│   ├── CostOptimizer.js         # Phase 2.3
│   └── GeneticAlgorithm.js      # Helper
│
└── ui/
    ├── AIAssistantPanel.jsx     # Floating panel
    ├── SuggestionOverlay.jsx    # Ghost previews
    └── ChatInterface.jsx        # NL chat
```

## Integrace s existujícím systémem

### Store integration

```javascript
// store.js
const useStore = create((set, get) => ({
  // ... existing state

  // AI state
  aiSuggestions: [],
  aiAnalysis: null,
  aiAssistantVisible: true,

  // AI actions
  getAISuggestions: async (cabinet) => {
    const engine = new PlacementSuggestionEngine(...)
    const suggestions = await engine.getSuggestions(cabinet, ...)
    set({ aiSuggestions: suggestions })
  },

  executeAICommand: async (command) => {
    const controller = new NaturalLanguageController(...)
    return await controller.executeCommand(command)
  },

  optimizeLayout: async (objectives) => {
    const optimizer = new LayoutOptimizer(...)
    const result = await optimizer.optimize(get().placedCabinets, objectives)
    set({ placedCabinets: result.optimizedLayout })
    return result
  }
}))
```

### Collision integration

```javascript
// AI má přístup ke CollisionDetector
const aiEngine = new AIEngine({
  collision: store._collision,
  spatial: store._spatialGrid,
  placement: store._placementSystem
})

// AI může validovat návrhy před zobrazením
const isValid = aiEngine.validatePlacement(cabinet, position)
```

---

# 📊 EXPECTED OUTCOMES

## Metrics

| Metrika | Před AI | Po AI (odhad) | Zlepšení |
|---------|---------|---------------|----------|
| Čas na vytvoření layoutu | 15-30 min | 2-5 min | -80% |
| Ergonomické skóre | 60/100 | 85/100 | +42% |
| Využití prostoru | 65% | 82% | +26% |
| User satisfaction | - | ⭐⭐⭐⭐⭐ | - |
| Conversion rate (demo→prodej) | - | +35% (odhad) | - |

## Competitive Advantage

**Současné kitchen designers:**
- IKEA Kitchen Planner: Basic drag & drop, no AI
- Home Depot Kitchen Designer: 2D pouze
- Planner5D: AI layout, ale generický (ne kitchen-specific)

**Váš produkt s AI:**
✅ Kitchen-specific AI (work triangle, ergonomie)
✅ Real-time collision detection
✅ Natural language control
✅ Oresi katalog integrace
✅ 3D real-time preview

**= Unique positioning!**

---

# 🚀 GETTING STARTED

## Minimal Viable AI (MVA) - Week 1

**Co implementovat první:**

1. **Day 1-2:** PlacementSuggestionEngine (základní verze)
   - Pouze top 1 suggestion
   - Simple scoring (distance-based)
   - Zobrazit jako ghost preview

2. **Day 3-4:** SmartLayoutGenerator (proof-of-concept)
   - Pouze linear layouts
   - Bez optimalizace
   - Claude API integration

3. **Day 5:** UI Integration
   - Floating AI panel
   - Real-time suggestions během drag
   - "Generate Layout" tlačítko

**Test:** Uživatel klikne "Generate L-shaped kitchen" → AI vytvoří validní layout za <5s

---

# 💰 COST ANALYSIS

## Claude API Costs

**Model:** Claude Haiku 4.5 (nejlevnější, fastest)

| Operation | Tokens | Cost/req | Reqs/day | Daily Cost |
|-----------|--------|----------|----------|------------|
| Layout generation | ~2K | $0.002 | 100 | $0.20 |
| Real-time suggestions | ~500 | $0.0005 | 1000 | $0.50 |
| NL command | ~1K | $0.001 | 200 | $0.20 |
| **TOTAL** | - | - | 1300 | **$0.90/day** |

**Monthly:** ~$27 pro 1300 requests/day
**Yearly:** ~$330

**Scaling:** 10,000 users × $27/month = $270K/year
→ Lze snížit caching, prompt optimization

---

# 🎓 LEARNING & ITERATION

## A/B Testing Ideas

1. **Suggestion Frequency**
   - A: Suggestions on every drag
   - B: Suggestions only when requested
   - Metric: User annoyance vs. adoption

2. **AI Personality**
   - A: Professional (formal tone)
   - B: Friendly (casual tone)
   - Metric: User engagement

3. **Automation Level**
   - A: Full auto-placement
   - B: Suggestions + manual confirmation
   - Metric: User satisfaction

---

# ✅ CONCLUSION

**Top Recommendations:**

1. **Start with Phase 1.1 & 1.2** (SmartLayoutGenerator + PlacementSuggestions)
   - Highest ROI
   - Low effort
   - Využívají existující infrastructure

2. **Use Claude Haiku 4.5**
   - Nejrychlejší
   - Nejlevnější
   - Dostačující pro kitchen design

3. **Iterate based on user feedback**
   - Start simple
   - Measure metrics
   - Add features incrementally

**Expected Timeline:**
- Week 1: MVA (minimal viable AI)
- Week 2-3: Phase 1 complete
- Month 2: Phase 2 (advanced features)
- Month 3+: Phase 3 (cutting edge)

**Estimated Development Time:**
- Phase 1: 2-3 týdny
- Phase 2: 3-4 týdny
- Phase 3: 6-8 týdnů

**Total:** 3-4 měsíce na kompletní AI integraci

---

**Tento projekt má IDEÁLNÍ předpoklady pro AI:**
✅ Strukturovaná data (katalog)
✅ Modulární architektura (placement systém)
✅ Real-time validace (collision detection)
✅ Jasné metriky (ergonomie, prostor, cost)

**= Vysoká šance na úspěch! 🚀**
