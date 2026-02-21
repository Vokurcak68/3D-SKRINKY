/**
 * Mapování funkčních prvků kuchyně na katalogové skříňky
 *
 * AI specifikuje "appliance type" → systém vybere odpovídající catalogId
 */

export const APPLIANCE_TYPES = {
  // ============================================================================
  // SPOTŘEBIČE - Base moduly
  // ============================================================================

  sink: {
    name: "Dřezová skříňka",
    description: "Skříňka s dřezem a baterií",
    type: "base",
    catalogFilter: {
      group: ["Dřezové skříňky", "Výšky  724 dřezové", "Výšky 724 dřezové", "Skříňky spodní dřezové"]
    },
    standardWidths: [800, 900, 1000],
    preferredWidth: 800,
    required: true
  },

  cooktop: {
    name: "Varná deska",
    description: "Skříňka pro indukční/plynovou varnou desku",
    type: "base",
    catalogFilter: {
      group: ["Spodní skříňky"]
    },
    standardWidths: [600, 900],
    preferredWidth: 600,
    required: true
  },

  dishwasher: {
    name: "Myčka nádobí",
    description: "Prostor pro vestavnou myčku",
    type: "base",
    catalogFilter: {
      group: ["Spodní skříňky"]
    },
    standardWidths: [450, 600],
    preferredWidth: 600,
    required: false
  },

  storage: {
    name: "Úložná skříňka",
    description: "Běžná skříňka se zásuvkami/dvířky",
    type: "base",
    catalogFilter: {
      group: ["Spodní skříňky"]
    },
    standardWidths: [300, 400, 450, 500, 600, 800, 900],
    preferredWidth: 600,
    required: false
  },

  // ============================================================================
  // SPOTŘEBIČE - Tall moduly (vysoké skříňky)
  // ============================================================================

  fridge: {
    name: "Vestavná lednice",
    description: "Vysoká skříňka pro vestavnou lednici",
    type: "tall",
    catalogFilter: {
      group: ["Vysoké skříňky"]
    },
    standardWidths: [600],
    preferredWidth: 600,
    required: true
  },

  oven_tower: {
    name: "Trouba + mikrovlnka",
    description: "Vysoká skříňka s troubou a mikrovlnkou",
    type: "tall",
    catalogFilter: {
      group: ["Vysoké skříňky"]
    },
    standardWidths: [600],
    preferredWidth: 600,
    required: false
  },

  pantry: {
    name: "Spižírka",
    description: "Vysoká skříňka pro skladování",
    type: "tall",
    catalogFilter: {
      group: ["Vysoké skříňky"]
    },
    standardWidths: [600, 900],
    preferredWidth: 600,
    required: false
  },

  // ============================================================================
  // HORNÍ MODULY - Wall cabinets
  // ============================================================================

  wall_storage: {
    name: "Horní skříňka",
    description: "Běžná horní skříňka",
    type: "wall",
    catalogFilter: {
      group: ["Horní skříňky"]
    },
    standardWidths: [300, 400, 450, 500, 600, 800, 900],
    preferredWidth: 600,
    required: false
  },

  hood_cabinet: {
    name: "Skříňka nad digestoří",
    description: "Horní skříňka s odsavačem par",
    type: "wall",
    catalogFilter: {
      group: ["Horní skříňky"]
    },
    standardWidths: [600, 900],
    preferredWidth: 900,
    required: false
  },

  // ============================================================================
  // SPECIÁLNÍ
  // ============================================================================

  skip: {
    name: "Volný prostor",
    description: "Prázdné místo (bez skříňky)",
    type: null,
    required: false
  }
}

/**
 * Najde odpovídající skříňku v katalogu podle appliance type a šířky
 */
export function findCabinetForAppliance(applianceType, width, catalog) {
  const spec = APPLIANCE_TYPES[applianceType]

  if (!spec) {
    console.warn(`Unknown appliance type: ${applianceType}`)
    return null
  }

  // Skip není skříňka
  if (applianceType === 'skip') {
    return null
  }

  // KROK 1: Zkus najít PŘESNOU šířku
  let matching = catalog.cabinets.filter(cabinet => {
    // Type check
    if (cabinet.type !== spec.type) return false

    // Group check
    if (spec.catalogFilter.group) {
      const groupMatch = spec.catalogFilter.group.some(g =>
        cabinet.group && cabinet.group.includes(g)
      )
      if (!groupMatch) return false
    }

    // Width check - PŘESNÁ shoda
    if (cabinet.widths && !cabinet.widths.includes(width)) return false

    return true
  })

  // KROK 2: Pokud nenajdeme přesnou šířku, hledej NEJBLIŽŠÍ
  if (matching.length === 0) {
    console.warn(`⚠️ No exact width ${width}mm for ${applianceType}, looking for closest...`)

    matching = catalog.cabinets.filter(cabinet => {
      if (cabinet.type !== spec.type) return false

      if (spec.catalogFilter.group) {
        const groupMatch = spec.catalogFilter.group.some(g =>
          cabinet.group && cabinet.group.includes(g)
        )
        if (!groupMatch) return false
      }

      return true // Ignoruj width check
    })

    if (matching.length === 0) {
      console.error(`❌ No cabinet found for ${applianceType} at all!`)
      return getFallbackCabinet(spec.type, width, catalog)
    }

    // Najdi nejbližší šířku
    const closest = matching.reduce((best, cab) => {
      if (!cab.widths || cab.widths.length === 0) return best

      const closestWidth = cab.widths.reduce((a, b) =>
        Math.abs(b - width) < Math.abs(a - width) ? b : a
      )

      if (!best || Math.abs(closestWidth - width) < Math.abs(best.closestWidth - width)) {
        return { cabinet: cab, closestWidth }
      }
      return best
    }, null)

    if (closest) {
      console.log(`✅ Using closest: ${applianceType} ${width}mm → ${closest.closestWidth}mm (${closest.cabinet.name})`)
      return closest.cabinet
    }
  }

  // Vyber první match (můžeme přidat prioritizaci podle brand)
  console.log(`✅ Found exact match: ${applianceType} ${width}mm → ${matching[0].name}`)
  return matching[0]
}

/**
 * Fallback pokud nenajdeme přesnou shodu
 */
function getFallbackCabinet(type, width, catalog) {
  const fallback = catalog.cabinets.find(c =>
    c.type === type &&
    c.widths &&
    c.widths.includes(width)
  )

  if (!fallback) {
    console.error(`No fallback found for type ${type} width ${width}`)
  }

  return fallback
}

/**
 * Validace že kuchyně obsahuje všechny povinné spotřebiče
 */
export function validateRequiredAppliances(composition) {
  const errors = []

  // Projdi všechny stěny a najdi všechny appliances
  const allAppliances = []

  console.log('🔍 Validating composition:', JSON.stringify(composition, null, 2))

  Object.values(composition.walls || {}).forEach(wall => {
    if (!wall) return

    // Hledej v _sequence polích (ne _modules)
    ;['base_sequence', 'tall_sequence', 'wall_sequence'].forEach(sequenceType => {
      const sequence = wall[sequenceType] || []
      sequence.forEach(item => {
        // Parse "sink-800" → "sink"
        if (typeof item === 'string') {
          const match = item.match(/^([a-z_]+)-\d+$/)
          if (match && match[1] !== 'skip') {
            allAppliances.push(match[1])
          }
        }
      })
    })
  })

  console.log('✅ Found appliances:', allAppliances)

  // Kontrola povinných
  Object.entries(APPLIANCE_TYPES).forEach(([key, spec]) => {
    if (spec.required && !allAppliances.includes(key)) {
      errors.push(`Chybí povinný spotřebič: ${spec.name} (${key})`)
    }
  })

  if (errors.length > 0) {
    console.error('❌ Validation errors:', errors)
  }

  return {
    valid: errors.length === 0,
    errors,
    appliances: allAppliances
  }
}
