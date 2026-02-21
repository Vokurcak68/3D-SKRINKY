/**
 * CabinetSnapper - Inteligentní přichytávání k hranám jiných skříněk
 *
 * PŘEPRACOVÁNO:
 * - Používá sdílený BoundingBox.js (single source of truth)
 * - Wall-agnostický kód pomocí getWallAxis() abstrakce
 * - Robustní gap detection založená na BB hranách
 * - Cross-wall collision awareness (snap neporuší kolize s vedlejší stěnou)
 *
 * Používá SpatialGrid pro O(1) vyhledávání místo O(n).
 */

import {
  getBoundingBox,
  getEffectiveDimensions,
  getWallFromRotation,
  getWallAxis,
  getAlongWallSpan,
  getCabinetBoundingBox
} from '../BoundingBox.js'

export class CabinetSnapper {
  constructor(threshold = 0.35) {
    this.threshold = threshold
    this.alignThreshold = 0.8
    this.perfectSnapThreshold = 0.05
    this.gapSearchRadius = 3.0
    this.gapSnapBonus = 0.25
  }

  /**
   * @param {Object} current - { position: [x,y,z], rotation: number }
   * @param {Object} cabinet - Skříňka k umístění
   * @param {Object} context - { spatialGrid, excludeId, cabinetType, rotationJustChanged, room }
   * @returns {Object} - { position, rotation, applied, strong }
   */
  snap(current, cabinet, context) {
    const { spatialGrid, excludeId, rotationJustChanged, room } = context
    const [x, y, z] = current.position
    const rotation = current.rotation
    const width = (cabinet.width || 600) / 1000
    const depth = (cabinet.depth || 560) / 1000
    const type = cabinet.type || 'base'

    const wall = getWallFromRotation(rotation)
    const axis = getWallAxis(rotation)
    const { effectiveW, effectiveD } = getEffectiveDimensions(width, depth, rotation)

    // Dynamický threshold při změně rotace
    const snapThreshold = rotationJustChanged
      ? Math.max(room?.width || 4, room?.depth || 3)
      : this.threshold
    const alignThreshold = rotationJustChanged ? 1.0 : this.alignThreshold

    // Hledej v okolí - při změně rotace v celé místnosti
    const baseSearchRadius = this.threshold + Math.max(width, depth) * 2
    const searchRadius = rotationJustChanged
      ? Math.max(room?.width || 4, room?.depth || 3)
      : baseSearchRadius

    // Hledej kandidáty ze spatial gridu
    const bb = getBoundingBox(x, z, width, depth, rotation)
    const centerX = (bb.minX + bb.maxX) / 2
    const centerZ = (bb.minZ + bb.maxZ) / 2
    const nearby = spatialGrid.getNearby(centerX, centerZ, searchRadius)

    // Filtruj kandidáty na stejné stěně a stejné úrovni (type)
    const candidates = nearby.filter(other => {
      if (excludeId && other.instanceId === excludeId) return false

      // Type matching
      if (type === 'wall') {
        if (other.type !== 'wall') return false
      } else {
        if (other.type === 'wall') return false
      }

      // Stejná stěna (podobná rotace)
      const otherRotation = other.rotation || 0
      if (Math.abs(rotation - otherRotation) > 0.2) return false

      return true
    })

    if (candidates.length === 0) {
      return { ...current, applied: false }
    }

    // Najdi nejlepší snap - WALL-AGNOSTICKÝ kód
    let bestSnap = null
    let minScore = Infinity

    candidates.forEach(other => {
      const otherBB = getCabinetBoundingBox(other)
      const myBB = bb

      // Along-wall axis: snap hrana k hraně
      // Into-room axis: zarovnání (align)
      let alongDist, alignDist, snapPos

      if (axis.along === 'x') {
        // Along = X, Into = Z
        alignDist = Math.abs(this._getIntoCoord(myBB, axis) - this._getIntoCoord(otherBB, axis))
        if (alignDist > alignThreshold) return

        // DŮLEŽITÉ: Zachováme aktuální Z pozici (z WallSnapperu)
        // místo kopírování Z z referenční skříňky.
        // Různé typy skříněk mají různý offset od stěny.
        const snapZ = z

        // Snap: pravá hrana other → levá hrana nové
        const distRight = Math.abs(myBB.minX - otherBB.maxX)
        if (distRight < snapThreshold && distRight + alignDist * 0.5 < minScore) {
          minScore = distRight + alignDist * 0.5
          bestSnap = {
            position: [otherBB.maxX, y, snapZ],
            edge: 'right-to-left',
            distance: distRight,
            other
          }
        }

        // Snap: levá hrana other → pravá hrana nové
        const distLeft = Math.abs(myBB.maxX - otherBB.minX)
        if (distLeft < snapThreshold && distLeft + alignDist * 0.5 < minScore) {
          minScore = distLeft + alignDist * 0.5
          bestSnap = {
            position: [otherBB.minX - effectiveW, y, snapZ],
            edge: 'left-to-right',
            distance: distLeft,
            other
          }
        }
      } else {
        // Along = Z, Into = X
        alignDist = Math.abs(this._getIntoCoord(myBB, axis) - this._getIntoCoord(otherBB, axis))
        if (alignDist > alignThreshold) return

        // DŮLEŽITÉ: Zachováme aktuální X pozici (z WallSnapperu)
        const snapX = x

        // Snap: maxZ edge other → minZ edge nové
        const distTop = Math.abs(myBB.minZ - otherBB.maxZ)
        if (distTop < snapThreshold && distTop + alignDist * 0.5 < minScore) {
          minScore = distTop + alignDist * 0.5
          // Pozice originu: závisí na rotaci
          const snapZ = this._originFromBBMinZ(otherBB.maxZ, width, depth, rotation)
          bestSnap = {
            position: [snapX, y, snapZ],
            edge: 'top-to-bottom',
            distance: distTop,
            other
          }
        }

        // Snap: minZ edge other → maxZ edge nové
        const distBottom = Math.abs(myBB.maxZ - otherBB.minZ)
        if (distBottom < snapThreshold && distBottom + alignDist * 0.5 < minScore) {
          minScore = distBottom + alignDist * 0.5
          const snapZ = this._originFromBBMaxZ(otherBB.minZ, width, depth, rotation)
          bestSnap = {
            position: [snapX, y, snapZ],
            edge: 'bottom-to-top',
            distance: distBottom,
            other
          }
        }
      }
    })

    // GAP DETECTION - hledej mezery v řadě
    // Předáváme aktuální pozici (z WallSnapperu) aby se zachoval správný offset od stěny
    const gapSnap = this._findGapSnap(x, y, z, width, depth, rotation, candidates, type, snapThreshold, room, current.position)
    if (gapSnap) {
      const gapScore = gapSnap.distance - this.gapSnapBonus
      if (gapScore < minScore) {
        bestSnap = gapSnap
        minScore = gapScore
      }
    }

    if (bestSnap) {
      const isPerfect = bestSnap.distance < this.perfectSnapThreshold

      return {
        position: bestSnap.position,
        rotation: rotation,
        applied: true,
        strong: isPerfect,
        snapDistance: bestSnap.distance,
        snappedTo: bestSnap.other?.instanceId,
        snappedEdge: bestSnap.edge
      }
    }

    return { ...current, applied: false }
  }

  /**
   * Robustní gap detection - hledá mezery mezi skříňkami
   * Používá BoundingBox pro konzistentní BB výpočty
   */
  _findGapSnap(x, y, z, width, depth, rotation, candidates, type, snapThreshold, room, currentPosition = null) {
    if (candidates.length < 1) return null

    const axis = getWallAxis(rotation)
    const { effectiveW, effectiveD } = getEffectiveDimensions(width, depth, rotation)
    const myBB = getBoundingBox(x, z, width, depth, rotation)

    // Along-wall extent: pro back/front stěnu (along=x) je to effectiveW (X-extent),
    // pro left/right stěnu (along=z) je to effectiveD (Z-extent)
    const alongExtent = axis.along === 'x' ? effectiveW : effectiveD

    // Seřaď kandidáty podle along-wall axis (pomocí BB)
    const sorted = [...candidates].sort((a, b) => {
      const aBB = getCabinetBoundingBox(a)
      const bBB = getCabinetBoundingBox(b)
      if (axis.along === 'x') return aBB.minX - bBB.minX
      return aBB.minZ - bBB.minZ
    })

    let bestGap = null
    let bestGapDistance = Infinity

    // Hledej mezery MEZI skříňkami
    for (let i = 0; i < sorted.length - 1; i++) {
      const leftCab = sorted[i]
      const rightCab = sorted[i + 1]
      const leftBB = getCabinetBoundingBox(leftCab)
      const rightBB = getCabinetBoundingBox(rightCab)

      let gapStart, gapEnd
      if (axis.along === 'x') {
        gapStart = leftBB.maxX
        gapEnd = rightBB.minX
      } else {
        gapStart = leftBB.maxZ
        gapEnd = rightBB.minZ
      }

      const gapSize = gapEnd - gapStart

      // Skříňka se vejde? (s 1mm tolerancí)
      if (gapSize >= alongExtent - 0.001) {
        const gap = this._evaluateGap(myBB, gapStart, gapEnd, alongExtent, axis, snapThreshold)
        if (gap && gap.distance < bestGapDistance) {
          bestGapDistance = gap.distance
          bestGap = this._buildGapResult(gap.snapAlongPos, y, rotation, width, depth, axis,
            leftCab, rightCab, gap.distance, gap.snapToStart, currentPosition)
        }
      }
    }

    // Hledej mezery U OKRAJE MÍSTNOSTI (stěna → první skříňka, poslední → stěna)
    if (room && sorted.length >= 1) {
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const firstBB = getCabinetBoundingBox(first)
      const lastBB = getCabinetBoundingBox(last)

      let wallStart, wallEnd
      if (axis.along === 'x') {
        wallStart = -room.width / 2
        wallEnd = room.width / 2
      } else {
        wallStart = -room.depth / 2
        wallEnd = room.depth / 2
      }

      // Mezera vlevo/nahoře (stěna → první skříňka)
      const leftGapStart = wallStart
      const leftGapEnd = axis.along === 'x' ? firstBB.minX : firstBB.minZ
      const leftGapSize = leftGapEnd - leftGapStart
      if (leftGapSize >= alongExtent - 0.001) {
        const gap = this._evaluateGap(myBB, leftGapStart, leftGapEnd, alongExtent, axis, snapThreshold)
        if (gap && gap.distance < bestGapDistance) {
          bestGapDistance = gap.distance
          bestGap = this._buildGapResult(gap.snapAlongPos, y, rotation, width, depth, axis,
            null, first, gap.distance, gap.snapToStart, currentPosition)
        }
      }

      // Mezera vpravo/dole (poslední skříňka → stěna)
      const rightGapStart = axis.along === 'x' ? lastBB.maxX : lastBB.maxZ
      const rightGapEnd = wallEnd
      const rightGapSize = rightGapEnd - rightGapStart
      if (rightGapSize >= alongExtent - 0.001) {
        const gap = this._evaluateGap(myBB, rightGapStart, rightGapEnd, alongExtent, axis, snapThreshold)
        if (gap && gap.distance < bestGapDistance) {
          bestGapDistance = gap.distance
          bestGap = this._buildGapResult(gap.snapAlongPos, y, rotation, width, depth, axis,
            last, null, gap.distance, gap.snapToStart, currentPosition)
        }
      }
    }

    return bestGap
  }

  /**
   * Evaluace mezery - je kurzor blízko? Ke které hraně snapnout?
   */
  _evaluateGap(myBB, gapStart, gapEnd, alongExtent, axis, threshold) {
    let myStart, myEnd
    if (axis.along === 'x') {
      myStart = myBB.minX
      myEnd = myBB.maxX
    } else {
      myStart = myBB.minZ
      myEnd = myBB.maxZ
    }

    // Je kurzor v oblasti mezery nebo blízko ní?
    const isInOrNear = myEnd > gapStart - threshold && myStart < gapEnd + threshold
    if (!isInOrNear) return null

    // Snap k nejbližší hraně mezery
    const distToStart = Math.abs(myStart - gapStart)
    const distToEnd = Math.abs(myEnd - gapEnd)
    const snapToStart = distToStart <= distToEnd
    const snapAlongPos = snapToStart ? gapStart : gapEnd - alongExtent
    const distance = Math.min(distToStart, distToEnd)

    return { snapAlongPos, distance, snapToStart }
  }

  /**
   * Sestaví výsledek gap snapu - přepočítá origin pozici z along-wall pozice
   */
  _buildGapResult(snapAlongPos, y, rotation, width, depth, axis, leftCab, rightCab, distance, snapToStart, currentPosition = null) {
    // Potřebujeme referenční "into" pozici
    // DŮLEŽITÉ: Používáme aktuální pozici (z WallSnapperu) pokud existuje,
    // protože různé typy skříněk mají různý offset od stěny
    // (např. base 500mm má 65mm offset, tall nemá)
    const refCab = snapToStart ? (leftCab || rightCab) : (rightCab || leftCab)

    let position
    if (axis.along === 'x') {
      // Along X (back/front wall): zachovat Z z aktuální pozice (WallSnapper offset)
      const intoZ = currentPosition ? currentPosition[2] : (refCab ? refCab.position[2] : 0)
      position = [snapAlongPos, y, intoZ]
    } else {
      // Along Z (left/right wall): zachovat X z aktuální pozice (WallSnapper offset)
      const intoX = currentPosition ? currentPosition[0] : (refCab ? refCab.position[0] : 0)
      const originZ = this._originFromBBMinZ(snapAlongPos, width, depth, rotation)
      position = [intoX, y, originZ]
    }

    return {
      position,
      edge: 'gap',
      distance,
      other: refCab,
      isGap: true
    }
  }

  /**
   * Přepočet origin Z z BB.minZ
   * Pro +90°: origin.z = BB.maxZ, takže BB.minZ = origin.z - width → origin.z = BB.minZ + width
   * Pro -90°: origin.z = BB.minZ → origin.z = BB.minZ
   * Pro 0°: origin.z = BB.minZ → origin.z = BB.minZ
   */
  _originFromBBMinZ(bbMinZ, width, depth, rotation) {
    const wall = getWallFromRotation(rotation)
    if (wall === 'left') {
      // +90°: BB.minZ = z - width → z = BB.minZ + width
      return bbMinZ + width
    }
    // 0° nebo -90°: origin.z = BB.minZ
    return bbMinZ
  }

  /**
   * Přepočet origin Z z BB.maxZ
   */
  _originFromBBMaxZ(bbMaxZ, width, depth, rotation) {
    const wall = getWallFromRotation(rotation)
    if (wall === 'left') {
      // +90°: BB.maxZ = z → origin.z = BB.maxZ
      return bbMaxZ
    }
    // 0°: BB.maxZ = z + depth → z = BB.maxZ - depth
    if (wall === 'back') return bbMaxZ - depth
    // -90°: BB.maxZ = z + width → z = BB.maxZ - width
    return bbMaxZ - width
  }

  /**
   * Vrátí "into room" koordinátu z BB (pro align check)
   */
  _getIntoCoord(bb, axis) {
    if (axis.into === 'z') {
      return (bb.minZ + bb.maxZ) / 2
    }
    return (bb.minX + bb.maxX) / 2
  }

  /**
   * Vrátí snap pointy pro vizualizaci
   */
  getSnapPoints(current, cabinet, context) {
    const { spatialGrid, excludeId } = context
    const [x, y, z] = current.position
    const width = (cabinet.width || 600) / 1000

    const nearby = spatialGrid ? spatialGrid.getNearby(x, z, 2.0) : []
    const points = []

    nearby.forEach(other => {
      if (excludeId && other.instanceId === excludeId) return

      const otherBB = getCabinetBoundingBox(other)
      const otherRotation = other.rotation || 0

      if (Math.abs(otherRotation) < 0.1) {
        points.push({
          type: 'cabinet_edge_right',
          position: [otherBB.maxX, y, other.position[2]],
          rotation: 0,
          cabinetId: other.instanceId
        })
        points.push({
          type: 'cabinet_edge_left',
          position: [otherBB.minX, y, other.position[2]],
          rotation: 0,
          cabinetId: other.instanceId
        })
      } else {
        points.push({
          type: 'cabinet_edge_top',
          position: [other.position[0], y, otherBB.maxZ],
          rotation: otherRotation,
          cabinetId: other.instanceId
        })
        points.push({
          type: 'cabinet_edge_bottom',
          position: [other.position[0], y, otherBB.minZ],
          rotation: otherRotation,
          cabinetId: other.instanceId
        })
      }
    })

    return points
  }

  /**
   * Najde nejbližší snap edge
   */
  findClosestEdge(position, cabinet, context) {
    const result = this.snap({ position, rotation: 0 }, cabinet, context)

    if (result.applied) {
      return {
        position: result.position,
        distance: result.snapDistance,
        edge: result.snappedEdge,
        cabinetId: result.snappedTo
      }
    }

    return null
  }

  /**
   * Kontrola zda je skříňka aligned s jinou
   */
  isAligned(cabinet1, cabinet2) {
    const rot1 = cabinet1.rotation || 0
    const rot2 = cabinet2.rotation || 0
    if (Math.abs(rot1 - rot2) > 0.1) return false

    if (Math.abs(rot1) < 0.1) {
      return Math.abs(cabinet1.position[2] - cabinet2.position[2]) < 0.05
    } else {
      return Math.abs(cabinet1.position[0] - cabinet2.position[0]) < 0.05
    }
  }

  /**
   * Najde všechny skříňky ve stejné řadě
   */
  findRow(cabinet, spatialGrid) {
    const [x, y, z] = cabinet.position
    const rotation = cabinet.rotation || 0

    const nearby = spatialGrid.getNearby(x, z, 4.0)

    return nearby.filter(other => {
      if (other.instanceId === cabinet.instanceId) return false

      const otherRotation = other.rotation || 0
      if (Math.abs(rotation - otherRotation) > 0.1) return false

      if (Math.abs(rotation) < 0.1) {
        return Math.abs(z - other.position[2]) < 0.05
      } else {
        return Math.abs(x - other.position[0]) < 0.05
      }
    })
  }
}
