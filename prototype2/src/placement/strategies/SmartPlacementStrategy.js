/**
 * SmartPlacementStrategy - Inteligentní umísťování s hledáním mezer
 *
 * Pokročilá strategie která:
 * 1. Zkusí umístit vedle poslední skříňky
 * 2. Hledá mezery v existujících řadách
 * 3. Vytváří nové řady pokud je potřeba
 * 4. Podporuje umístění u bočních stěn (rotované)
 * 5. Cross-wall collision detection v rohách (L/U tvar)
 *
 * Nahrazuje složitou logiku původní findNextPositionInLine funkce.
 */

import { getCabinetBoundingBox, getBoundingBox } from '../BoundingBox.js'

export class SmartPlacementStrategy {
  constructor() {
    // Offset od stěny pro spodní skříňky hloubky 500mm (pro pracovní desku)
    this.baseDepth500Offset = 0.065 // 65mm
  }

  /**
   * Vypočítá offset od stěny pro danou skříňku
   */
  _getWallOffset(cabinet) {
    if (cabinet.type === 'base' && cabinet.depth === 500) {
      return this.baseDepth500Offset
    }
    return 0
  }

  /**
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Array} existingCabinets - Existující skříňky
   * @param {Object} room - { width, depth, height } v metrech
   * @param {string} selectedWall - Vybraná stěna ('back' | 'left' | 'right' | null)
   * @returns {Object} - { position: [x,y,z], rotation: number }
   */
  place(cabinet, existingCabinets, room, selectedWall = 'back') {
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const type = cabinet.type || 'base'
    const y = this._getYForType(type)

    // Filtruj skříňky stejné úrovně A stejné stěny
    const sameLevel = this._filterSameLevel(existingCabinets, type, selectedWall, room)

    console.log('SmartPlacementStrategy.place:', {
      selectedWall,
      existingCabinets: existingCabinets.length,
      sameLevel: sameLevel.length,
      sameLevelPositions: sameLevel.map(c => ({ pos: c.position, rot: c.rotation }))
    })

    // Pokud žádné na vybrané stěně, začni v rohu podle stěny
    // Předej všechny existující skříňky pro kontrolu kolizí s vedlejšími stěnami
    if (sameLevel.length === 0) {
      return this._getStartPositionForWall(selectedWall, width, depth, y, room, existingCabinets, cabinet)
    }

    // 1. NEJPRVE zkus najít mezeru v existující řadě
    const inGap = this._tryPlaceInGap(sameLevel, width, depth, y, room, selectedWall, cabinet)
    console.log('_tryPlaceInGap result:', inGap)
    if (inGap) return inGap

    // 2. Pokud není mezera, zkus umístit vedle poslední přidané skříňky
    const nextToLast = this._tryPlaceNextToLast(sameLevel, width, depth, y, room, selectedWall, cabinet)
    console.log('_tryPlaceNextToLast result:', nextToLast)
    if (nextToLast) return nextToLast

    // 3. Stěna je plná - vrať null
    console.warn('No space left on wall:', selectedWall)
    return null
  }

  /**
   * Najde alternativní pozice (pro výběr uživatelem)
   */
  findAlternativePositions(cabinet, existingCabinets, room) {
    const alternatives = []
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const type = cabinet.type || 'base'
    const y = this._getYForType(type)

    const sameLevel = this._filterSameLevel(existingCabinets, type)

    // Najdi všechny možné pozice v řadách
    const rows = this._groupIntoRows(sameLevel)
    rows.forEach(row => {
      // Na začátku řady
      const leftmost = row[0]
      alternatives.push({
        position: [leftmost.position[0] - width - 0.002, y, leftmost.position[2]],
        rotation: 0,
        type: 'row_start'
      })

      // Na konci řady
      const rightmost = row[row.length - 1]
      const rightX = rightmost.position[0] + (rightmost.width || 600) / 1000
      alternatives.push({
        position: [rightX + 0.002, y, rightmost.position[2]],
        rotation: 0,
        type: 'row_end'
      })

      // V mezerách
      for (let i = 0; i < row.length - 1; i++) {
        const current = row[i]
        const next = row[i + 1]
        const currentRight = current.position[0] + (current.width || 600) / 1000
        const gap = next.position[0] - currentRight

        if (gap >= width + 0.004) {
          alternatives.push({
            position: [currentRight + 0.002, y, current.position[2]],
            rotation: 0,
            type: 'gap'
          })
        }
      }
    })

    return alternatives
  }

  // ============================================================================
  // PRIVATE PLACEMENT METHODS
  // ============================================================================

  /**
   * Zkusí umístit vedle poslední přidané skříňky (podle vybrané stěny)
   * @param {Array} sameLevel - Skříňky na stejné stěně
   * @param {number} width - Šířka nové skříňky v metrech
   * @param {number} depth - Hloubka nové skříňky v metrech
   * @param {number} y - Y pozice
   * @param {Object} room - Rozměry místnosti
   * @param {string} selectedWall - Vybraná stěna
   * @param {Object} cabinet - NOVÁ skříňka (pro výpočet offsetu)
   */
  _tryPlaceNextToLast(sameLevel, width, depth, y, room, selectedWall, cabinet) {
    // Najdi poslední přidanou (nejvyšší instanceId)
    const lastAdded = sameLevel.reduce((latest, cab) =>
      (cab.instanceId || 0) > (latest.instanceId || 0) ? cab : latest
    )

    const lastW = (lastAdded.width || 600) / 1000
    const lastD = (lastAdded.depth || 560) / 1000
    const lastRotation = lastAdded.rotation || 0
    const lastIsRotated = Math.abs(lastRotation) > 0.1

    // Pro rotované skříňky se efektivní rozměry prohodí
    const lastEffectiveW = lastIsRotated ? lastD : lastW
    const lastEffectiveD = lastIsRotated ? lastW : lastD

    // Offset od stěny pro NOVOU skříňku (ne tu předchozí!)
    const wallOffset = cabinet ? this._getWallOffset(cabinet) : 0

    // Umísti podle vybrané stěny
    switch (selectedWall) {
      case 'back':
        // Zadní stěna - umísti doprava (nová skříňka není rotovaná)
        // Skříňky těsně vedle sebe BEZ mezery
        // DŮLEŽITÉ: Z pozice podle offsetu NOVÉ skříňky, ne předchozí!
        const nextX = lastAdded.position[0] + lastEffectiveW
        if (nextX + width <= room.width / 2) {
          return {
            position: [nextX, y, -room.depth / 2 + wallOffset],
            rotation: 0
          }
        }
        return null

      case 'left':
        // Levá stěna - umísti dopředu (směrem do místnosti), rotace +90°
        // Pro rotovanou novou skříňku: efektivní hloubka ve world space = width
        // Skříňky těsně vedle sebe BEZ mezery
        // DŮLEŽITÉ: X pozice podle offsetu NOVÉ skříňky, ne předchozí!
        const nextZ_left = lastAdded.position[2] + lastEffectiveD
        if (nextZ_left + width <= room.depth / 2) { // width = efektivní hloubka rotované skříňky
          return {
            position: [-room.width / 2 + wallOffset, y, nextZ_left],
            rotation: Math.PI / 2
          }
        }
        return null

      case 'right':
        // Pravá stěna - umísti dopředu (směrem do místnosti), rotace -90°
        // Skříňky těsně vedle sebe BEZ mezery
        // DŮLEŽITÉ: X pozice podle offsetu NOVÉ skříňky, ne předchozí!
        const nextZ_right = lastAdded.position[2] + lastEffectiveD
        if (nextZ_right + width <= room.depth / 2) { // width = efektivní hloubka rotované skříňky
          return {
            position: [room.width / 2 - wallOffset, y, nextZ_right],
            rotation: -Math.PI / 2  // Záporná rotace - dvířka směřují do místnosti
          }
        }
        return null

      default:
        return null
    }
  }

  /**
   * Umístění podél boční stěny (pro rotované skříňky)
   */
  _placeAlongSideWall(lastCab, rotation, width, depth, y, room) {
    const lastZ = lastCab.position[2]
    const newZ = lastZ - width - 0.002 // Posun směrem k zadní stěně

    // Kontrola zda se vejde
    if (newZ < -room.depth / 2 + width) {
      return null // Nevejde se
    }

    if (rotation < 0) {
      // Levá stěna
      return {
        position: [-room.width / 2 + depth, y, newZ],
        rotation: -Math.PI / 2
      }
    } else {
      // Pravá stěna
      return {
        position: [room.width / 2 - depth, y, newZ],
        rotation: Math.PI / 2
      }
    }
  }

  /**
   * Hledá mezeru v existujících řadách
   * Podporuje všechny stěny (back, left, right)
   * VYLEPŠENO: Používá BoundingBox pro konzistentní výpočty
   */
  _tryPlaceInGap(sameLevel, width, depth, y, room, selectedWall = 'back', cabinet = null) {
    if (sameLevel.length < 2) return null

    const wallOffset = cabinet ? this._getWallOffset(cabinet) : 0

    // Rotace a along-axis podle stěny
    let rotation = 0
    if (selectedWall === 'left') rotation = Math.PI / 2
    if (selectedWall === 'right') rotation = -Math.PI / 2

    const isAlongX = selectedWall === 'back'

    // Seřaď podle along-wall axis pomocí BB
    const sorted = [...sameLevel].sort((a, b) => {
      const aBB = getCabinetBoundingBox(a)
      const bBB = getCabinetBoundingBox(b)
      return isAlongX ? (aBB.minX - bBB.minX) : (aBB.minZ - bBB.minZ)
    })

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentBB = getCabinetBoundingBox(sorted[i])
      const nextBB = getCabinetBoundingBox(sorted[i + 1])

      const gapStart = isAlongX ? currentBB.maxX : currentBB.maxZ
      const gapEnd = isAlongX ? nextBB.minX : nextBB.minZ
      const gap = gapEnd - gapStart

      if (gap >= width - 0.001) {
        console.log(`Found gap on ${selectedWall} wall: ${gap.toFixed(3)}m, need ${width.toFixed(3)}m`)

        if (selectedWall === 'back') {
          return { position: [gapStart, y, -room.depth / 2 + wallOffset], rotation: 0 }
        } else if (selectedWall === 'left') {
          // Pro levou stěnu: origin.z musí být tak, aby BB.minZ = gapStart
          // +90°: BB.minZ = z - width → z = gapStart + width
          return { position: [-room.width / 2 + wallOffset, y, gapStart + width], rotation: Math.PI / 2 }
        } else {
          // Pro pravou stěnu: origin.z = BB.minZ = gapStart
          return { position: [room.width / 2 - wallOffset, y, gapStart], rotation: -Math.PI / 2 }
        }
      }
    }
    return null
  }

  /**
   * Vytvoří novou řadu před stávajícími
   */
  _tryCreateNewRow(sameLevel, width, depth, y, room) {
    // Najdi hlavní řadu
    const rows = this._groupIntoRows(sameLevel)
    const mainRow = rows[0]

    if (!mainRow) {
      // Žádné řady - začni v rohu (přímo u zadní stěny)
      return {
        position: [-room.width / 2, y, -room.depth / 2],
        rotation: 0
      }
    }

    // Nová řada - posun dopředu do místnosti
    const mainRowZ = mainRow[0].position[2]
    const newZ = mainRowZ + depth + 0.1 // 10cm mezera mezi řadami

    // Kontrola zda se vejde
    if (newZ + depth > room.depth / 2) {
      return null // Nevejde se
    }

    return {
      position: [-room.width / 2, y, newZ],
      rotation: 0
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  _getYForType(type) {
    if (type === 'wall') return 1.4
    if (type === 'worktop') return 0.72
    return 0
  }

  /**
   * Vrátí počáteční pozici podle vybrané stěny
   * Pro rotované skříňky (left/right) se rozměry prohodí:
   * - effectiveWidth = depth (hloubka se stane šířkou podél zdi)
   * - effectiveDepth = width (šířka se stane hloubkou od zdi)
   *
   * DŮLEŽITÉ: Kontroluje kolize s rohovou skříňkou z vedlejší stěny
   */
  _getStartPositionForWall(wall, width, depth, y, room, existingCabinets = [], cabinet = null) {
    // Offset od stěny pro base skříňky s hloubkou 500mm
    const wallOffset = cabinet ? this._getWallOffset(cabinet) : 0

    switch (wall) {
      case 'back': {
        // Zadní stěna - levý roh, rotace 0°
        let startX = -room.width / 2

        // Nová skříňka na zadní stěně zabírá Z od -room.depth/2 + offset do -room.depth/2 + offset + depth
        const newCabMinZ = -room.depth / 2 + wallOffset
        const newCabMaxZ = -room.depth / 2 + wallOffset + depth

        // Zkontroluj, jestli nějaká skříňka z levé stěny blokuje zadní stěnu
        const leftWallCabinets = existingCabinets.filter(c => {
          const rot = c.rotation || 0
          return Math.abs(rot - Math.PI / 2) < 0.1 // +90° = levá stěna
        })

        for (const cab of leftWallCabinets) {
          const cabW = (cab.width || 600) / 1000
          const cabD = (cab.depth || 560) / 1000
          // Pro +90° rotaci: skříňka zabírá X od cab.position[0] do cab.position[0] + cabD
          // a Z od cab.position[2] - cabW do cab.position[2]
          const cabMinZ = cab.position[2] - cabW
          const cabMaxZ = cab.position[2]
          const cabMaxX = cab.position[0] + cabD

          // Pokud se Z rozsahy překrývají, je potenciální kolize
          const zOverlap = !(cabMaxZ <= newCabMinZ + 0.002 || cabMinZ >= newCabMaxZ - 0.002)

          if (zOverlap) {
            // Nová skříňka musí začít za touto skříňkou
            startX = Math.max(startX, cabMaxX + 0.002)
          }
        }

        // Zkontroluj i pravou stranu - jestli tam není skříňka z pravé stěny
        // která by blokovala pravý konec zadní stěny
        const rightWallCabinets = existingCabinets.filter(c => {
          const rot = c.rotation || 0
          return Math.abs(rot + Math.PI / 2) < 0.1 // -90° = pravá stěna
        })

        // Pro pravou stěnu: pokud blokuje, omezíme kam až může jít zadní stěna
        // Ale to řeší _tryPlaceNextToLast - tady jen posuneme startX pokud by kolidovala hned na začátku
        for (const cab of rightWallCabinets) {
          const cabW = (cab.width || 600) / 1000
          const cabD = (cab.depth || 560) / 1000
          // Pro -90° rotaci: skříňka zabírá X od cab.position[0] - cabD do cab.position[0]
          // a Z od cab.position[2] do cab.position[2] + cabW
          const cabMinX = cab.position[0] - cabD
          const cabMinZ = cab.position[2]
          const cabMaxZ = cab.position[2] + cabW

          // Pokud se Z rozsahy překrývají a skříňka zasahuje do levé části
          const zOverlap = !(cabMaxZ <= newCabMinZ + 0.002 || cabMinZ >= newCabMaxZ - 0.002)

          if (zOverlap && cabMinX <= startX + width) {
            // Pravá stěna blokuje začátek zadní stěny - tohle by nemělo nastat běžně
            // ale pokud ano, nemůžeme umístit na zadní stěnu
            console.warn('Right wall cabinet blocks back wall start')
          }
        }

        return {
          position: [startX, y, -room.depth / 2 + wallOffset],
          rotation: 0
        }
      }

      case 'left': {
        // Levá stěna: rotation +90°
        let startZ = -room.depth / 2

        // Zkontroluj, jestli nějaká skříňka ze zadní stěny blokuje levou stěnu
        const backWallCabinets = existingCabinets.filter(c => {
          const rot = c.rotation || 0
          return Math.abs(rot) < 0.1 // 0° = zadní stěna
        })

        // Nová skříňka na levé stěně zabírá X od -room.width/2 + offset do -room.width/2 + offset + depth
        const newCabMinX = -room.width / 2 + wallOffset
        const newCabMaxX = -room.width / 2 + wallOffset + depth

        for (const cab of backWallCabinets) {
          const cabW = (cab.width || 600) / 1000
          const cabD = (cab.depth || 560) / 1000
          // Pro 0° rotaci: skříňka zabírá X od cab.position[0] do cab.position[0] + cabW
          const cabMinX = cab.position[0]
          const cabMaxX = cab.position[0] + cabW
          const cabMaxZ = cab.position[2] + cabD

          // Pokud se X rozsahy překrývají, je potenciální kolize
          const xOverlap = !(cabMaxX <= newCabMinX + 0.002 || cabMinX >= newCabMaxX - 0.002)

          if (xOverlap) {
            // Nová skříňka musí začít za touto skříňkou (dál od zadní stěny)
            startZ = Math.max(startZ, cabMaxZ + 0.002)
          }
        }

        return {
          position: [-room.width / 2 + wallOffset, y, startZ],
          rotation: Math.PI / 2
        }
      }

      case 'right': {
        // Pravá stěna: rotation -90°
        let startZ = -room.depth / 2

        // Zkontroluj, jestli nějaká skříňka ze zadní stěny blokuje pravou stěnu
        const backWallCabinetsRight = existingCabinets.filter(c => {
          const rot = c.rotation || 0
          return Math.abs(rot) < 0.1 // 0° = zadní stěna
        })

        // Nová skříňka na pravé stěně zabírá X od (room.width/2 - offset - depth) do room.width/2 - offset
        const newCabMinX = room.width / 2 - wallOffset - depth
        const newCabMaxX = room.width / 2 - wallOffset

        for (const cab of backWallCabinetsRight) {
          const cabW = (cab.width || 600) / 1000
          const cabD = (cab.depth || 560) / 1000
          // Pro 0° rotaci: skříňka zabírá X od cab.position[0] do cab.position[0] + cabW
          const cabMinX = cab.position[0]
          const cabMaxX = cab.position[0] + cabW
          const cabMaxZ = cab.position[2] + cabD

          // Pokud se X rozsahy překrývají, je potenciální kolize
          const xOverlap = !(cabMaxX <= newCabMinX + 0.002 || cabMinX >= newCabMaxX - 0.002)

          if (xOverlap) {
            // Nová skříňka musí začít za touto skříňkou (dál od zadní stěny)
            startZ = Math.max(startZ, cabMaxZ + 0.002)
          }
        }

        return {
          position: [room.width / 2 - wallOffset, y, startZ],
          rotation: -Math.PI / 2
        }
      }

      default:
        // Fallback - zadní stěna
        return {
          position: [-room.width / 2, y, -room.depth / 2 + wallOffset],
          rotation: 0
        }
    }
  }

  /**
   * Zjistí ke které stěně skříňka patří podle její pozice a rotace
   */
  _getWallFromCabinet(cabinet, room) {
    const rotation = cabinet.rotation || 0
    const [x, , z] = cabinet.position

    // Nerotovaná skříňka (rotace ~0) = zadní stěna
    if (Math.abs(rotation) < 0.1) {
      return 'back'
    }

    // Rotace +90° = levá stěna
    if (Math.abs(rotation - Math.PI / 2) < 0.1) {
      return 'left'
    }

    // Rotace -90° = pravá stěna
    if (Math.abs(rotation + Math.PI / 2) < 0.1) {
      return 'right'
    }

    // Fallback - podle pozice X
    if (x < 0) {
      return 'left'
    } else {
      return 'right'
    }
  }

  _filterSameLevel(cabinets, type, selectedWall = 'back', room = { width: 4, depth: 3 }) {
    return cabinets.filter(c => {
      // Filtruj podle typu
      const typeMatch = type === 'wall'
        ? c.type === 'wall'
        : (c.type === 'base' || c.type === 'tall' || !c.type)

      if (!typeMatch) return false

      // Filtruj podle stěny
      const cabWall = this._getWallFromCabinet(c, room)
      return cabWall === selectedWall
    })
  }

  /**
   * Seskupí skříňky do řad podle Z pozice
   * @returns {Array<Array>} - Řady seřazené podle Z (nejblíže zadní stěny první)
   */
  _groupIntoRows(cabinets) {
    // Filtruj pouze nerotované
    const straight = cabinets.filter(c => Math.abs(c.rotation || 0) < 0.1)

    if (straight.length === 0) return []

    // Seskup podle Z (s tolerancí 10cm)
    const rows = {}
    straight.forEach(cab => {
      const zKey = Math.round(cab.position[2] * 10) / 10 // 10cm precision
      if (!rows[zKey]) rows[zKey] = []
      rows[zKey].push(cab)
    })

    // Převeď na array a seřaď podle Z (nejblíže k zadní stěně = nejmenší Z)
    const rowArray = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)
      .map(z => rows[z])

    return rowArray
  }
}
