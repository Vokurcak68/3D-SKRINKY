# 🚀 AI Kitchen Designer - Quick Setup Guide

## ✅ CO JSEM PRÁVĚ OPRAVIL

**Problém:** "Failed to fetch" - CORS error při volání Anthropic API

**Řešení:** Přidáno Vite proxy, které přesměruje requesty přes dev server.

---

## 🎯 JAK TO TEĎ VYZKOUŠET

### Krok 1: Restart Dev Serveru

```bash
# Zastav server pokud běží (Ctrl+C)

# Restart s novým configem
cd "C:\Users\tomas\OneDrive\Apps\3D skrinky\prototype2"
npm run dev
```

Server poběží na: **http://localhost:3002/** (nebo jiný volný port)

### Krok 2: Získej API Klíč

1. Jdi na: **https://console.anthropic.com/**
2. Přihlas se (nebo vytvoř account)
3. Klikni na **"API Keys"** v menu
4. Klikni **"Create Key"**
5. Zadej jméno (např. "Kitchen Designer")
6. Zkopíruj klíč (začíná `sk-ant-api03-...`)

**DŮLEŽITÉ:** Klíč se ukáže pouze jednou! Ulož si ho.

### Krok 3: Otevři Aplikaci

1. Otevři: http://localhost:3002/
2. Počkej až se načte (Oresi Kitchen Designer)

### Krok 4: Spusť AI Asistenta

1. Klikni na tlačítko **"🤖 AI Designer"** v headeru (pravý horní roh)
2. Objeví se modal s AI asistentem
3. Zadej svůj API klíč do promptu
4. Klíč se uloží do localStorage (pro příště)

### Krok 5: Konverzace

AI se tě zeptá:

```
Asistent: "Dobrý den! Vítám vás v návrháři kuchyní Oresi.
           Vidím, že máte místnost 4×3 metry.

           Řekněte mi, žijete sami nebo s rodinou?
           A jak moc rádi vaříte?"
```

**Tvoje odpověď (příklad):**
```
Žiju s manželkou a 2 dětmi. Vaříme každý den, manželka ráda peče.
```

AI bude postupně ptát se na:
- Rozpočet (např. "200 000 Kč")
- Styl (moderní/klasický/rustikální)
- Spotřebiče (trouba, myčka, mikrovlnka...)
- Speciální požadavky (ostrov, bar, atd.)

### Krok 6: Generování Návrhu

Po 5-10 zprávách:

1. Klikni **"✨ Vygeneruj návrh"** (dole)
2. AI sestaví návrh (10-30 sekund)
3. Zobrazí se preview s:
   - Shrnutím
   - Počtem skříněk
   - Cenou
   - Statistikami

### Krok 7: Aplikování

1. Zkontroluj návrh
2. Klikni **"✅ Použít tento návrh"**
3. Potvď vymazání současného layoutu
4. **BOOM!** 🎉 Kuchyň se automaticky sestaví v 3D!

---

## 🧪 RYCHLÝ TEST

Pro rychlé otestování bez dlouhé konverzace:

```
Krok 1: Otevři AI Assistant
Krok 2: Napiš:

"Jsme 4 v rodině, vaříme každý den. Budget 200 tisíc.
 Moderní styl, bílá + dřevo. Potřebujeme troubu, myčku,
 ledničku, indukci. Voda je u zadní stěny."

Krok 3: Klikni "✨ Vygeneruj návrh"
Krok 4: Počkej ~15 sekund
Krok 5: Klikni "✅ Použít návrh"
```

✨ Hotovo! Kompletní kuchyň za **2 minuty**!

---

## 📊 CO OČEKÁVAT

### První konverzace (5-10 zpráv):
- **Trvání:** 2-5 minut
- **Cena:** ~1-2 Kč (API calls)
- **Výsledek:** Personalizovaný návrh

### Generování layoutu:
- **Trvání:** 10-30 sekund
- **Cena:** ~1 Kč
- **Výsledek:** 10-20 skříněk automaticky umístěných

### Celkem:
- **Čas:** 5-10 minut od začátku do hotové kuchyně
- **Cena:** ~2-3 Kč per návrh
- **Úspora času:** 90% oproti manuálnímu designu

---

## 🎬 Ukázková Konverzace

```
AI: "Dobrý den! Žijete sami nebo s rodinou?"

TY: "S manželkou a 2 dětmi."

AI: "Pro rodinu 4 osob doporučuji U nebo L layout.
     Jaký máte přibližný rozpočet?"

TY: "Cca 200 tisíc."

AI: "Výborně! Kde jsou rozvody vody?"

TY: "U zadní stěny."

AI: "Jaké spotřebiče potřebujete?"

TY: "Trouba, indukce, myčka, lednička, mikrovlnka."

AI: "Preferujete moderní nebo klasický styl?"

TY: "Moderní, bílá + dřevo."

AI: "Perfektní! Mám všechny informace. Navrhnu vám
     U-kuchyň s dřezem u zadní stěny, sporákem vlevo,
     ledničkou vpravo. Hodně úložného prostoru.

     Připravím kompletní návrh. Souhlasíte?"

TY: "Ano!"

[Klikneš "✨ Vygeneruj návrh"]

AI: "✅ Návrh vygenerován!

     Celkem: 18 skříněk
     Cena: 185,000 Kč

     Prohlédni si návrh a pokud vyhovuje, použij ho."

[Preview se zobrazí s detaily]

[Klikneš "✅ Použít návrh"]

🎉 Kuchyň postavena!
```

---

## ⚠️ CO DĚLAT KDYŽ...

### "Failed to fetch" stále přetrvává?

1. **Hard refresh:** Ctrl+Shift+R
2. **Vyčisti cache:** DevTools → Application → Clear storage
3. **Restart serveru:**
   ```bash
   Ctrl+C
   npm run dev
   ```

### "Invalid API key"?

1. Klikni 🔑 (Change API Key)
2. Zkontroluj formát: `sk-ant-api03-xxxxx...`
3. Vytvoř nový klíč pokud je starý

### AI odpovídá anglicky?

Napiš v první zprávě:
```
"Prosím odpovídej POUZE česky. [tvoje odpověď]"
```

### AI generuje divný návrh?

1. Klikni 🔄 (Restart conversation)
2. Buď konkrétnější v odpovědích
3. Zmíň důležité detaily (rozpočet, počet lidí)

---

## 🔧 Pro Pokročilé

### Debug Mode

```javascript
// Browser console (F12)
localStorage.setItem('aiDebug', 'true')
// Refresh page
```

Zobrazí se verbose logy všech API callů.

### Test API přímo

```javascript
// Browser console
fetch('/api/anthropic/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'tvůj-klíč',
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Ahoj!' }]
  })
})
.then(r => r.json())
.then(console.log)
```

Mělo by vrátit:
```json
{
  "id": "msg_...",
  "content": [{ "text": "Ahoj! Jak..." }]
}
```

### Change model

V `ClaudeKitchenAssistant.js`:
```javascript
this.model = 'claude-3-sonnet-20240229'  // Starší, stabilnější
```

---

## 📚 Další Info

- **Dokumentace:** [AI_KITCHEN_DESIGNER.md](AI_KITCHEN_DESIGNER.md)
- **Troubleshooting:** [TROUBLESHOOTING_AI.md](TROUBLESHOOTING_AI.md)
- **Tech Docs:** [src/ai/README.md](src/ai/README.md)

---

## ✅ KONTROLNÍ SEZNAM

Před prvním použitím zkontroluj:

- [ ] Dev server běží (`npm run dev`)
- [ ] URL je správné (localhost:3002 nebo podobné)
- [ ] Máš API klíč z Anthropic console
- [ ] API klíč začíná `sk-ant-`
- [ ] Browser console nehlásí errors (F12)
- [ ] Network tab ukazuje `/api/anthropic/` (ne `api.anthropic.com`)

---

🎉 **Vše je připraveno! Teď to zkus:**

1. Otevři http://localhost:3002/
2. Klikni "🤖 AI Designer"
3. Zadej API klíč
4. Začni konverzaci!

**Mělo by to fungovat!** Pokud ne, podívej se do [TROUBLESHOOTING_AI.md](TROUBLESHOOTING_AI.md)
