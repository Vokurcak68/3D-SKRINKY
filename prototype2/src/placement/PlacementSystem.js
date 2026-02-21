/**
 * PlacementSystem - Inteligentní systém pro umísť skříněk
 *
 * Používá různé strategie pro nalezení optimální pozice.
 * Nahrazuje složitou 112-řádkovou funkci findNextPositionInLine().
 *
 * Použití:
 *   const placer = new PlacementSystem(roomConfig)
 *   const placement = placer.findNextPosition(cabinet, existingCabinets, 'smart')
 */

import { LinearPlacementStrategy } from './strategies/LinearPlacementStrategy.js'
import { SmartPlacementStrategy } from './strategies/SmartPlacementStrategy.js'
import { GridPlacementStrategy } from './strategies/GridPlacementStrategy.js'

export class PlacementSystem {
  /**
   * @param {Object} roomConfig - { width, depth, height } v metrech
   */
  constructor(roomConfig) {
    this.room = roomConfig

    // Inicializuj strategie
    this.strategies = {
      linear: new LinearPlacementStrategy(),
      smart: new SmartPlacementStrategy(),
      grid: new GridPlacementStrategy()
    }

    this.defaultStrategy = 'smart'
  }

  /**
   * Najde optimální pozici pro novou skříňku
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Array} existingCabinets - Existující skříňky
   * @param {string} strategyName - Název strategie ('linear', 'smart', 'grid')
   * @param {string} selectedWall - Vybraná stěna ('back' | 'left' | 'right' | null)
   * @returns {Object} - { position: [x,y,z], rotation: number }
   */
  findNextPosition(cabinet, existingCabinets, strategyName = null, selectedWall = null) {
    const strategy = this.strategies[strategyName || this.defaultStrategy]

    if (!strategy) {
      console.warn(`PlacementSystem: Unknown strategy '${strategyName}', using default`)
      return this.strategies[this.defaultStrategy].place(cabinet, existingCabinets, this.room, selectedWall)
    }

    return strategy.place(cabinet, existingCabinets, this.room, selectedWall)
  }

  /**
   * Najde všechny možné pozice pro skříňku
   * @returns {Array<Object>} - Array možných umístění
   */
  findAllPossiblePositions(cabinet, existingCabinets, maxPositions = 10) {
    const positions = []

    // Zkus všechny strategie
    Object.entries(this.strategies).forEach(([name, strategy]) => {
      const placement = strategy.place(cabinet, existingCabinets, this.room)
      positions.push({
        ...placement,
        strategy: name
      })
    })

    // Přidej varianty (např. různé řady)
    if (this.strategies.smart.findAlternativePositions) {
      const alternatives = this.strategies.smart.findAlternativePositions(
        cabinet,
        existingCabinets,
        this.room
      )
      positions.push(...alternatives)
    }

    // Omez počet
    return positions.slice(0, maxPositions)
  }

  /**
   * Najde nejlepší pozici podle scoring funkce
   * @param {Object} cabinet
   * @param {Array} existingCabinets
   * @param {Function} scoreFn - (placement) => number (vyšší = lepší)
   * @returns {Object}
   */
  findBestPosition(cabinet, existingCabinets, scoreFn) {
    const positions = this.findAllPossiblePositions(cabinet, existingCabinets)

    let best = positions[0]
    let bestScore = scoreFn(best)

    positions.forEach(pos => {
      const score = scoreFn(pos)
      if (score > bestScore) {
        bestScore = score
        best = pos
      }
    })

    return { ...best, score: bestScore }
  }

  /**
   * Update room konfigurace
   */
  updateRoom(roomConfig) {
    this.room = roomConfig
  }

  /**
   * Nastaví default strategii
   */
  setDefaultStrategy(strategyName) {
    if (this.strategies[strategyName]) {
      this.defaultStrategy = strategyName
    }
  }

  /**
   * Získej statistiky o strategiích
   */
  getStats() {
    return {
      availableStrategies: Object.keys(this.strategies),
      defaultStrategy: this.defaultStrategy,
      room: this.room
    }
  }
}
