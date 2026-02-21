/**
 * SequenceLayoutGenerator - Převádí AI sequence design na 3D pozice
 *
 * AI popíše kuchyni jako sekvenci modulů zleva doprava:
 * ["storage-600", "sink-800", "cooktop-600", ...]
 *
 * Tento generátor převede sekvenci na přesné [x, y, z] pozice a rotace.
 */

import { findCabinetForAppliance, validateRequiredAppliances } from './applianceMapping.js'

export class SequenceLayoutGenerator {
  constructor(roomDimensions) {
    this.room = {
      width: roomDimensions.width / 1000,   // mm → m
      depth: roomDimensions.depth / 1000,
      height: roomDimensions.height / 1000
    }
  }

  /**
   * Hlavní metoda - převede AI sequence design na placement data
   */
  generate(aiDesign, catalog) {
    console.log('🏗️ Generating layout from sequence...', aiDesign)

    // Validace že máme všechny povinné spotřebiče
    const validation = validateRequiredAppliances(aiDesign)
    if (!validation.valid) {
      console.error('❌ Missing required appliances:', validation.errors)
      throw new Error(`Neplatný návrh: ${validation.errors.join(', ')}`)
    }

    const placements = []

    // Zpracuj každou stěnu
    if (aiDesign.walls?.back) {
      placements.push(...this._generateBackWall(aiDesign.walls.back, catalog))
    }

    if (aiDesign.walls?.left) {
      placements.push(...this._generateLeftWall(aiDesign.walls.left, catalog))
    }

    if (aiDesign.walls?.right) {
      placements.push(...this._generateRightWall(aiDesign.walls.right, catalog))
    }

    if (aiDesign.walls?.front) {
      placements.push(...this._generateFrontWall(aiDesign.walls.front, catalog))
    }

    console.log(`✅ Generated ${placements.length} cabinet placements`)

    return placements
  }

  /**
   * Vygeneruje preview data
   */
  generatePreview(aiDesign, catalog) {
    console.log('🏭 SequenceLayoutGenerator.generatePreview() INPUT:')
    console.log('  aiDesign.walls:', aiDesign.walls)
    console.log('  aiDesign.summary:', aiDesign.summary)
    console.log('  aiDesign.totalPrice:', aiDesign.totalPrice)

    const placements = this.generate(aiDesign, catalog)

    console.log('🏭 SequenceLayoutGenerator.generatePreview() OUTPUT:')
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
      }
    }
  }

  // ============================================================================
  // WALL GENERATORS
  // ============================================================================

  /**
   * Generuje zadní stěnu (back wall)
   */
  _generateBackWall(wall, catalog) {
    const placements = []
    const startX = -this.room.width / 2
    const z = -this.room.depth / 2

    console.log('🔧 Generating BACK wall, room width:', this.room.width)

    // Base moduly
    if (wall.base_sequence) {
      console.log('  📦 Base modules:', wall.base_sequence)
      let currentX = startX
      wall.base_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at X=${currentX.toFixed(2)}m`)
          currentX += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,  // OVERRIDE s požadovanou šířkou!
          position: [
            currentX,
            0,
            z
          ],
          rotation: 0,
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentX += parsed.width / 1000 // 2mm gap
      })
    }

    // Wall moduly
    if (wall.wall_sequence) {
      console.log('  📦 Wall modules:', wall.wall_sequence)
      let currentX = startX
      wall.wall_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at X=${currentX.toFixed(2)}m`)
          currentX += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,  // OVERRIDE s požadovanou šířkou!
          position: [
            currentX,
            1.4, // 140cm nad zemí
            z
          ],
          rotation: 0,
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentX += parsed.width / 1000
      })
    }

    // Tall moduly (u kraje)
    if (wall.tall_sequence) {
      let currentX = startX
      wall.tall_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) return

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            currentX,
            0,
            z
          ],
          rotation: 0,
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentX += parsed.width / 1000
      })
    }

    return placements
  }

  /**
   * Generuje pravou stěnu (right wall) - rotace +90°
   */
  _generateRightWall(wall, catalog) {
    const placements = []
    const x = (this.room.width / 2) - 0.56  // Offset by typical cabinet depth
    let currentZ = -this.room.depth / 2

    console.log('🔧 Generating RIGHT wall, room depth:', this.room.depth)

    // KROK 1: Tall moduly NEJDŘÍV (u rohu zadní stěny)
    let tallModulesEndZ = currentZ
    if (wall.tall_sequence) {
      console.log('  📦 Tall modules:', wall.tall_sequence)
      wall.tall_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) return

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            x,  // Right wall - back edge at wall
            0,
            currentZ
          ],
          rotation: Math.PI / 2,  // Right wall faces left (-X direction)
          aiPurpose: parsed.type,
          aiIndex: index
        })

        console.log(`    ✅ ${parsed.type} at Z=${currentZ.toFixed(2)}m, width=${parsed.width}mm`)
        currentZ += parsed.width / 1000
        tallModulesEndZ = currentZ
      })
    }

    // KROK 2: Base moduly ZAČÍNAJÍ ZA tall moduly
    currentZ = tallModulesEndZ
    if (wall.base_sequence) {
      console.log('  📦 Base modules (starting at Z=' + currentZ.toFixed(2) + 'm):', wall.base_sequence)
      wall.base_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at Z=${currentZ.toFixed(2)}m`)
          currentZ += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            x,  // Right wall - back edge at wall
            0,
            currentZ
          ],
          rotation: Math.PI / 2,  // Right wall faces left (-X direction)
          aiPurpose: parsed.type,
          aiIndex: index
        })

        console.log(`    ✅ ${parsed.type} at Z=${currentZ.toFixed(2)}m, width=${parsed.width}mm`)
        currentZ += parsed.width / 1000
      })
    }

    // KROK 3: Wall moduly ZAČÍNAJÍ ZA tall moduly (ne od začátku!)
    currentZ = tallModulesEndZ
    if (wall.wall_sequence) {
      console.log('  📦 Wall modules (starting at Z=' + currentZ.toFixed(2) + 'm):', wall.wall_sequence)
      wall.wall_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at Z=${currentZ.toFixed(2)}m`)
          currentZ += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            x,  // Right wall - back edge at wall (wall cabinets)
            1.4,
            currentZ
          ],
          rotation: Math.PI / 2,  // Right wall faces left (-X direction)
          aiPurpose: parsed.type,
          aiIndex: index
        })

        console.log(`    ✅ ${parsed.type} at Z=${currentZ.toFixed(2)}m, width=${parsed.width}mm`)
        currentZ += parsed.width / 1000
      })
    }

    return placements
  }

  /**
   * Generuje levou stěnu (left wall) - rotace -90°
   */
  _generateLeftWall(wall, catalog) {
    const placements = []
    const x = (-this.room.width / 2) + 0.56  // Offset by typical cabinet depth
    let currentZ = -this.room.depth / 2

    console.log('🔧 Generating LEFT wall')

    // KROK 1: Tall moduly NEJDŘÍV (u rohu)
    let tallModulesEndZ = currentZ
    if (wall.tall_sequence) {
      wall.tall_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) return

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            x,  // Left wall - back edge at wall
            0,
            currentZ
          ],
          rotation: -Math.PI / 2,  // Left wall faces right (+X direction)
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentZ += parsed.width / 1000
        tallModulesEndZ = currentZ
      })
    }

    // KROK 2: Base moduly ZA tall moduly
    currentZ = tallModulesEndZ
    if (wall.base_sequence) {
      wall.base_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at Z=${currentZ.toFixed(2)}m`)
          currentZ += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            x,  // Left wall - back edge at wall
            0,
            currentZ
          ],
          rotation: -Math.PI / 2,  // Left wall faces right (+X direction)
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentZ += parsed.width / 1000
      })
    }

    // KROK 3: Wall moduly ZA tall moduly
    currentZ = tallModulesEndZ
    if (wall.wall_sequence) {
      wall.wall_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at Z=${currentZ.toFixed(2)}m`)
          currentZ += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            x,
            1.4,
            currentZ
          ],
          rotation: -Math.PI / 2,  // Left wall faces right (+X direction)
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentZ += parsed.width / 1000
      })
    }

    return placements
  }

  /**
   * Generuje přední stěnu (front wall) - pro parallel layout
   */
  _generateFrontWall(wall, catalog) {
    // Podobné jako back wall, ale otočené o 180°
    const placements = []
    const startX = -this.room.width / 2
    const z = this.room.depth / 2

    if (wall.base_sequence) {
      let currentX = startX
      wall.base_sequence.forEach((item, index) => {
        const parsed = this._parseModuleSpec(item)
        if (!parsed) {
          console.warn('  ⚠️ Invalid module spec:', item)
          return
        }
        if (parsed.type === 'skip') {
          console.log(`  ⏭️ Skipping ${parsed.width}mm gap at X=${currentX.toFixed(2)}m`)
          currentX += parsed.width / 1000
          return
        }

        const cabinet = findCabinetForAppliance(parsed.type, parsed.width, catalog)
        if (!cabinet) return

        placements.push({
          ...cabinet,
          width: parsed.width,
          position: [
            currentX,
            0,
            z  // Front wall - cabinet faces back (-Z)
          ],
          rotation: Math.PI,
          aiPurpose: parsed.type,
          aiIndex: index
        })

        currentX += parsed.width / 1000
      })
    }

    return placements
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Parsuje module spec: "sink-800" → { type: "sink", width: 800 }
   */
  _parseModuleSpec(spec) {
    if (!spec || typeof spec !== 'string') return null

    const match = spec.match(/^([a-z_]+)-(\d+)$/)
    if (!match) {
      console.warn(`Invalid module spec: ${spec}`)
      return null
    }

    return {
      type: match[1],
      width: parseInt(match[2], 10)
    }
  }

  /**
   * Validace AI návrhu
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

    // Kontrola povinných spotřebičů
    const validation = validateRequiredAppliances(aiDesign)
    if (!validation.valid) {
      errors.push(...validation.errors)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
