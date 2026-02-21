# 🔧 AI Assistant Troubleshooting

## ✅ VYŘEŠENO: CORS Error / Failed to fetch

**Problém:** Browser blokoval přímé requesty na Anthropic API (CORS policy).

**Řešení:** Implementováno Vite proxy v `vite.config.js`

```javascript
proxy: {
  '/api/anthropic': {
    target: 'https://api.anthropic.com',
    changeOrigin: true,
    ...
  }
}
```

### Jak to použít:

1. **Restart dev serveru** (pokud běžel):
   ```bash
   cd prototype2
   npm run dev
   ```

2. **Otevři aplikaci**: http://localhost:3002/

3. **Klikni "🤖 AI Designer"**

4. **Zadej API klíč** (formát: `sk-ant-api03-...`)
   - Získej na: https://console.anthropic.com/
   - Settings → API Keys → Create Key

5. **Vyzkoušej konverzaci**

---

## 🧪 Test API klíče

Zkontroluj že tvůj API klíč funguje:

```javascript
// Otevři browser console (F12) a zkus:
const apiKey = 'tvůj-klíč'

fetch('/api/anthropic/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: 'Hello!'
    }]
  })
})
.then(r => r.json())
.then(d => console.log('✅ API funguje!', d))
.catch(e => console.error('❌ Chyba:', e))
```

**Očekávaný výsledek:**
```javascript
{
  id: "msg_...",
  type: "message",
  role: "assistant",
  content: [{
    type: "text",
    text: "Hello! How can I help you today?"
  }],
  ...
}
```

---

## ❌ Časté chyby a řešení

### 1. "Failed to fetch"

**Příčiny:**
- Dev server neběží
- Proxy není správně nakonfigurováno
- Network problém

**Řešení:**
```bash
# 1. Zastavit běžící server (Ctrl+C)
# 2. Restart s novým configem
npm run dev

# 3. Refresh browser (Ctrl+Shift+R - hard reload)
```

### 2. "Invalid API key"

**Příčiny:**
- Špatný formát klíče
- Klíč expiroval
- Klíč nemá permissions

**Řešení:**
1. Klikni 🔑 (Change API Key)
2. Vytvoř nový klíč na https://console.anthropic.com/
3. Zkopíruj celý klíč včetně `sk-ant-`
4. Vlož do promptu

**Správný formát:**
```
sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. "Rate limit exceeded" (429)

**Příčiny:**
- Příliš mnoho requestů za krátkou dobu
- Free tier limit

**Řešení:**
- Počkej 1-2 minuty
- Nebo upgrade na paid plan

### 4. "Model not found" nebo podobné API errors

**Příčiny:**
- Neplatný model ID
- Account nemá přístup k modelu

**Řešení:**
Zkontroluj v `ClaudeKitchenAssistant.js`:
```javascript
this.model = 'claude-3-5-sonnet-20241022'
```

Pokud nefunguje, zkus:
```javascript
this.model = 'claude-3-sonnet-20240229'  // Starší verze
```

### 5. AI odpovídá anglicky místo česky

**Příčiny:**
- Claude defaultuje na anglický

**Řešení:**
V první zprávě napiš:
```
"Prosím odpovídej POUZE česky. Jsme 4 v rodině..."
```

### 6. AI generuje nevalidní JSON

**Příčiny:**
- Příliš složitá konverzace
- Model hallucinuje

**Řešení:**
1. Klikni 🔄 (Restart)
2. Buď konkrétnější v odpovědích
3. Dej jasný rozpočet a požadavky

---

## 🔍 Debug Mode

Zapni verbose logging v browser console:

```javascript
// V browser console (F12)
localStorage.setItem('aiDebug', 'true')

// Pak refresh page a sleduj console
```

Vypni:
```javascript
localStorage.removeItem('aiDebug')
```

---

## 📞 API Status Check

Zkontroluj že Anthropic API je online:

**Status page:** https://status.anthropic.com/

Pokud je down (červená), počkej až se opraví.

---

## 🛠️ Advanced: Custom Proxy

Pokud potřebuješ custom proxy (např. pro production):

1. **Vytvoř backend endpoint** (Express, Node.js):

```javascript
// server.js
import express from 'express'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())

app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    })

    const data = await response.json()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(3100, () => console.log('Proxy běží na :3100'))
```

2. **Update ClaudeKitchenAssistant.js**:
```javascript
this.apiEndpoint = 'http://localhost:3100/api/claude'
```

---

## ✅ Checklist pro první spuštění

- [ ] Dev server běží (`npm run dev`)
- [ ] Otevřeno správné URL (localhost:3002)
- [ ] API klíč získán z Anthropic console
- [ ] API klíč má formát `sk-ant-...`
- [ ] Browser console nehlásí errors (F12)
- [ ] Network tab ukazuje requesty na `/api/anthropic/` (ne direct na `api.anthropic.com`)

---

## 📊 Network Debugging

Otevři DevTools → Network tab:

**Správně:**
```
Request URL: http://localhost:3002/api/anthropic/v1/messages
Status: 200 OK
Response: { id: "msg_...", ... }
```

**Špatně (CORS error):**
```
Request URL: https://api.anthropic.com/v1/messages  ← ŠPATNĚ!
Status: (failed) net::ERR_FAILED
Console: CORS policy blocked
```

→ Pokud vidíš druhé, proxy nefunguje. Restartuj dev server.

---

## 💡 Pro Produkci

Pro production build potřebuješ backend:

**Možnosti:**

1. **Vercel Serverless Function**
2. **Netlify Function**
3. **Express.js backend**
4. **Cloudflare Worker**

**Příklad (Vercel):**
```javascript
// api/claude.js
export default async function handler(req, res) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(req.body)
  })

  const data = await response.json()
  res.json(data)
}
```

---

**Status:** ✅ **VYŘEŠENO - Proxy implementováno**

Zkus to teď znovu! Mělo by to fungovat. 🚀
