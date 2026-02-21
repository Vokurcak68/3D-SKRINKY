# 🚀 OpenAI Upgrade - AI Kitchen Designer

## 📋 Přehled změn

Systém byl **přepracován** pro podporu **OpenAI GPT-4** s důrazem na **přesné specifikace** každé skříňky.

### ✨ Co je nové

#### 1. **Dual AI Provider Support**
- ✅ **OpenAI GPT-4** (nově - DOPORUČENO)
- ✅ **Claude Haiku** (původní - stále funkční)
- 🔄 Přepínání mezi providery v UI

#### 2. **Vylepšený Prompt System**
- 📝 **Strukturovaný rozhovor** - 27 kroků v 8 fázích
- 🎯 **Postupné vyptávání** - po jedné otázce
- 💡 **Vysvětlování** - WHY, výhody/nevýhody
- 🔍 **Detailní požadavky** - všechno co je potřeba pro přesný návrh

#### 3. **Rozšířený JSON Output**
Každá skříňka nyní obsahuje:
- ✅ **Přesné rozměry** (width, height, depth)
- ✅ **Typ a účel** (purpose, type)
- ✅ **Absolutní pozice** (fromLeft/fromRight, fromBack/fromFront)
- ✅ **Pořadí** (order v sekvenci)
- ✅ **Umístění** (wall, slovní popis)
- ✅ **Cena** (estimatedPrice)
- ✅ **Features** (vlastnosti - zásuvky, soft close atd.)
- ✅ **Notes** (poznámky - např. u rozvodů)

---

## 🏗️ Struktura rozhovoru

### FÁZE 1: ZÁKLADNÍ INFORMACE
```
1. Pozdrav a záměr
2. Počet osob v domácnosti
3. Jak často vaříte
4. Speciální potřeby (pečení, velkoobjemové vaření)
```

### FÁZE 2: PROSTOROVÉ POŽADAVKY
```
5. Potvrzení rozměrů
6. Rozvody vody (která stěna, kde)
7. Elektrické rozvody
8. Okna a dveře
```

### FÁZE 3: TVAR A LAYOUT
```
9. Tvar kuchyně (Linear/L/U/Parallel)
10. Kuchyňský ostrůvek?
```

### FÁZE 4: SPOTŘEBIČE (detailně!)
```
11. Trouba (ve výšce / pod deskou)
12. Varná deska (indukce/plyn/elektro)
13. Digestoř (nástěnná/vestavěná)
14. Lednice (volně stojící/vestavěná, šířka)
15. Myčka (ano/ne, šířka)
16. Mikrovlnka (kde)
17. Další spotřebiče
```

### FÁZE 5: ÚLOŽNÉ PROSTORY
```
18. Spižírka?
19. Zásuvky vs. dvířka
20. Rohové řešení
```

### FÁZE 6: STYL A DESIGN
```
21. Styl (moderní/klasický/rustikální)
22. Barva/dekor
23. Pracovní deska
```

### FÁZE 7: ROZPOČET
```
24. Rozpočet (s orientačními cenami)
```

### FÁZE 8: FINÁLNÍ UPŘESNĚNÍ
```
25. Osvětlení
26. Pracovní výška
27. Speciální požadavky
```

---

## 📊 JSON Output Format

### Rozšířený formát s detaily

```json
{
  "summary": "L-kuchyň pro 4 osoby...",
  "shape": "L",
  "totalPrice": 185000,
  "roomDimensions": {
    "width": 4000,
    "depth": 3000,
    "height": 2600
  },
  "walls": {
    "back": {
      "wallName": "Zadní stěna",
      "wallLength": 4000,
      "base_sequence": ["storage-600", "sink-800", "cooktop-600"],
      "base_details": [
        {
          "module": "storage-600",
          "type": "storage",
          "width": 600,
          "purpose": "Úložná skříňka pro nádobí",
          "position": "Levý začátek linky",
          "absolutePosition": {
            "fromLeft": 0,
            "fromRight": 3400,
            "wall": "back",
            "order": 1
          },
          "features": ["3x zásuvka", "tichý dojezd"],
          "estimatedPrice": 12000,
          "notes": "První modul linky"
        },
        {
          "module": "sink-800",
          "type": "sink",
          "width": 800,
          "purpose": "Dřezová skříňka se dřezem",
          "position": "Střed zadní stěny",
          "absolutePosition": {
            "fromLeft": 600,
            "fromRight": 2600,
            "wall": "back",
            "order": 2
          },
          "features": ["nerezový dřez", "páková baterie"],
          "estimatedPrice": 15000,
          "notes": "Umístěno u rozvodů vody"
        }
      ],
      "wall_sequence": ["wall_storage-600", "skip-800", "wall_storage-600"],
      "wall_details": [...],
      "totalUsed": 2000,
      "totalAvailable": 4000,
      "remainingSpace": 2000
    },
    "right": { ... }
  },
  "appliances": [
    {
      "name": "Indukční varná deska",
      "type": "cooktop",
      "size": "60cm (4 zóny)",
      "location": "Zadní stěna, v modulu cooktop-600",
      "estimatedPrice": 12000,
      "notes": "Doporučeno: ovládání na přední hraně"
    }
  ],
  "materials": {
    "cabinetFronts": "Bílý mat - Oresi Dolti Collection",
    "cabinetBody": "Světlý dřevodekor",
    "countertop": "Laminát dekor kámen šedý, 28mm"
  },
  "features": [
    "LED osvětlení pod horními skříňkami",
    "Tichý dojezd na všech zásuvkách"
  ],
  "ergonomics": {
    "workTriangleDistance": 4200,
    "workTriangleOptimal": true,
    "counterSpace": { ... }
  }
}
```

### Zpětná kompatibilita

Systém **stále podporuje** původní Claude formát:
```json
{
  "summary": "...",
  "shape": "L",
  "totalPrice": 185000,
  "walls": {
    "back": {
      "base_sequence": ["storage-600", "sink-800"],
      "wall_sequence": ["wall_storage-600"]
    }
  }
}
```

**SequenceLayoutGenerator** funguje s oběma formáty:
- Používá pouze `_sequence` pole
- `_details` pole jsou **bonus** pro uživatele (zobrazení v preview)

---

## 🔧 Technické detaily

### Soubory

#### Nové:
- [`src/ai/openai-prompts.js`](src/ai/openai-prompts.js) - Vylepšené prompty pro OpenAI
- [`src/ai/OpenAIKitchenAssistant.js`](src/ai/OpenAIKitchenAssistant.js) - OpenAI API wrapper

#### Upravené:
- [`src/components/AIAssistantModal.jsx`](src/components/AIAssistantModal.jsx) - Přidán selector pro AI provider

#### Beze změny:
- [`src/ai/SequenceLayoutGenerator.js`](src/ai/SequenceLayoutGenerator.js) - Funguje s oběma formáty
- [`src/ai/applianceMapping.js`](src/ai/applianceMapping.js) - Mapování modulů na katalog
- Veškeré placement systémy

### API Klíče

#### OpenAI:
- Storage: `localStorage.openaiApiKey`
- Získat: https://platform.openai.com/api-keys
- Formát: `sk-...`

#### Claude:
- Storage: `localStorage.claudeApiKey`
- Získat: https://console.anthropic.com/
- Formát: `sk-ant-...`

### Modely

#### OpenAI (doporučeno):
```javascript
model: 'gpt-4-turbo-preview' // Nejlepší výsledky
// nebo 'gpt-4' - stabilnější
// nebo 'gpt-3.5-turbo' - levnější (ale méně přesné)
```

#### Claude:
```javascript
model: 'claude-haiku-4-5-20251001' // Rychlé, levné
```

---

## 💰 Ceny

### OpenAI GPT-4 Turbo
- **Input**: $0.01 per 1K tokens (~750 slov)
- **Output**: $0.03 per 1K tokens

Typická konverzace:
- 10-15 zpráv: ~6,000 tokens input + 3,000 output
- **Cena: ~$0.15** (~ 3.50 Kč)

Generování layoutu:
- Velký kontext: ~8,000 tokens input + 2,000 output
- **Cena: ~$0.14** (~ 3.20 Kč)

**Celkem: ~7 Kč per návrh**

### Claude Haiku
- **Input**: $0.003 per 1K tokens
- **Output**: $0.015 per 1K tokens

**Celkem: ~2 Kč per návrh** (levnější!)

---

## 🎯 Klíčové výhody OpenAI řešení

### 1. **Přesnější specifikace**
- Každá skříňka má detailní popis
- Absolutní pozice (fromLeft/fromRight v mm)
- Pořadí v sekvenci
- Účel a features

### 2. **Lepší ergonomika**
- Kontrola pracovního trojúhelníku
- Validace pracovních ploch
- Doporučení na základě ergonomie

### 3. **Strukturovanější rozhovor**
- 27 kroků - nic se nezapomene
- Vysvětlování WHY
- Nabízení konkrétních možností

### 4. **Více informací pro zákazníka**
- Seznam všech spotřebičů s cenami
- Materiály a dekory
- Features (LED, soft close, atd.)
- Ergonomická analýza

### 5. **Flexibilita**
- Volba mezi OpenAI a Claude
- Možnost testování obou modelů
- Snadné přidání dalších providerů

---

## 📝 Použití

### 1. Získání API klíče

#### OpenAI:
1. Jdi na https://platform.openai.com/api-keys
2. Vytvoř nový API klíč
3. Zkopíruj ho (formát: `sk-...`)

#### Claude:
1. Jdi na https://console.anthropic.com/
2. Získej API klíč (formát: `sk-ant-...`)

### 2. Spuštění AI Designera

1. Klikni na **"🤖 AI Designer"** v aplikaci
2. Vyber AI provider (OpenAI / Claude)
3. Při prvním spuštění zadej API klíč
4. Začni konverzaci!

### 3. Průběh

1. **Konverzace** - AI se ptá postupně (cca 15-20 minut)
2. **Kontrola** - Shrnutí všech požadavků
3. **Generování** - Klikni "✨ Vygeneruj návrh"
4. **Preview** - Prohlédni si návrh s detaily
5. **Aplikování** - "✅ Použít tento návrh"

### 4. Quick Test

Pro rychlé testování:
- Klikni "⚡ Quick Test"
- Přeskočí dialog, rovnou generuje testovací návrh
- Vhodné pro debugging

---

## 🔍 Debug

### Console logs

OpenAIKitchenAssistant loguje:
```javascript
console.log('📝 Raw OpenAI response:', response)
console.log('✅ Parsed design:', design)
```

### Validace

SequenceLayoutGenerator validuje:
- Povinné spotřebiče (sink, cooktop, fridge)
- Součty šířek vs. délka stěn
- Formát modulů (`type-width`)

### Chyby

Časté problémy:
- **"Neplatný API klíč"** - Zkontroluj formát (`sk-...`)
- **"Invalid JSON"** - GPT-4 nevrátil JSON (zkus znovu)
- **"Missing required appliances"** - Chybí sink/cooktop/fridge
- **"Total width exceeds wall length"** - Součet šířek > délka stěny

---

## 🚀 Budoucí vylepšení

- [ ] **Image input** - Nahrání fotky místnosti (GPT-4 Vision)
- [ ] **Voice conversation** - Mluvená konverzace (Whisper API)
- [ ] **3D Preview během konverzace** - Real-time preview
- [ ] **Více providerů** - Gemini, Mistral, atd.
- [ ] **Export do PDF** - Detailní report s návrhem
- [ ] **Porovnání návrhů** - Více variant najednou
- [ ] **Optimalizace ceny** - AI najde levnější alternativy
- [ ] **Catalog RAG** - Vektorová databáze katalogu pro přesné vyhledávání

---

## ✅ Status

- ✅ OpenAI integrace funkční
- ✅ Claude stále podporován
- ✅ Dual provider v UI
- ✅ Rozšířený JSON formát
- ✅ Zpětná kompatibilita
- ✅ Vylepšený prompt system
- ✅ Detailní preview

**READY TO USE!** 🎉

Vyber AI provider a začni navrhovat! 🤖✨
