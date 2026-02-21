/**
 * PositionBasedLayoutGenerator - Generátor používající absolutní pozice z AI
 *
 * Čte base_details, wall_details, tall_details s absolutePosition
 * a vytváří přesné 3D pozice podle specifikace AI.
 *
 * Podporuje pouze Oresi skříňky.
 */

import { findCabinetForAppliance } from './applianceMapping.js'

export class PositionBasedLayoutGenerator {
  constructor({ width, depth, height }) {
    this.room = {
      width: width / 1000,   // mm → m
      depth: depth / 1000,
      height: height / 1000
    }
  }

  /**
   * Hlavní metoda - generuje 3D placements z AI designu
   */
  generate(aiDesign, catalog) {
    console.log('🏗️ PositionBasedLayoutGenerator: Generating from absolute positions...')

    // Filtruj pouze Oresi skříňky
    const oresiCatalog = this.filterOresiCabinets(catalog)
    console.log(`✅ Filtered to ${oresiCatalog.cabinets.length} Oresi cabinets`)

    const placements = []

    // Zpracuj každou stěnu
    const walls = aiDesign.walls || {}

    if (walls.back) {
      placements.push(...this.generateWall('back', walls.back, oresiCatalog))
    }
    if (walls.right) {
      placements.push(...this.generateWall('right', walls.right, oresiCatalog))
    }
    if (walls.left) {
      placements.push(...this.generateWall('left', walls.left, oresiCatalog))
    }
    if (walls.front) {
      placements.push(...this.generateWall('front', walls.front, oresiCatalog))
    }

    console.log(`✅ Generated ${placements.length} placements from absolute positions`)
    return placements
  }

  /**
   * Generuje preview data (stejné rozhraní jako SequenceLayoutGenerator)
   */
  generatePreview(aiDesign, catalog) {
    console.log('🏭 PositionBasedLayoutGenerator.generatePreview() INPUT:')
    console.log('  aiDesign.walls:', aiDesign.walls)
    console.log('  aiDesign.summary:', aiDesign.summary)
    console.log('  aiDesign.totalPrice:', aiDesign.totalPrice)

    const placements = this.generate(aiDesign, catalog)

    console.log('🏭 PositionBasedLayoutGenerator.generatePreview() OUTPUT:')
    console.log('  placements count:', placements.length)
    console.log('  placements:', placements)

    return {
      cabinets: placements,
      summary: aiDesign.summary,
      totalPrice: aiDesign.totalPrice,
      shape: aiDesign.shape,
      stats: {
        totalCabinets: placements.length,
        baseCabinets: placements.filter(c => c.type === 'base').length,
        wallCabinets: placements.filter(c => c.type === 'wall').length,
        tallCabinets: placements.filter(c => c.type === 'tall').length
      },
      // Rozšířená data z AI
      appliances: aiDesign.appliances,
      materials: aiDesign.materials,
      features: aiDesign.features,
      ergonomics: aiDesign.ergonomics
    }
  }

  /**
   * Filtruje katalog - pouze Oresi skříňky
   */
  filterOresiCabinets(catalog) {
    const oresiCabinets = catalog.cabinets.filter(c =>
      c.brand === 'Oresi'
    )

    console.log(`📦 Catalog filtering: ${catalog.cabinets.length} total → ${oresiCabinets.length} Oresi`)

    return {
      ...catalog,
      cabinets: oresiCabinets
    }
  }

  /**
   * Generuje všechny skříňky na jedné stěně
   */
  generateWall(wallName, wall, catalog) {
    console.log(`\n🔧 Generating wall: ${wallName}`)
    const placements = []

    // Zpracuj base (spodní) skříňky
    if (wall.base_details && wall.base_details.length > 0) {
      placements.push(...this.generateCabinetsFromDetails(
        wallName,
        wall.base_details,
        'base',
        catalog
      ))
    }

    // Zpracuj tall (vysoké) skříňky
    if (wall.tall_details && wall.tall_details.length > 0) {
      placements.push(...this.generateCabinetsFromDetails(
        wallName,
        wall.tall_details,
        'tall',
        catalog
      ))
    }

    // Zpracuj wall (horní) skříňky
    if (wall.wall_details && wall.wall_details.length > 0) {
      placements.push(...this.generateCabinetsFromDetails(
        wallName,
        wall.wall_details,
        'wall',
        catalog
      ))
    }

    return placements
  }

  /**
   * Generuje skříňky z details array (s absolutePosition)
   */
  generateCabinetsFromDetails(wallName, details, cabinetType, catalog) {
    console.log(`  📦 ${cabinetType} cabinets: ${details.length} items`)

    // Seřaď podle order
    const sorted = [...details].sort((a, b) => {
      const orderA = a.absolutePosition?.order ?? 999
      const orderB = b.absolutePosition?.order ?? 999
      return orderA - orderB
    })

    const placements = []

    sorted.forEach((detail, index) => {
      const parsed = this.parseModuleSpec(detail.module)
      if (!parsed) {
        console.warn(`  ⚠️ Invalid module: ${detail.module}`)
        return
      }

      // Najdi skříňku v katalogu
      const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
      if (!cabinet) {
        console.warn(`  ⚠️ No cabinet found for ${parsed.type}-${parsed.width}`)
        return
      }

      const cabinetWidth = detail.width || parsed.width

      // Vypočítej 3D pozici (předej absolutePosition, šířku a hloubku)
      const position = this.calculatePosition(
        wallName,
        detail.absolutePosition,
        cabinetType,
        cabinetWidth,    // šířka skříňky v mm
        cabinet.depth    // hloubka skříňky v mm
      )

      // Vypočítej rotaci
      const rotation = this.calculateRotation(wallName)

      placements.push({
        ...cabinet,
        width: cabinetWidth,
        position,
        rotation,
        aiPurpose: parsed.type,
        aiIndex: index,
        aiOrder: detail.absolutePosition?.order,
        aiDetails: {
          purpose: detail.purpose,
          features: detail.features,
          estimatedPrice: detail.estimatedPrice,
          notes: detail.notes
        }
      })

      console.log(`    ✅ ${detail.module} at fromRight=${detail.absolutePosition.fromRight}mm → position=[${position.map(v => v.toFixed(2)).join(', ')}]`)
    })

    return placements
  }

  /**
   * Vypočítá offset od stěny pro daný typ skříňky a hloubku
   * Spodní skříňky hloubky 500mm mají offset 65mm (pro pracovní desku)
   */
  getWallOffset(cabinetType, cabinetDepth) {
    if (cabinetType === 'base' && cabinetDepth === 500) {
      return 0.065 // 65mm v metrech
    }
    return 0
  }

  /**
   * Vypočítá 3D pozici ze stěny, absolutePosition a šířky skříňky
   * fromRight = pozice kde skříňka ZAČÍNÁ, měřeno od pravého okraje stěny (mm)
   * 3D position = střed skříňky
   */
  calculatePosition(wallName, absolutePosition, cabinetType, cabinetWidth, cabinetDepth) {
    const wallLength = wallName === 'back' || wallName === 'front'
      ? this.room.width * 1000  // mm
      : this.room.depth * 1000  // mm

    let fromLeft = absolutePosition?.fromLeft
    if (typeof fromLeft !== 'number' && typeof absolutePosition?.fromRight === 'number') {
      fromLeft = wallLength - absolutePosition.fromRight
    }
    if (typeof fromLeft !== 'number') {
      fromLeft = 0
    }

    // fromLeft je levý okraj → převedeme na metry
    const startOffset = fromLeft / 1000  // mm → m

    // Offset od stěny pro spodní skříňky hloubky 500mm
    const wallOffset = this.getWallOffset(cabinetType, cabinetDepth)

    switch (wallName) {
      case 'back':
        // Zadní stěna: pozice = levý zadní roh
        return [
          -this.room.width / 2 + startOffset,
          this.getYPosition(cabinetType),
          -this.room.depth / 2 + wallOffset
        ]

      case 'right':
        // Pravá stěna: rotace -90°, Z startuje od zadní stěny
        return [
          this.room.width / 2 - wallOffset,
          this.getYPosition(cabinetType),
          -this.room.depth / 2 + startOffset
        ]

      case 'left':
        // Levá stěna: rotace +90°, pozice Z je na "konci" modulu
        return [
          -this.room.width / 2 + wallOffset,
          this.getYPosition(cabinetType),
          -this.room.depth / 2 + startOffset + cabinetWidth / 1000
        ]

      case 'front':
        // Přední stěna: rotace 180°, pozice = levý zadní roh (u přední stěny)
        return [
          -this.room.width / 2 + startOffset,
          this.getYPosition(cabinetType),
          this.room.depth / 2 - wallOffset
        ]

      default:
        console.warn(`Unknown wall: ${wallName}`)
        return [0, 0, 0]
    }
  }

  /**
   * Vypočítá Y pozici podle typu skříňky
   */
  getYPosition(cabinetType) {
    switch (cabinetType) {
      case 'base':
      case 'tall':
        return 0  // Na zemi

      case 'wall':
        return 1.4  // Horní skříňky ve výšce 140cm

      default:
        return 0
    }
  }

  /**
   * Vypočítá rotaci podle stěny
   */
  calculateRotation(wallName) {
    switch (wallName) {
      case 'back':
        return 0  // Čelem dopředu (+Z směr)

      case 'right':
        return -Math.PI / 2  // -90° - čelem doprava (+X směr)

      case 'left':
        return Math.PI / 2  // 90° - čelem doleva (-X směr)

      case 'front':
        return Math.PI  // 180° - čelem dozadu (-Z směr)

      default:
        return 0
    }
  }

  /**
   * Parse module spec "storage-600" → {type: "storage", width: 600}
   */
  parseModuleSpec(spec) {
    if (typeof spec !== 'string') return null

    const match = spec.match(/^([a-z_]+)-(\d+)$/)
    if (!match) return null

    return {
      type: match[1],
      width: parseInt(match[2], 10)
    }
  }

  /**
   * Validace AI návrhu (stejné jako SequenceLayoutGenerator)
   */
  static validateDesign(aiDesign) {
    const errors = []

    if (!aiDesign) {
      errors.push('AI design is null')
      return { valid: false, errors }
    }

    if (!aiDesign.shape) {
      errors.push('Missing shape (linear/L/U/parallel)')
    }

    if (!aiDesign.walls) {
      errors.push('Missing walls definition')
      return { valid: false, errors }
    }

    // Zkontroluj že existuje alespoň jedna stěna s details
    const hasAnyDetails = Object.values(aiDesign.walls).some(wall =>
      (wall.base_details && wall.base_details.length > 0) ||
      (wall.tall_details && wall.tall_details.length > 0) ||
      (wall.wall_details && wall.wall_details.length > 0)
    )

    if (!hasAnyDetails) {
      console.warn('⚠️ No _details found, falling back to sequence mode')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
