# AI Kitchen Designer - Technical Documentation

Technická dokumentace pro AI asistent modul.

## 📁 Struktura

```
src/ai/
├── index.js                      # Main exports
├── ClaudeKitchenAssistant.js    # API wrapper
├── LayoutGenerator.js            # AI design → 3D positions
├── prompts.js                    # Prompt templates
└── README.md                     # This file
```

## 🔧 API Reference

### ClaudeKitchenAssistant

**Constructor:**
```javascript
const assistant = new ClaudeKitchenAssistant(apiKey, catalog)
```

**Parameters:**
- `apiKey` (string): Anthropic API key (sk-ant-...)
- `catalog` (object): Catalog object with cabinets array

**Methods:**

#### `startConversation(roomDimensions)`
Začne novou konverzaci.

```javascript
const initialMessage = await assistant.startConversation({
  width: 4000,  // mm
  depth: 3000,
  height: 2600
})
```

**Returns:** První zpráva od asistenta (string)

#### `sendMessage(userMessage)`
Pošle zprávu od uživatele.

```javascript
const response = await assistant.sendMessage("Jsme 4 v rodině...")
```

**Returns:** Odpověď od asistenta (string)

#### `generateLayout()`
Generuje strukturovaný návrh layoutu.

```javascript
const design = await assistant.generateLayout()
```

**Returns:**
```javascript
{
  summary: string,
  totalPrice: number,
  cabinets: [
    {
      catalogId: string,
      type: 'base' | 'wall' | 'tall',
      width: number,
      height: number,
      depth: number,
      position: 'left-back' | 'center-back' | 'right-back' | 'left-wall' | 'right-wall' | 'island',
      purpose: string,  // "Dřez", "Trouba", etc.
      order: number
    }
  ],
  appliances: [
    {
      name: string,
      cabinetOrder: number,
      estimatedPrice: number
    }
  ],
  layout: {
    shape: 'L' | 'U' | 'single' | 'double',
    style: string,
    specialFeatures: string[]
  }
}
```

#### `getCurrentDesign()`
Vrátí aktuálně vygenerovaný návrh.

```javascript
const design = assistant.getCurrentDesign()
```

#### `reset()`
Resetuje konverzaci.

```javascript
assistant.reset()
```

---

### LayoutGenerator

**Constructor:**
```javascript
const generator = new LayoutGenerator(roomDimensions)
```

**Parameters:**
- `roomDimensions` (object): `{ width, depth, height }` v mm

**Methods:**

#### `generate(aiDesign, catalog)`
Převede AI design na cabinet placements.

```javascript
const placements = generator.generate(aiDesign, catalog)
```

**Returns:** Array of cabinet objects ready for `addCabinetAtPosition()`

```javascript
[
  {
    ...cabinetFromCatalog,
    position: [x, y, z],  // meters
    rotation: number,     // radians
    aiPurpose: string     // "Dřez", "Trouba", etc.
  }
]
```

#### `generatePreview(aiDesign, catalog)`
Generuje preview data s statistikami.

```javascript
const preview = generator.generatePreview(aiDesign, catalog)
```

**Returns:**
```javascript
{
  cabinets: Array,
  summary: string,
  totalPrice: number,
  layout: object,
  stats: {
    totalCabinets: number,
    baseCabinets: number,
    wallCabinets: number,
    tallCabinets: number
  }
}
```

#### `static validateDesign(aiDesign)`
Validuje AI design před generováním.

```javascript
const validation = LayoutGenerator.validateDesign(aiDesign)
// { valid: boolean, errors: string[] }
```

---

### Helper Functions

#### `getApiKey()`
Získá API klíč z localStorage nebo prompt.

```javascript
import { getApiKey } from './ai'

try {
  const apiKey = getApiKey()
} catch (error) {
  console.error('Invalid API key')
}
```

#### `clearApiKey()`
Vymaže uložený API klíč.

```javascript
import { clearApiKey } from './ai'

clearApiKey()
```

#### `ClaudeKitchenAssistant.validateApiKey(key)`
Validuje formát API klíče.

```javascript
const isValid = ClaudeKitchenAssistant.validateApiKey('sk-ant-...')
```

---

## 🎭 Prompt Engineering

### System Prompt Structure

```
OSOBNOST → EXPERTISE → PROCES → PRAVIDLA → RADY
```

**Klíčové elementy:**

1. **Osobnost**: Přátelský expert s 15 lety zkušeností
2. **Expertise**: Ergonomie, layouty, spotřebiče, rozpočty
3. **Proces**: 4 fáze (základní info → tech detaily → spotřebiče → speciální)
4. **Pravidla**: Respektuj rozměry, používej pouze katalog
5. **Rady**: Typické situace a best practices

### Context Injection

AI dostává automaticky:

```javascript
DOSTUPNÝ KATALOG SKŘÍNĚK:
### SPODNÍ SKŘÍŇKY (base):
- base-800: 800×720×560mm (12,000 Kč)
...

ROZMĚRY MÍSTNOSTI:
Šířka: 4000mm
Hloubka: 3000mm
Výška: 2600mm

PRAVIDLA:
- Používej POUZE skříňky z dostupného katalogu
- Respektuj rozměry místnosti
...
```

### Layout Generation Prompt

Strukturovaný návod jak generovat layout:

```
1. ZAČNI U DŘEZU (kde jsou rozvody)
2. PŘIDEJ SPORÁK (max 1.5m od dřezu)
3. UMÍSTI LEDNIČKU (u vstupu)
4. DOPLŇ PRACOVNÍ PLOCHY
5. PŘIDEJ ÚLOŽNÝ PROSTOR
6. VYPOČÍTEJ POŘADÍ

POZICE KÓDY:
- "left-back": Levá část zadní stěny
...

KONTROLY:
- ✓ Celková šířka nepřesahuje stěnu
- ✓ Spotřebiče v rozumné vzdálenosti
...
```

---

## 🔄 Data Flow

```
User Input (text)
    ↓
ClaudeKitchenAssistant.sendMessage()
    ↓
Claude API (Anthropic)
    ↓
Assistant Response (text)
    ↓
[Repeat until user satisfied]
    ↓
ClaudeKitchenAssistant.generateLayout()
    ↓
Claude API (with structured prompt)
    ↓
JSON Design
    ↓
LayoutGenerator.generate()
    ↓
Cabinet Placements (3D positions)
    ↓
PlacementSystem (validation, collision check)
    ↓
3D Scene
```

---

## 🎯 Position Mapping

LayoutGenerator mapuje AI pozice na 3D souřadnice:

| AI Position | Algorithm | Rotation |
|-------------|-----------|----------|
| `left-back` | Start at `-roomW/2`, fill right | 0° |
| `center-back` | Center total width, fill right | 0° |
| `right-back` | Start at `+roomW/2 - totalW`, fill right | 0° |
| `left-wall` | Start at `-roomD/2`, fill forward | -90° |
| `right-wall` | Start at `-roomD/2`, fill forward | +90° |
| `island` | Center in room | 0° |

**Gaps:** 2mm mezi skříňkami

**Y Position:**
- `base`, `tall`: 0 (floor)
- `wall`: 1.4m (above counter)

---

## 🧪 Testing

### Manual Test

```javascript
// 1. Inicializace
const assistant = new ClaudeKitchenAssistant(apiKey, catalog)
await assistant.startConversation({ width: 4000, depth: 3000, height: 2600 })

// 2. Konverzace
await assistant.sendMessage("Jsme 4 v rodině, budget 200k")
await assistant.sendMessage("Moderní styl, vestavná myčka")

// 3. Generování
const design = await assistant.generateLayout()
console.log(design)

// 4. Validace
const validation = LayoutGenerator.validateDesign(design)
console.log(validation) // { valid: true/false, errors: [] }

// 5. Generování placements
const generator = new LayoutGenerator({ width: 4000, depth: 3000, height: 2600 })
const placements = generator.generate(design, catalog)
console.log(placements)
```

### Unit Tests (TODO)

```javascript
// Test API key validation
test('validateApiKey accepts valid keys', () => {
  expect(ClaudeKitchenAssistant.validateApiKey('sk-ant-xxx')).toBe(true)
  expect(ClaudeKitchenAssistant.validateApiKey('invalid')).toBe(false)
})

// Test layout validation
test('validateDesign catches missing fields', () => {
  const invalid = { cabinets: [{ type: 'base' }] } // missing catalogId
  const result = LayoutGenerator.validateDesign(invalid)
  expect(result.valid).toBe(false)
})

// Test position mapping
test('leftBack position maps correctly', () => {
  const generator = new LayoutGenerator({ width: 4000, depth: 3000, height: 2600 })
  const cabinets = [{ catalogId: 'test', position: 'left-back', order: 1 }]
  const placements = generator.generate({ cabinets }, catalog)
  expect(placements[0].position[0]).toBe(-2.0) // -roomW/2
})
```

---

## 🐛 Error Handling

### API Errors

```javascript
try {
  const response = await assistant.sendMessage(message)
} catch (error) {
  if (error.message.includes('401')) {
    // Invalid API key
  } else if (error.message.includes('429')) {
    // Rate limit
  } else if (error.message.includes('500')) {
    // Server error
  }
}
```

### Design Validation

```javascript
const validation = LayoutGenerator.validateDesign(design)

if (!validation.valid) {
  console.error('Invalid design:', validation.errors)
  // Show error to user
  // Možná restart konverzace
}
```

### Catalog Mismatch

```javascript
// LayoutGenerator má fallback pro missing cabinets
const placement = generator._findInCatalog(catalogId, catalog)

if (!placement) {
  console.warn(`Cabinet ${catalogId} not found, using default`)
  // Fallback: { width: 600, height: 720, depth: 560, type: 'base' }
}
```

---

## 🔒 Security

### API Key Storage

```javascript
// localStorage (browser-side only)
localStorage.setItem('claudeApiKey', apiKey)
const apiKey = localStorage.getItem('claudeApiKey')
```

**Never:**
- ❌ Commit API keys to git
- ❌ Log API keys to console
- ❌ Send API keys to any server except Anthropic

### CORS & Requests

```javascript
// Direct browser → Anthropic API
fetch('https://api.anthropic.com/v1/messages', {
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  }
})
```

**Note:** CORS je povoleno Anthropic API pro browser requests.

---

## 📊 Performance

### API Call Times

- `startConversation()`: ~1-3s
- `sendMessage()`: ~1-5s (depends on complexity)
- `generateLayout()`: ~5-15s (large context)

### Optimization Tips

1. **Cache catalog context** - generuj jednou při inicializaci
2. **Throttle rapid messages** - wait for response
3. **Use lower temperature** for JSON generation (0.3 vs 0.7)
4. **Limit conversation history** - keep last N messages

---

## 🔮 Future Improvements

### Short-term
- [ ] Conversation history persistence
- [ ] Multiple design alternatives
- [ ] Design comparison UI
- [ ] Undo/modify design

### Long-term
- [ ] Fine-tuned model on cabinet data
- [ ] Vision API for room photos
- [ ] Real-time 3D preview during chat
- [ ] Voice input/output
- [ ] Multi-language support

---

## 📚 Resources

- [Anthropic API Docs](https://docs.anthropic.com/)
- [Claude Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Structured Outputs Guide](https://docs.anthropic.com/claude/docs/control-output-format)
- [Kitchen Design Principles](https://www.nkba.org/guidelines)

---

**Version:** 1.0.0
**Last Updated:** 2026-02-05
**Status:** ✅ Production Ready
