/**
 * ClaudeKitchenAssistant - AI asistent pro návrh kuchyní
 *
 * Používá Anthropic Claude API pro konverzaci s klientem
 * a generování strukturovaných návrhů kuchyní.
 */

import { SYSTEM_PROMPT, CATALOG_CONTEXT, ORESI_PRODUCT_INFO, LAYOUT_GENERATION_INSTRUCTIONS } from './prompts.js'

export class ClaudeKitchenAssistant {
  constructor(apiKey, catalog) {
    this.apiKey = apiKey
    this.catalog = catalog
    this.conversationHistory = []
    this.currentDesign = null

    // Claude API endpoint - použij proxy v development, direct v production
    const isDev = import.meta.env.DEV
    this.apiEndpoint = isDev
      ? '/api/anthropic/v1/messages'  // Vite proxy
      : 'https://api.anthropic.com/v1/messages'  // Direct (pro production)
    this.model = 'claude-haiku-4-5-20251001' // Claude Haiku 4.5 (nejrychlejší, nejvyšší rate limit)
  }

  /**
   * Inicializace konverzace
   */
  async startConversation(roomDimensions = { width: 4000, depth: 3000, height: 2600 }) {
    this.conversationHistory = []
    this.roomDimensions = roomDimensions

    // Připrav kontext s katalogem
    const catalogContext = this._prepareCatalogContext()

    // První zpráva od asistenta
    const initialMessage = await this._sendMessage(
      `Klient právě otevřel návrháře kuchyní. Rozměry místnosti: ${roomDimensions.width}mm × ${roomDimensions.depth}mm × ${roomDimensions.height}mm. Začni přátelským pozdravem a vyptej se na základní požadavky.`,
      true // system context
    )

    return initialMessage
  }

  /**
   * Pošli zprávu od uživatele a získej odpověď
   */
  async sendMessage(userMessage) {
    // Přidej user message do historie
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    })

    // Získej odpověď od Clauda
    const response = await this._sendMessage(userMessage)

    return response
  }

  /**
   * Požádej Clauda o finální návrh ve strukturovaném formátu
   */
  async generateLayout() {
    // Shrnutí konverzace pro AI
    const conversationSummary = this.conversationHistory
      .map((msg, i) => `${i % 2 === 0 ? 'Zákazník' : 'Prodejce'}: ${msg.content}`)
      .join('\n')

    const layoutRequest = `Konverzace se zákazníkem:
${conversationSummary}

Navrhni PŘESNÉ SLOŽENÍ kuchyně - každou skříňku zleva doprava v sekvenci.

PŘÍKLAD FORMÁTU:
{
  "summary": "L-kuchyně pro 4 osoby, moderní styl, světlý dřevodekor",
  "shape": "L",
  "totalPrice": 185000,
  "walls": {
    "back": {
      "base_sequence": ["storage-600", "dishwasher-600", "sink-800", "cooktop-600", "storage-600"],
      "wall_sequence": ["wall_storage-600", "skip-900", "wall_storage-600"]
    },
    "right": {
      "tall_sequence": ["fridge-600", "oven_tower-600"],
      "base_sequence": ["storage-600", "storage-600"],
      "wall_sequence": ["skip-1200", "wall_storage-600"]
    }
  }
}

DŮLEŽITÉ:
- base_sequence = spodní moduly zleva doprava
- wall_sequence = horní moduly zleva doprava
- tall_sequence = vysoké skříňky u kraje stěny
- Sečti šířky - NESMÍ překročit délku stěny!
- VŽDY zahrň: sink-800, cooktop-600, fridge-600

Vrať POUZE validní JSON podle příkladu!`

    const response = await this._sendMessage(layoutRequest, true, true)

    // Parse JSON response
    try {
      console.log('📝 Raw AI response:', response)

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        this.currentDesign = JSON.parse(jsonMatch[0])
        console.log('✅ Parsed design:', JSON.stringify(this.currentDesign, null, 2))
        return this.currentDesign
      }
    } catch (err) {
      console.error('Failed to parse layout JSON:', err)
      console.error('Raw response was:', response)
      throw new Error('Claude neposkytl validní JSON návrh')
    }

    console.error('No JSON found in response:', response)
    throw new Error('Claude nevrátil návrh ve správném formátu')
  }

  /**
   * Získej současný návrh
   */
  getCurrentDesign() {
    return this.currentDesign
  }

  /**
   * Reset konverzace
   */
  reset() {
    this.conversationHistory = []
    this.currentDesign = null
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Interní metoda pro komunikaci s Claude API
   */
  async _sendMessage(content, isSystemContext = false, expectJSON = false) {
    const messages = isSystemContext
      ? [{ role: 'user', content }]
      : [...this.conversationHistory]

    const systemPrompt = this._buildSystemPrompt(expectJSON)

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: expectJSON ? 4096 : 2048,
          system: systemPrompt,
          messages: messages,
          temperature: expectJSON ? 0.3 : 0.7 // Nižší temp pro JSON
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Claude API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()

      // Debug log - force error to see it
      console.error('🔍 API RESPONSE DEBUG:', JSON.stringify(data, null, 2))

      // Zkontroluj formát odpovědi
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        console.error('❌ Invalid API response format:', JSON.stringify(data, null, 2))
        throw new Error(`Invalid response format from Claude API. Got: ${JSON.stringify(data)}`)
      }

      const assistantMessage = data.content[0].text

      // Přidej odpověď do historie (pokud není system context)
      if (!isSystemContext) {
        this.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage
        })
      }

      return assistantMessage

    } catch (error) {
      console.error('Claude API error:', error)
      throw error
    }
  }

  /**
   * Sestaví system prompt s kontextem
   */
  _buildSystemPrompt(forLayoutGeneration = false) {
    const catalogContext = this._prepareCatalogContext()

    // Pro generování layoutu použij jiný prompt (bez konverzačních pravidel)
    if (forLayoutGeneration) {
      return `Jsi expert na návrh kuchyní Oresi. Vytvoř návrh POUZE ve formátu JSON.

${ORESI_PRODUCT_INFO}

KATALOG: ${catalogContext}

MÍSTNOST:
${this.roomDimensions.width}×${this.roomDimensions.depth}×${this.roomDimensions.height}mm

${LAYOUT_GENERATION_INSTRUCTIONS}

DŮLEŽITÉ: Vrať POUZE validní JSON, žádný jiný text!`
    }

    // Pro běžnou konverzaci použij standardní prompt
    return `${SYSTEM_PROMPT}

${ORESI_PRODUCT_INFO}

DOSTUPNÝ KATALOG SKŘÍNĚK:
${catalogContext}

ROZMĚRY MÍSTNOSTI:
Šířka: ${this.roomDimensions.width}mm
Hloubka: ${this.roomDimensions.depth}mm
Výška: ${this.roomDimensions.height}mm

PRAVIDLA:
- Používej POUZE skříňky z dostupného katalogu a produkty Oresi
- Respektuj rozměry místnosti
- Mysli na ergonomii (pracovní trojúhelník: dřez-sporák-lednička)
- Navrhuj realistické a funkční řešení
- Počítej s prostorem pro spotřebiče
- Dej pozor na dostupnost dvířek (nesmí být v rohu kde se neotevřou)
- Když nabízíš dekory, používej POUZE dekory z ORESI katalogu
`
  }

  /**
   * Připraví kontext katalogu pro Clauda
   */
  _prepareCatalogContext() {
    if (!this.catalog?.cabinets) return 'Katalog dostupný'

    const cabinets = this.catalog.cabinets
    const count = {
      base: cabinets.filter(c => c.type === 'base').length,
      wall: cabinets.filter(c => c.type === 'wall').length,
      tall: cabinets.filter(c => c.type === 'tall').length
    }

    return `${count.base} base, ${count.wall} wall, ${count.tall} tall skříněk`
  }

  /**
   * Získá stručný přehled katalogu pro generování layoutu
   */
  _getCatalogSummary() {
    const cabinets = this.catalog?.cabinets || []

    return cabinets.map(c =>
      `${c.id}: ${c.type} ${c.width}×${c.height}×${c.depth}mm${c.price ? ` (${c.price}Kč)` : ''}`
    ).join('\n')
  }

  /**
   * Validace API klíče
   */
  static validateApiKey(apiKey) {
    return apiKey && apiKey.startsWith('sk-ant-')
  }
}

// ============================================================================
// HELPER - Získání API klíče
// ============================================================================

/**
 * Načte API klíč z localStorage nebo prompt uživatele
 */
export function getApiKey() {
  // Zkus localStorage
  let apiKey = localStorage.getItem('claudeApiKey')

  // Pokud není, zeptej se uživatele
  if (!apiKey || !ClaudeKitchenAssistant.validateApiKey(apiKey)) {
    apiKey = prompt(
      'Zadej svůj Anthropic Claude API klíč:\n\n' +
      'Získej ho na: https://console.anthropic.com/\n' +
      'Formát: sk-ant-...'
    )

    if (apiKey && ClaudeKitchenAssistant.validateApiKey(apiKey)) {
      localStorage.setItem('claudeApiKey', apiKey)
    } else {
      throw new Error('Neplatný API klíč')
    }
  }

  return apiKey
}

/**
 * Vymaž uložený API klíč
 */
export function clearApiKey() {
  localStorage.removeItem('claudeApiKey')
}
