/**
 * PlacementSuggestionEngine - Real-time AI suggestions během umísťování skříněk
 *
 * Poskytuje inteligentní návrhy pozic na základě:
 * - Účelu skříňky (dřez, sporák, lednička)
 * - Ergonomie (work triangle)
 * - Estetiky (symetrie, alignment)
 * - Kontextu místnosti (okna, dveře)
 *
 * Integrace:
 *   const engine = new PlacementSuggestionEngine(spatialGrid, collision, placement, catalog)
 *   const suggestions = engine.getSuggestions(cabinet, existingCabinets, roomContext)
 *   // Zobraz suggestions jako ghost previews v Scene3D
 */

export class PlacementSuggestionEngine {
  constructor(spatialGrid, collisionDetector, placementSystem, catalog) {
    this.spatial = spatialGrid
    this.collision = collisionDetector
    this.placement = placementSystem
    this.catalog = catalog

    // Konfigurace
    this.maxSuggestions = 3
    this.minScore = 30 // Nepřijímej sugestiony pod 30/100
  }

  /**
   * Hlavní metoda - získá top N inteligentních návrhů pozic
   *
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Array} existingCabinets - Již umístěné skříňky
   * @param {Object} roomContext - Kontext místnosti (okna, dveře, světlo)
   * @returns {Array<Suggestion>} - Top suggestions s pozicí, rotací a reasoning
   */
  getSuggestions(cabinet, existingCabinets, roomContext = {}) {
    // 1. Identifikuj účel skříňky
    const purpose = this._identifyPurpose(cabinet)

    // 2. Najdi všechny možné pozice (různé strategie)
    const candidates = this._generateCandidates(cabinet, existingCabinets, purpose)

    // 3. Filtruj validní (collision-free + boundary check)
    const valid = candidates.filter(candidate => {
      const result = this.collision.canPlace(
        cabinet,
        candidate.position,
        candidate.rotation || 0
      )
      return result.valid
    })

    if (valid.length === 0) {
      console.warn('No valid positions found for cabinet', cabinet.name)
      return []
    }

    // 4. Score každou pozici (AI reasoning)
    const scored = valid.map(candidate => {
      const scoreResult = this._scorePosition(
        cabinet,
        candidate,
        existingCabinets,
        purpose,
        roomContext
      )

      return {
        position: candidate.position,
        rotation: candidate.rotation || 0,
        score: scoreResult.score,
        reasons: scoreResult.reasons,
        strategy: candidate.strategy,
        purpose
      }
    })

    // 5. Seřaď podle skóre a vrať top N
    const sorted = scored
      .filter(s => s.score >= this.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxSuggestions)

    // 6. Přidej UX metadata
    return sorted.map((suggestion, index) => ({
      ...suggestion,
      rank: index + 1,
      hotkey: (index + 1).toString(),
      starRating: this._scoreToStars(suggestion.score),
      color: this._scoreToColor(suggestion.score)
    }))
  }

  // ==========================================================================
  // CANDIDATE GENERATION
  // ==========================================================================

  /**
   * Generuje kandidátní pozice z různých strategií
   */
  _generateCandidates(cabinet, existing, purpose) {
    const candidates = []

    // Strategie 1: PlacementSystem (linear, smart, grid)
    const placementPos = this.placement.findAllPossiblePositions(cabinet, existing)
    candidates.push(...placementPos.map(p => ({ ...p, strategy: 'placement-system' })))

    // Strategie 2: Purpose-based (pro dřez, sporák, atd.)
    const purposePos = this._getPurposeBasedPositions(cabinet, existing, purpose)
    candidates.push(...purposePos.map(p => ({ ...p, strategy: 'purpose-based' })))

    // Strategie 3: Aesthetic (symetrie, balance)
    const aestheticPos = this._getAestheticPositions(cabinet, existing)
    candidates.push(...aestheticPos.map(p => ({ ...p, strategy: 'aesthetic' })))

    // Strategie 4: Adjacent (vedle existujících)
    const adjacentPos = this._getAdjacentPositions(cabinet, existing, purpose)
    candidates.push(...adjacentPos.map(p => ({ ...p, strategy: 'adjacent' })))

    return candidates
  }

  /**
   * Purpose-based pozice (např. dřez u okna)
   */
  _getPurposeBasedPositions(cabinet, existing, purpose) {
    const positions = []
    const roomW = this.collision.room.width
    const roomD = this.collision.room.depth
    const cabW = (cabinet.width || 600) / 1000
    const cabD = (cabinet.depth || 560) / 1000

    // Dřez preferuje pozici u okna (zadní stěna, centrovaný)
    if (purpose === 'sink' || purpose === 'sink-candidate') {
      positions.push({
        position: [0, 0, -roomD / 2 + cabD], // Střed zadní stěny
        rotation: 0,
        reasoning: 'Dřez u okna - ideální pro přirozené světlo'
      })
    }

    // Sporák ne přímo u okna (požární bezpečnost)
    if (purpose === 'stove') {
      positions.push({
        position: [-roomW / 4, 0, -roomD / 2 + cabD], // Levá část zadní stěny
        rotation: 0,
        reasoning: 'Sporák mimo okno - bezpečnost'
      })
    }

    // Lednička v rohu (easy access, minimální workflow disruption)
    if (purpose === 'fridge') {
      // Levý roh
      positions.push({
        position: [-roomW / 2 + cabW, 0, -roomD / 2 + cabD],
        rotation: 0,
        reasoning: 'Lednička v rohu - snadný přístup'
      })
      // Pravý roh
      positions.push({
        position: [roomW / 2 - cabW, 0, -roomD / 2 + cabD],
        rotation: 0,
        reasoning: 'Lednička v rohu - snadný přístup'
      })
    }

    return positions
  }

  /**
   * Estetické pozice (symetrie, alignment)
   */
  _getAestheticPositions(cabinet, existing) {
    const positions = []
    const roomW = this.collision.room.width
    const roomD = this.collision.room.depth
    const cabW = (cabinet.width || 600) / 1000
    const cabD = (cabinet.depth || 560) / 1000

    // Pokud už existují skříňky, zkus symetrii
    if (existing.length > 0) {
      // Najdi centroid existujících skříněk
      const centroid = this._calculateCentroid(existing)

      // Zkus zrcadlení přes střed místnosti
      const mirrored = {
        position: [-centroid[0], centroid[1], centroid[2]],
        rotation: 0,
        reasoning: 'Symetrický layout'
      }
      positions.push(mirrored)
    }

    // Centrovaná pozice (esteticky příjemná)
    positions.push({
      position: [0, 0, -roomD / 2 + cabD],
      rotation: 0,
      reasoning: 'Centrovaná pozice - balancovaný vzhled'
    })

    return positions
  }

  /**
   * Adjacent pozice (vedle existujících skříněk)
   */
  _getAdjacentPositions(cabinet, existing, purpose) {
    const positions = []
    const cabW = (cabinet.width || 600) / 1000
    const cabD = (cabinet.depth || 560) / 1000

    // Pokud umísťujeme myčku, preferuj pozici vedle dřezu
    if (purpose === 'dishwasher') {
      const sink = existing.find(c => this._identifyPurpose(c) === 'sink')
      if (sink) {
        const sinkW = (sink.width || 600) / 1000
        // Vpravo od dřezu
        positions.push({
          position: [sink.position[0] + sinkW, 0, sink.position[2]],
          rotation: 0,
          reasoning: 'Myčka vedle dřezu - ergonomické'
        })
      }
    }

    // Pro wall cabinets, zkus pozici nad base cabinets
    if (cabinet.type === 'wall') {
      existing
        .filter(c => c.type === 'base')
        .forEach(base => {
          positions.push({
            position: [base.position[0], 1.4, base.position[2]], // 1.4m nad zemí
            rotation: base.rotation || 0,
            reasoning: 'Horní skříňka nad spodní - koherentní vzhled'
          })
        })
    }

    return positions
  }

  // ==========================================================================
  // SCORING SYSTEM (AI BRAIN)
  // ==========================================================================

  /**
   * Komplexní scoring s reasoning
   */
  _scorePosition(cabinet, candidate, existing, purpose, roomContext) {
    let score = 50 // Baseline
    const reasons = []

    // === ERGONOMICS (35% weight) ===
    const ergoScore = this._scoreErgonomics(cabinet, candidate, existing, purpose)
    score += ergoScore.score * 0.35
    reasons.push(...ergoScore.reasons)

    // === ACCESSIBILITY (20% weight) ===
    const accessScore = this._scoreAccessibility(cabinet, candidate, existing)
    score += accessScore.score * 0.20
    reasons.push(...accessScore.reasons)

    // === AESTHETICS (25% weight) ===
    const aestheticScore = this._scoreAesthetics(cabinet, candidate, existing)
    score += aestheticScore.score * 0.25
    reasons.push(...aestheticScore.reasons)

    // === SPACE EFFICIENCY (20% weight) ===
    const spaceScore = this._scoreSpaceEfficiency(cabinet, candidate, existing)
    score += spaceScore.score * 0.20
    reasons.push(...spaceScore.reasons)

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score))

    return { score, reasons }
  }

  /**
   * Ergonomics scoring
   */
  _scoreErgonomics(cabinet, candidate, existing, purpose) {
    let score = 0
    const reasons = []

    // Work triangle check
    if (purpose === 'sink' || purpose === 'stove' || purpose === 'fridge') {
      const workTriangleScore = this._scoreWorkTriangle(
        cabinet,
        candidate.position,
        existing,
        purpose
      )

      if (workTriangleScore > 80) {
        score += 30
        reasons.push('⭐ Ideální pracovní trojúhelník')
      } else if (workTriangleScore > 60) {
        score += 15
        reasons.push('Dobrý pracovní trojúhelník')
      } else if (workTriangleScore < 40) {
        score -= 20
        reasons.push('⚠️ Pracovní trojúhelník není optimální')
      }
    }

    // Sink u okna (bonus)
    if (purpose === 'sink' || purpose === 'sink-candidate') {
      const distFromCenter = Math.abs(candidate.position[0])
      if (distFromCenter < 0.5) { // Do 50cm od středu
        score += 20
        reasons.push('💡 Dřez u okna = přirozené světlo')
      }
    }

    // Sporák NE vedle lednice (tepelné ovlivnění)
    if (purpose === 'stove') {
      const fridge = existing.find(c => this._identifyPurpose(c) === 'fridge')
      if (fridge) {
        const dist = this._distance(candidate.position, fridge.position)
        if (dist < 0.6) {
          score -= 30
          reasons.push('❌ Sporák moc blízko lednice')
        }
      }
    }

    // Myčka vedle dřezu (bonus)
    if (purpose === 'dishwasher') {
      const sink = existing.find(c => this._identifyPurpose(c) === 'sink')
      if (sink) {
        const dist = this._distance(candidate.position, sink.position)
        if (dist < 0.9) {
          score += 25
          reasons.push('⭐ Myčka vedle dřezu - efektivní')
        }
      }
    }

    return { score, reasons }
  }

  /**
   * Work triangle scoring (dřez-sporák-lednička)
   * Optimální: 4-7 metrů celkem
   */
  _scoreWorkTriangle(cabinet, position, existing, purpose) {
    // Najdi ostatní prvky trojúhelníku
    const elements = {
      sink: existing.find(c => this._identifyPurpose(c) === 'sink'),
      stove: existing.find(c => this._identifyPurpose(c) === 'stove'),
      fridge: existing.find(c => this._identifyPurpose(c) === 'fridge')
    }

    // Přidej aktuální skříňku
    elements[purpose] = { position }

    // Potřebujeme alespoň 2 prvky (včetně aktuálního)
    const presentElements = Object.values(elements).filter(e => e)
    if (presentElements.length < 2) return 50 // Neutral

    // Vypočítej vzdálenosti
    const distances = []
    if (elements.sink && elements.stove) {
      distances.push(this._distance(elements.sink.position, elements.stove.position))
    }
    if (elements.stove && elements.fridge) {
      distances.push(this._distance(elements.stove.position, elements.fridge.position))
    }
    if (elements.fridge && elements.sink) {
      distances.push(this._distance(elements.fridge.position, elements.sink.position))
    }

    if (distances.length === 0) return 50

    const total = distances.reduce((sum, d) => sum + d, 0)

    // Scoring
    if (total >= 4 && total <= 7) return 100 // Ideální
    if (total >= 3 && total <= 8) return 80  // Dobrý
    if (total < 3) return 40 // Moc blízko
    return Math.max(0, 100 - (total - 7) * 10) // Moc daleko
  }

  /**
   * Accessibility scoring
   */
  _scoreAccessibility(cabinet, candidate, existing) {
    let score = 0
    const reasons = []

    // Check door clearance (dveře se otevřou?)
    const doorClearance = this._checkDoorClearance(cabinet, candidate, existing)
    if (doorClearance.clear) {
      score += 20
    } else {
      score -= 30
      reasons.push(`⚠️ Dveře se neotevřou: ${doorClearance.reason}`)
    }

    // Corner cabinets (rohové skříňky jsou problematické)
    const isCorner = this._isInCorner(candidate.position)
    if (isCorner && !cabinet.name?.toLowerCase().includes('roh')) {
      score -= 15
      reasons.push('Standardní skříňka v rohu - horší přístup')
    }

    return { score, reasons }
  }

  /**
   * Aesthetics scoring
   */
  _scoreAesthetics(cabinet, candidate, existing) {
    let score = 0
    const reasons = []

    // Alignment s existujícími skříňkami
    const alignment = this._checkAlignment(candidate.position, existing)
    if (alignment.aligned) {
      score += 15
      reasons.push('Zarovnáno s ostatními skříňkami')
    }

    // Symetrie
    const symmetry = this._checkSymmetry(candidate.position, existing)
    if (symmetry > 0.8) {
      score += 20
      reasons.push('⭐ Symetrický layout')
    }

    // Balance (rovnoměrné rozložení)
    const balance = this._checkBalance(cabinet, candidate.position, existing)
    if (balance > 0.7) {
      score += 10
      reasons.push('Vyvážené rozložení')
    }

    return { score, reasons }
  }

  /**
   * Space efficiency scoring
   */
  _scoreSpaceEfficiency(cabinet, candidate, existing) {
    let score = 0
    const reasons = []

    // Využití prostoru u stěn (preferuj umístění u stěny)
    const nearWall = this._isNearWall(candidate.position)
    if (nearWall) {
      score += 15
      reasons.push('U stěny - lepší využití prostoru')
    } else {
      score -= 5
    }

    // Gap utilization (vyplňuje mezeru?)
    const fillsGap = this._fillsGap(cabinet, candidate.position, existing)
    if (fillsGap) {
      score += 20
      reasons.push('💡 Vyplňuje mezeru v layoutu')
    }

    return { score, reasons }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Identifikace účelu skříňky (pattern matching + heuristiky)
   */
  _identifyPurpose(cabinet) {
    const name = (cabinet.name || '').toLowerCase()
    const code = (cabinet.code || '').toLowerCase()

    // Pattern matching
    if (name.includes('dřez') || name.includes('sink') || code.includes('sink')) {
      return 'sink'
    }
    if (name.includes('sporák') || name.includes('stove') || name.includes('trouba')) {
      return 'stove'
    }
    if (name.includes('lednič') || name.includes('fridge')) {
      return 'fridge'
    }
    if (name.includes('myčka') || name.includes('dishwasher')) {
      return 'dishwasher'
    }
    if (name.includes('roh') || name.includes('corner')) {
      return 'corner'
    }
    if (name.includes('cargo')) {
      return 'storage-pull-out'
    }

    // Heuristiky podle rozměrů
    if (cabinet.width >= 800 && cabinet.type === 'base') {
      return 'sink-candidate' // Široké base cabinets jsou často pro dřez
    }
    if (cabinet.width >= 600 && cabinet.type === 'base') {
      return 'appliance-space' // Prostor pro spotřebiče
    }
    if (cabinet.type === 'tall') {
      return 'storage-tall' // Vysoké skříňky = úložný prostor
    }

    return 'general-storage'
  }

  /**
   * Vzdálenost mezi dvěma pozicemi
   */
  _distance(pos1, pos2) {
    const dx = pos1[0] - pos2[0]
    const dz = pos1[2] - pos2[2]
    return Math.sqrt(dx * dx + dz * dz)
  }

  /**
   * Centroid (těžiště) skříněk
   */
  _calculateCentroid(cabinets) {
    if (cabinets.length === 0) return [0, 0, 0]

    const sum = cabinets.reduce((acc, cab) => [
      acc[0] + cab.position[0],
      acc[1] + cab.position[1],
      acc[2] + cab.position[2]
    ], [0, 0, 0])

    return [
      sum[0] / cabinets.length,
      sum[1] / cabinets.length,
      sum[2] / cabinets.length
    ]
  }

  /**
   * Je pozice v rohu?
   */
  _isInCorner(position, threshold = 0.5) {
    const roomW = this.collision.room.width
    const roomD = this.collision.room.depth
    const [x, _, z] = position

    const nearLeftWall = Math.abs(x + roomW / 2) < threshold
    const nearRightWall = Math.abs(x - roomW / 2) < threshold
    const nearBackWall = Math.abs(z + roomD / 2) < threshold
    const nearFrontWall = Math.abs(z - roomD / 2) < threshold

    return (nearLeftWall || nearRightWall) && (nearBackWall || nearFrontWall)
  }

  /**
   * Je pozice u stěny?
   */
  _isNearWall(position, threshold = 0.3) {
    const roomW = this.collision.room.width
    const roomD = this.collision.room.depth
    const [x, _, z] = position

    return (
      Math.abs(x + roomW / 2) < threshold || // Levá stěna
      Math.abs(x - roomW / 2) < threshold || // Pravá stěna
      Math.abs(z + roomD / 2) < threshold || // Zadní stěna
      Math.abs(z - roomD / 2) < threshold    // Přední stěna
    )
  }

  /**
   * Check door clearance (placeholder - requires door swing simulation)
   */
  _checkDoorClearance(cabinet, candidate, existing) {
    // TODO: Implement door swing simulation
    // Pro teď jen kontrola, že není přímo v rohu
    const isCorner = this._isInCorner(candidate.position, 0.3)

    if (isCorner && !cabinet.name?.toLowerCase().includes('roh')) {
      return {
        clear: false,
        reason: 'Dveře by se neotevřely v rohu'
      }
    }

    return { clear: true }
  }

  /**
   * Check alignment (placeholder)
   */
  _checkAlignment(position, existing) {
    // TODO: Implement alignment detection
    return { aligned: true }
  }

  /**
   * Check symmetry (placeholder)
   */
  _checkSymmetry(position, existing) {
    // TODO: Implement symmetry calculation
    return 0.5
  }

  /**
   * Check balance (placeholder)
   */
  _checkBalance(cabinet, position, existing) {
    // TODO: Implement balance calculation
    return 0.7
  }

  /**
   * Fills gap? (placeholder)
   */
  _fillsGap(cabinet, position, existing) {
    // TODO: Implement gap detection
    return false
  }

  /**
   * Score to stars (⭐⭐⭐⭐⭐)
   */
  _scoreToStars(score) {
    const stars = Math.round(score / 20) // 0-5 stars
    return '⭐'.repeat(stars)
  }

  /**
   * Score to color (for UI)
   */
  _scoreToColor(score) {
    if (score >= 80) return '#4CAF50' // Green
    if (score >= 60) return '#FFC107' // Yellow
    if (score >= 40) return '#FF9800' // Orange
    return '#F44336' // Red
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    if (config.maxSuggestions !== undefined) {
      this.maxSuggestions = config.maxSuggestions
    }
    if (config.minScore !== undefined) {
      this.minScore = config.minScore
    }
  }
}
