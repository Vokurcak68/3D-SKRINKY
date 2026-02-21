# 🤖 AI Kitchen Designer Assistant

Inteligentní AI asistent pro návrh kuchyní s využitím Anthropic Claude API.

## 🎯 Koncept

AI asistent funguje jako **expertní prodejce kuchyní** který:
1. **Vyptá se klienta** na jejich požadavky, rozpočet, styl
2. **Poradí** ohledně layoutu, spotřebičů, ergonomie
3. **Navrhne** konkrétní kuchyň skříňku po skříňce
4. **Vygeneruje** layout přímo do 3D návrháře

## ✨ Funkce

### Conversational Design
- Přirozená konverzace v češtině
- Postupné vyptávání (ne všechno najednou)
- Odborné rady založené na 15 letech zkušeností (simulovaných)
- Nabízí konkrétní možnosti místo obecných otázek

### Expert Knowledge
- **Ergonomie**: Pracovní trojúhelník (dřez-sporák-lednička)
- **Layouty**: L-shape, U-shape, galley, island
- **Spotřebiče**: Integrace trouby, myčky, ledničky
- **Rozpočet**: Realistické odhady cen
- **Praktičnost**: Soft-close, výsuvné zásuvky, osvětlení

### Strukturovaný Output
```json
{
  "summary": "Moderní U-kuchyň pro 4-člennou rodinu...",
  "totalPrice": 180000,
  "cabinets": [
    {
      "catalogId": "base-800",
      "type": "base",
      "width": 800,
      "position": "center-back",
      "purpose": "Dřez",
      "order": 1
    },
    ...
  ],
  "appliances": [
    {
      "name": "Trouba",
      "cabinetOrder": 3,
      "estimatedPrice": 15000
    }
  ],
  "layout": {
    "shape": "U",
    "style": "modern"
  }
}
```

## 🚀 Použití

### 1. Získání API klíče

1. Jdi na https://console.anthropic.com/
2. Vytvoř account (pokud nemáš)
3. Získej API klíč (formát: `sk-ant-...`)
4. Ulož si ho bezpečně

### 2. Spuštění AI Assistanta

1. Klikni na **"🤖 AI Designer"** v headeru aplikace
2. Při prvním spuštění zadej svůj API klíč
3. API klíč se uloží do localStorage (pro příště)

### 3. Konverzace

**Asistent se ptá postupně:**

```
Asistent: "Dobrý den! Vítám vás v návrháři kuchyní Oresi.
           Vidím, že máte místnost 4×3 metry.

           Řekněte mi, žijete sami nebo s rodinou?
           A jak moc rádi vaříte?"

Klient: "Žiju s manželkou a 2 dětmi. Vaříme každý den."

Asistent: "Skvělé! Pro rodinu se 4 členy doporučuji L nebo U layout.
           Jaký máte přibližný rozpočet?"

Klient: "Cca 200 000 Kč."

Asistent: "Výborně! Ještě pár otázek:
           1. Kde jsou rozvody vody?
           2. Jaké spotřebiče potřebujete?
           3. Preferujete klasický nebo moderní styl?"

...

Asistent: "Perfektní! Mám všechny informace.
           Připravím vám kompletní návrh. Souhlasíte?"

Klient: "Ano!"
```

### 4. Generování návrhu

1. Klikni na **"✨ Vygeneruj návrh"**
2. AI sestaví strukturovaný návrh (10-30s)
3. Zobrazí se preview s:
   - Shrnutím
   - Počtem skříněk
   - Celkovou cenou
   - Stats

### 5. Aplikování návrhu

1. Prohlédni si návrh
2. Klikni **"✅ Použít tento návrh"**
3. Současný layout se vymaže
4. AI návrh se automaticky umístí do 3D prostoru
5. Můžeš ho dále upravovat

## 🏗️ Architektura

```
AIAssistantModal (UI)
    ↓
ClaudeKitchenAssistant (API Communication)
    ↓
Claude API (Anthropic)
    ↓
Structured JSON Design
    ↓
LayoutGenerator (JSON → 3D Positions)
    ↓
PlacementSystem (Auto-placement)
    ↓
3D Scéna
```

### Komponenty

#### 1. **ClaudeKitchenAssistant**
API wrapper pro komunikaci s Claude.

```javascript
const assistant = new ClaudeKitchenAssistant(apiKey, catalog)

// Začni konverzaci
await assistant.startConversation(roomDimensions)

// Pošli zprávu
await assistant.sendMessage("Jsme 4 v rodině...")

// Vygeneruj layout
const design = await assistant.generateLayout()
```

#### 2. **LayoutGenerator**
Převádí AI návrh na 3D pozice.

```javascript
const generator = new LayoutGenerator(roomDimensions)

// Vygeneruj placements
const placements = generator.generate(aiDesign, catalog)

// Preview
const preview = generator.generatePreview(aiDesign, catalog)
```

#### 3. **AIAssistantModal**
React komponenta - chat UI.

```jsx
<AIAssistantModal
  isOpen={showAIAssistant}
  onClose={() => setShowAIAssistant(false)}
/>
```

## 📝 Prompt Engineering

### System Prompt
Definuje osobnost a expertízu AI:

```
Jsi expert prodejce kuchyní s 15 lety zkušeností.
Tvým úkolem je pomoct klientovi navrhnout vysněnou kuchyň.

OSOBNOST:
- Přátelský, trpělivý, profesionální
- Aktivně nasloucháš
- Vysvětluješ výhody/nevýhody
- Myslíš na praktičnost
...
```

### Layout Generation Instructions
Detailní pravidla pro generování:

```
1. ZAČNI U DŘEZU (kde jsou rozvody)
2. PŘIDEJ SPORÁK (max 1.5m od dřezu)
3. UMÍSTI LEDNIČKU (ideálně u vstupu)
4. DOPLŇ PRACOVNÍ PLOCHY
5. PŘIDEJ ÚLOŽNÝ PROSTOR
...
```

## 🎨 Position Kódy

AI používá tyto kódy pro umístění:

| Kód | Popis | Rotace |
|-----|-------|--------|
| `left-back` | Levá část zadní stěny | 0° |
| `center-back` | Střed zadní stěny | 0° |
| `right-back` | Pravá část zadní stěny | 0° |
| `left-wall` | Levá boční stěna | -90° |
| `right-wall` | Pravá boční stěna | +90° |
| `island` | Ostrov uprostřed | 0° |

LayoutGenerator převede tyto kódy na přesné [x, y, z] pozice.

## 🔧 Konfigurace

### API Key Management

```javascript
// Získání klíče (prompt pokud není uložen)
const apiKey = getApiKey()

// Vymazání klíče
clearApiKey()
```

### Room Dimensions

```javascript
const assistant = new ClaudeKitchenAssistant(apiKey, catalog)

await assistant.startConversation({
  width: 4000,   // mm
  depth: 3000,   // mm
  height: 2600   // mm
})
```

### Catalog Context

AI automaticky dostává:
- Všechny dostupné skříňky
- Rozměry (width × height × depth)
- Ceny
- Typy (base, wall, tall)

## 💡 Tipy pro uživatele

### Dobré odpovědi klientů:
✅ "Jsme 4 v rodině, vaříme každý den"
✅ "Budget cca 200 tisíc"
✅ "Moderní styl, bílá + dřevo"
✅ "Potřebujeme vestavnou myčku"

### Špatné odpovědi:
❌ "Nevím" (buď konkrétnější)
❌ "Cokoliv" (dej AI nějakou představu)
❌ Jednoslovné odpovědi

### Pro nejlepší výsledky:
- Buď konkrétní
- Zmíň speciální požadavky
- Uveď budget
- Popřemýšlej o svých zvycích (jak často vaříš, pečeš)

## 🐛 Troubleshooting

### "Neplatný API klíč"
- Zkontroluj formát: `sk-ant-...`
- Získej nový na https://console.anthropic.com/

### "Claude API error: 401"
- API klíč je neplatný nebo expirovaný
- Klikni na 🔑 a zadej nový

### "Claude API error: 429"
- Rate limit - počkej chvilku
- Nebo upgrade plánu na Anthropic

### "Návrh obsahuje nevalidní skříňky"
- Řekni AI aby používala POUZE skříňky z katalogu
- Restartuj konverzaci (🔄)

### AI nedává smysluplné návrhy
- Buď konkrétnější v odpovědích
- Zmíň rozpočet a požadavky
- Restartuj a zkus to znovu

## 📊 Ceny (Anthropic)

Claude API pricing (orientační):

- **Input**: $0.003 per 1K tokens (~750 slov)
- **Output**: $0.015 per 1K tokens

Typická konverzace:
- 5-10 zpráv: ~3,000 tokens input + 2,000 output
- **Cena: ~$0.04** (~ 1 Kč)

Generování layoutu:
- Velký kontext (katalog): ~5,000 tokens
- **Cena: ~$0.05** (~ 1 Kč)

**Celkem: ~2 Kč per návrh** 🎉

## 🔒 Bezpečnost

### API Key Storage
- Uložen v **localStorage** (browser)
- Nikdy se neposílá nikam kromě Anthropic API
- Můžeš ho kdykoliv smazat (🔑 button)

### Privacy
- Konverzace se **neuloží** na server
- Pouze komunikace s Anthropic API
- Rozměry místnosti a požadavky vidí pouze Claude

### Doporučení
- Nepoužívej API klíč na veřejných počítačích
- Pravidelně rotuj API klíče
- Sleduj usage na Anthropic console

## 🚀 Budoucí vylepšení

- [ ] **Multi-language**: Podpora více jazyků
- [ ] **Voice input**: Mluvená konverzace
- [ ] **Image understanding**: Nahrání fotky místnosti
- [ ] **3D Preview**: Real-time 3D preview během konverzace
- [ ] **Style library**: Přednastavené styly (skandinávský, moderní, rustikální)
- [ ] **Appliance catalog**: Konkrétní modely spotřebičů
- [ ] **Price optimization**: AI najde levnější alternativy
- [ ] **Comparison**: Srovnání více návrhů
- [ ] **Export**: PDF report s návrhem a cenami
- [ ] **History**: Historie konverzací

## 📚 Reference

- [Anthropic Claude API](https://docs.anthropic.com/)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Kitchen Design Best Practices](https://www.nkba.org/)

---

**Status:** ✅ **PLNĚ FUNKČNÍ**
**Integrace:** ✅ **Integrováno v App.jsx**
**API:** Claude 3.5 Sonnet (nejnovější model)
**Cost:** ~2 Kč per návrh

🎉 **Ready to use! Klikni na "🤖 AI Designer" a zkus to!**
