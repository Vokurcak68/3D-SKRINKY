/**
 * OpenAIKitchenAssistant - AI asistent pro návrh kuchyní
 *
 * Používá OpenAI API (GPT-4) pro konverzaci s klientem
 * a generování PŘESNĚ STRUKTUROVANÝCH návrhů kuchyní.
 */

import {
  OPENAI_SYSTEM_PROMPT,
  OPENAI_ORESI_PRODUCT_INFO,
  OPENAI_LAYOUT_GENERATION_INSTRUCTIONS
} from './openai-prompts.js'

export class OpenAIKitchenAssistant {
  constructor(apiKey, catalog) {
    this.apiKey = apiKey
    this.catalog = catalog
    this.conversationHistory = []
    this.currentDesign = null

    // OpenAI API endpoint
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions'

    // Model - použij GPT-4 Turbo pro nejlepší výsledky
    this.model = 'gpt-4-turbo-preview' // nebo 'gpt-4' pro stabilnější verzi
    // Pro testování můžeš použít 'gpt-3.5-turbo' (levnější, ale méně přesné)
  }

  /**
   * Inicializace konverzace
   */
  async startConversation(roomDimensions = { width: 4000, depth: 3000, height: 2600 }) {
    this.conversationHistory = []
    this.roomDimensions = roomDimensions

    // První zpráva od asistenta
    const initialPrompt = `Klient právě otevřel návrháře kuchyní Oresi.

ROZMĚRY MÍSTNOSTI:
- Šířka: ${roomDimensions.width}mm (${(roomDimensions.width / 1000).toFixed(1)}m)
- Hloubka: ${roomDimensions.depth}mm (${(roomDimensions.depth / 1000).toFixed(1)}m)
- Výška: ${roomDimensions.height}mm (${(roomDimensions.height / 1000).toFixed(1)}m)

Začni přátelským pozdravem a první otázkou podle FÁZE 1 z tvých instrukcí.
Pamatuj: PO JEDNÉ otázce!`

    const initialMessage = await this._sendMessage(initialPrompt, true)

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

    // Získej odpověď od OpenAI
    const response = await this._sendMessage(userMessage)

    return response
  }

  /**
   * Požádej OpenAI o finální návrh ve strukturovaném formátu
   */
  async generateLayout() {
    // Shrnutí konverzace
    const conversationSummary = this.conversationHistory
      .map((msg, i) => {
        const role = msg.role === 'user' ? 'Zákazník' : 'Prodejce'
        return `${role}: ${msg.content}`
      })
      .join('\n\n')

    const layoutRequest = `=== KONVERZACE SE ZÁKAZNÍKEM ===

${conversationSummary}

=== ROZMĚRY MÍSTNOSTI ===
Šířka: ${this.roomDimensions.width}mm
Hloubka: ${this.roomDimensions.depth}mm
Výška: ${this.roomDimensions.height}mm

=== TVŮJ ÚKOL ===

Na základě této konverzace NAVRHNI PŘESNÉ SLOŽENÍ kuchyně.

${OPENAI_LAYOUT_GENERATION_INSTRUCTIONS}

DŮLEŽITÉ:
- Vrať POUZE validní JSON podle formátu výše
- Žádný markdown, žádné backticky, žádný jiný text
- Každá skříňka MUSÍ mít detailní specifikaci
- absolutePosition s přesnými čísly
- Realistické ceny (Oresi)
- Kontroluj součty šířek vs. délka stěny!

ZAČNI GENEROVAT JSON NYNÍ:`

    try {
      const response = await this._sendMessage(layoutRequest, false, true)

      console.log('📝 Raw OpenAI response:', response)

      // Očisti response od případných markdown wrappů
      let cleanedResponse = response.trim()

      // Odstraň markdown code blocks pokud jsou
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      // Najdi JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        this.currentDesign = JSON.parse(jsonMatch[0])
        console.log('✅ Parsed design:', JSON.stringify(this.currentDesign, null, 2))
        return this.currentDesign
      }

      throw new Error('OpenAI nevrátil validní JSON')
    } catch (err) {
      console.error('Failed to parse layout JSON:', err)
      console.error('Raw response was:', response)
      throw new Error(`OpenAI neposkytl validní JSON návrh: ${err.message}`)
    }
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
   * Interní metoda pro komunikaci s OpenAI API
   */
  async _sendMessage(content, isInitial = false, expectJSON = false) {
    const messages = this._buildMessages(content, isInitial, expectJSON)

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: expectJSON ? 4096 : 2048,
          temperature: expectJSON ? 0.3 : 0.7, // Nižší temp pro JSON
          response_format: expectJSON ? { type: "json_object" } : undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
      }

      const data = await response.json()

      // Debug log
      console.log('🔍 OpenAI API RESPONSE:', JSON.stringify(data, null, 2))

      // Zkontroluj formát odpovědi
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('❌ Invalid API response format:', JSON.stringify(data, null, 2))
        throw new Error(`Invalid response format from OpenAI API. Got: ${JSON.stringify(data)}`)
      }

      const assistantMessage = data.choices[0].message.content

      // Přidej odpověď do historie (pokud není initial prompt)
      if (!isInitial) {
        this.conversationHistory.push({
          role: 'assistant',
          content: assistantMessage
        })
      }

      return assistantMessage

    } catch (error) {
      console.error('OpenAI API error:', error)
      throw error
    }
  }

  /**
   * Sestaví messages array pro OpenAI API
   */
  _buildMessages(content, isInitial, forLayoutGeneration) {
    // Pro generování layoutu použij speciální system prompt
    if (forLayoutGeneration) {
      return [
        {
          role: 'system',
          content: `Jsi expert na návrh kuchyní Oresi. Vytvoř návrh VE FORMÁTU JSON.

${OPENAI_ORESI_PRODUCT_INFO}

DOSTUPNÝ KATALOG:
${this._getCatalogSummary()}

${OPENAI_LAYOUT_GENERATION_INSTRUCTIONS}`
        },
        {
          role: 'user',
          content: content
        }
      ]
    }

    // Pro běžnou konverzaci
    const systemMessage = {
      role: 'system',
      content: `${OPENAI_SYSTEM_PROMPT}

${OPENAI_ORESI_PRODUCT_INFO}

DOSTUPNÝ KATALOG SKŘÍNĚK:
${this._getCatalogSummary()}

ROZMĚRY MÍSTNOSTI:
Šířka: ${this.roomDimensions.width}mm
Hloubka: ${this.roomDimensions.depth}mm
Výška: ${this.roomDimensions.height}mm`
    }

    // Initial message nebo běžná konverzace
    if (isInitial) {
      return [
        systemMessage,
        {
          role: 'user',
          content: content
        }
      ]
    }

    // Běžná konverzace - vrať celou historii s system message na začátku
    return [
      systemMessage,
      ...this.conversationHistory
    ]
  }

  /**
   * Získá stručný přehled katalogu
   */
  _getCatalogSummary() {
    const cabinets = this.catalog?.cabinets || []

    const base = cabinets.filter(c => c.type === 'base')
    const wall = cabinets.filter(c => c.type === 'wall')
    const tall = cabinets.filter(c => c.type === 'tall')

    return `Máme celkem ${cabinets.length} typů skříněk:
- ${base.length} spodních (base) skříněk - šířky 30-90cm
- ${wall.length} horních (wall) skříněk - šířky 30-90cm
- ${tall.length} vysokých (tall) skříněk - šířky 60-90cm

Všechny skříňky jsou modulární a lze je kombinovat.`
  }

  /**
   * Validace API klíče
   */
  static validateApiKey(apiKey) {
    return apiKey && apiKey.startsWith('sk-')
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
  let apiKey = localStorage.getItem('openaiApiKey')

  // Pokud není, zeptej se uživatele
  if (!apiKey || !OpenAIKitchenAssistant.validateApiKey(apiKey)) {
    apiKey = prompt(
      'Zadej svůj OpenAI API klíč:\n\n' +
      'Získej ho na: https://platform.openai.com/api-keys\n' +
      'Formát: sk-...'
    )

    if (apiKey && OpenAIKitchenAssistant.validateApiKey(apiKey)) {
      localStorage.setItem('openaiApiKey', apiKey)
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
  localStorage.removeItem('openaiApiKey')
}
