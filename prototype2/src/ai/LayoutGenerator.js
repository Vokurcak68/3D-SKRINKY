/**
 * LayoutGenerator - Převádí AI návrh na konkrétní 3D pozice skříněk
 *
 * Bere strukturovaný output z ClaudeKitchenAssistant
 * a generuje přesné [x, y, z] pozice a rotace pro placement systém.
 */

export class LayoutGenerator {
  constructor(roomDimensions) {
    this.room = {
      width: roomDimensions.width / 1000,   // mm → m
      depth: roomDimensions.depth / 1000,
      height: roomDimensions.height / 1000
    }
  }

  /**
   * Hlavní metoda - převede AI design na cabinet placement data
   * @param {Object} aiDesign - Output z ClaudeKitchenAssistant.generateLayout()
   * @param {Object} catalog - Katalog skříněk pro reference
   * @returns {Array<Object>} - Array skříněk ready pro addCabinetAtPosition
   */
  generate(aiDesign, catalog) {
    if (!aiDesign?.cabinets || aiDesign.cabinets.length === 0) {
      throw new Error('AI design neobsahuje žádné skříňky')
    }

    const placements = []

    // Seskup skříňky podle pozice
    const grouped = this._groupByPosition(aiDesign.cabinets)

    // Zpracuj každou skupinu
    Object.entries(grouped).forEach(([position, cabinets]) => {
      const placed = this._placeGroup(position, cabinets, catalog)
      placements.push(...placed)
    })

    return placements
  }

  /**
   * Vygeneruje preview data pro AI návrh (před finálním umístěním)
   */
  generatePreview(aiDesign, catalog) {
    const placements = this.generate(aiDesign, catalog)

    return {
      cabinets: placements,
      summary: aiDesign.summary,
      totalPrice: aiDesign.totalPrice,
      layout: aiDesign.layout,
      stats: {
        totalCabinets: placements.length,
        baseCabinets: placements.filter(c => c.type === 'base').length,
        wallCabinets: placements.filter(c => c.type === 'wall').length,
        tallCabinets: placements.filter(c => c.type === 'tall').length
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Position Calculation
  // ============================================================================

  /**
   * Seskupí skříňky podle pozice (left-back, center-back, atd.)
   */
  _groupByPosition(cabinets) {
    const grouped = {}

    cabinets.forEach(cab => {
      const pos = cab.position || 'center-back'
      if (!grouped[pos]) grouped[pos] = []
      grouped[pos].push(cab)
    })

    // Seřaď každou skupinu podle order
    Object.keys(grouped).forEach(pos => {
      grouped[pos].sort((a, b) => (a.order || 0) - (b.order || 0))
    })

    return grouped
  }

  /**
   * Umístí skupinu skříněk na určitou pozici
   */
  _placeGroup(position, cabinets, catalog) {
    switch (position) {
      case 'left-back':
        return this._placeLeftBack(cabinets, catalog)

      case 'center-back':
        return this._placeCenterBack(cabinets, catalog)

      case 'right-back':
        return this._placeRightBack(cabinets, catalog)

      case 'left-wall':
        return this._placeLeftWall(cabinets, catalog)

      case 'right-wall':
        return this._placeRightWall(cabinets, catalog)

      case 'island':
        return this._placeIsland(cabinets, catalog)

      default:
        console.warn(`Unknown position: ${position}, using center-back`)
        return this._placeCenterBack(cabinets, catalog)
    }
  }

  /**
   * Umístění u levého rohu zadní stěny
   */
  _placeLeftBack(cabinets, catalog) {
    const startX = -this.room.width / 2
    let currentX = startX

    return cabinets.map(cab => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      const width = (catalogItem.width || cab.width || 600) / 1000
      const depth = (catalogItem.depth || cab.depth || 560) / 1000
      const y = this._getYPosition(cab.type)

      const placement = {
        ...catalogItem,
        position: [currentX, y, -this.room.depth / 2 + depth],
        rotation: 0,
        aiPurpose: cab.purpose
      }

      currentX += width + 0.002 // 2mm mezera

      return placement
    })
  }

  /**
   * Umístění ve středu zadní stěny
   */
  _placeCenterBack(cabinets, catalog) {
    // Vypočítej celkovou šířku
    const totalWidth = cabinets.reduce((sum, cab) => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      return sum + (catalogItem.width || cab.width || 600) / 1000 + 0.002
    }, -0.002) // Odeber poslední mezeru

    const startX = -totalWidth / 2
    let currentX = startX

    return cabinets.map(cab => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      const width = (catalogItem.width || cab.width || 600) / 1000
      const depth = (catalogItem.depth || cab.depth || 560) / 1000
      const y = this._getYPosition(cab.type)

      const placement = {
        ...catalogItem,
        position: [currentX, y, -this.room.depth / 2 + depth],
        rotation: 0,
        aiPurpose: cab.purpose
      }

      currentX += width + 0.002

      return placement
    })
  }

  /**
   * Umístění u pravého rohu zadní stěny
   */
  _placeRightBack(cabinets, catalog) {
    // Počítej zprava doleva
    const totalWidth = cabinets.reduce((sum, cab) => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      return sum + (catalogItem.width || cab.width || 600) / 1000 + 0.002
    }, -0.002)

    let currentX = this.room.width / 2 - totalWidth

    return cabinets.map(cab => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      const width = (catalogItem.width || cab.width || 600) / 1000
      const depth = (catalogItem.depth || cab.depth || 560) / 1000
      const y = this._getYPosition(cab.type)

      const placement = {
        ...catalogItem,
        position: [currentX, y, -this.room.depth / 2 + depth],
        rotation: 0,
        aiPurpose: cab.purpose
      }

      currentX += width + 0.002

      return placement
    })
  }

  /**
   * Umístění u levé boční stěny (rotace -90°)
   */
  _placeLeftWall(cabinets, catalog) {
    let currentZ = -this.room.depth / 2

    return cabinets.map(cab => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      const width = (catalogItem.width || cab.width || 600) / 1000
      const depth = (catalogItem.depth || cab.depth || 560) / 1000
      const y = this._getYPosition(cab.type)

      const placement = {
        ...catalogItem,
        position: [-this.room.width / 2 + depth, y, currentZ + width],
        rotation: -Math.PI / 2,
        aiPurpose: cab.purpose
      }

      currentZ += width + 0.002

      return placement
    })
  }

  /**
   * Umístění u pravé boční stěny (rotace +90°)
   */
  _placeRightWall(cabinets, catalog) {
    let currentZ = -this.room.depth / 2

    return cabinets.map(cab => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      const width = (catalogItem.width || cab.width || 600) / 1000
      const depth = (catalogItem.depth || cab.depth || 560) / 1000
      const y = this._getYPosition(cab.type)

      const placement = {
        ...catalogItem,
        position: [this.room.width / 2 - depth, y, currentZ + width],
        rotation: Math.PI / 2,
        aiPurpose: cab.purpose
      }

      currentZ += width + 0.002

      return placement
    })
  }

  /**
   * Umístění ostrova (uprostřed místnosti)
   */
  _placeIsland(cabinets, catalog) {
    const totalWidth = cabinets.reduce((sum, cab) => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      return sum + (catalogItem.width || cab.width || 600) / 1000 + 0.002
    }, -0.002)

    const startX = -totalWidth / 2
    let currentX = startX

    return cabinets.map(cab => {
      const catalogItem = this._findInCatalog(cab.catalogId, catalog)
      const width = (catalogItem.width || cab.width || 600) / 1000
      const depth = (catalogItem.depth || cab.depth || 560) / 1000
      const y = this._getYPosition(cab.type)

      const placement = {
        ...catalogItem,
        position: [currentX, y, 0], // Střed místnosti
        rotation: 0,
        aiPurpose: cab.purpose
      }

      currentX += width + 0.002

      return placement
    })
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Najdi skříňku v katalogu podle ID
   */
  _findInCatalog(catalogId, catalog) {
    const found = catalog.cabinets.find(c => c.id === catalogId)

    if (!found) {
      console.warn(`Cabinet ${catalogId} not found in catalog`)
      // Fallback
      return {
        id: catalogId,
        width: 600,
        height: 720,
        depth: 560,
        type: 'base'
      }
    }

    return found
  }

  /**
   * Získej Y pozici podle typu skříňky
   */
  _getYPosition(type) {
    switch (type) {
      case 'wall':
        return 1.4 // 140cm nad zemí

      case 'base':
      case 'tall':
      default:
        return 0 // Na zemi
    }
  }

  /**
   * Validace AI návrhu před generováním
   */
  static validateDesign(aiDesign) {
    const errors = []

    if (!aiDesign) {
      errors.push('AI design is null')
      return { valid: false, errors }
    }

    if (!aiDesign.cabinets || aiDesign.cabinets.length === 0) {
      errors.push('No cabinets in design')
    }

    aiDesign.cabinets?.forEach((cab, i) => {
      if (!cab.catalogId) {
        errors.push(`Cabinet ${i}: missing catalogId`)
      }
      if (!cab.type) {
        errors.push(`Cabinet ${i}: missing type`)
      }
      if (!cab.position) {
        errors.push(`Cabinet ${i}: missing position`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
