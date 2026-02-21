import { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useStore } from '../store'
import { textureManager } from '../utils/TextureManager'

// ============================================================================
// GEOMETRY CACHE - Staticka geometrie se vytvori jednou a pouziva opakovane
// ============================================================================
const geometryCache = new Map()

function getOrCreateGeometry(type, width, height, depth) {
  const key = `${type}_${width.toFixed(3)}_${height.toFixed(3)}_${depth.toFixed(3)}`

  if (!geometryCache.has(key)) {
    const t = 0.018 // tlouska materialu
    const geometries = { corpus: [], door: null, plinth: null }

    if (type === 'base') {
      // Levy bok
      const leftGeo = new THREE.BoxGeometry(t, height, depth)
      leftGeo.translate(t/2, height/2, depth/2)
      geometries.corpus.push(leftGeo)

      // Pravy bok
      const rightGeo = new THREE.BoxGeometry(t, height, depth)
      rightGeo.translate(width - t/2, height/2, depth/2)
      geometries.corpus.push(rightGeo)

      // Spodek
      const bottomGeo = new THREE.BoxGeometry(width - 2*t, t, depth)
      bottomGeo.translate(width/2, t/2, depth/2)
      geometries.corpus.push(bottomGeo)

      // Zada - na z=0 (u zdi)
      const backGeo = new THREE.BoxGeometry(width - 2*t, height - t, t/2)
      backGeo.translate(width/2, (height + t)/2, t/4)
      geometries.corpus.push(backGeo)

      // Dvirka - na z=depth (smerem do mistnosti)
      geometries.door = new THREE.BoxGeometry(width - 0.004, height - 0.004, t)
      geometries.door.translate(width/2, height/2, depth - t/2)

      // Sokl
      const plinthHeight = 0.1
      geometries.plinth = new THREE.BoxGeometry(width - 0.02, plinthHeight, depth - 0.05)
      geometries.plinth.translate(width/2, plinthHeight/2, depth/2 + 0.02)

    } else if (type === 'wall') {
      // Levy bok
      const leftGeo = new THREE.BoxGeometry(t, height, depth)
      leftGeo.translate(t/2, height/2, depth/2)
      geometries.corpus.push(leftGeo)

      // Pravy bok
      const rightGeo = new THREE.BoxGeometry(t, height, depth)
      rightGeo.translate(width - t/2, height/2, depth/2)
      geometries.corpus.push(rightGeo)

      // Spodek
      const bottomGeo = new THREE.BoxGeometry(width - 2*t, t, depth)
      bottomGeo.translate(width/2, t/2, depth/2)
      geometries.corpus.push(bottomGeo)

      // Vrch
      const topGeo = new THREE.BoxGeometry(width - 2*t, t, depth)
      topGeo.translate(width/2, height - t/2, depth/2)
      geometries.corpus.push(topGeo)

      // Zada - na z=0 (u zdi)
      const backGeo = new THREE.BoxGeometry(width - 2*t, height - 2*t, t/2)
      backGeo.translate(width/2, height/2, t/4)
      geometries.corpus.push(backGeo)

      // Dvirka - na z=depth (smerem do mistnosti)
      geometries.door = new THREE.BoxGeometry(width - 0.004, height - 0.004, t)
      geometries.door.translate(width/2, height/2, depth - t/2)

    } else if (type === 'tall') {
      // Levy bok
      const leftGeo = new THREE.BoxGeometry(t, height, depth)
      leftGeo.translate(t/2, height/2, depth/2)
      geometries.corpus.push(leftGeo)

      // Pravy bok
      const rightGeo = new THREE.BoxGeometry(t, height, depth)
      rightGeo.translate(width - t/2, height/2, depth/2)
      geometries.corpus.push(rightGeo)

      // Spodek
      const bottomGeo = new THREE.BoxGeometry(width - 2*t, t, depth)
      bottomGeo.translate(width/2, t/2, depth/2)
      geometries.corpus.push(bottomGeo)

      // Vrch
      const topGeo = new THREE.BoxGeometry(width - 2*t, t, depth)
      topGeo.translate(width/2, height - t/2, depth/2)
      geometries.corpus.push(topGeo)

      // Zada - na z=0 (u zdi)
      const backGeo = new THREE.BoxGeometry(width - 2*t, height - 2*t, t/2)
      backGeo.translate(width/2, height/2, t/4)
      geometries.corpus.push(backGeo)

      // Police
      const shelfCount = Math.floor(height / 0.35)
      for (let i = 1; i < shelfCount; i++) {
        const shelfY = i * (height / shelfCount)
        const shelfGeo = new THREE.BoxGeometry(width - 2*t, t, depth - t)
        shelfGeo.translate(width/2, shelfY, depth/2 + t/2)
        geometries.corpus.push(shelfGeo)
      }

      // Dvirka - rozdelene (pole) - na z=depth (smerem do mistnosti)
      const doorHeight = height / 2 - 0.005
      const doorTopGeo = new THREE.BoxGeometry(width - 0.004, doorHeight, t)
      doorTopGeo.translate(width/2, height - doorHeight/2 - 0.002, depth - t/2)

      const doorBottomGeo = new THREE.BoxGeometry(width - 0.004, doorHeight, t)
      doorBottomGeo.translate(width/2, doorHeight/2 + 0.002, depth - t/2)

      geometries.door = [doorTopGeo, doorBottomGeo]

      // Sokl
      const plinthHeight = 0.1
      geometries.plinth = new THREE.BoxGeometry(width - 0.02, plinthHeight, depth - 0.05)
      geometries.plinth.translate(width/2, plinthHeight/2, depth/2 + 0.02)

    } else if (type === 'worktop') {
      // Pracovni deska - jednoduchy box
      const worktopGeo = new THREE.BoxGeometry(width, height, depth)
      worktopGeo.translate(width/2, height/2, depth/2)
      geometries.corpus.push(worktopGeo)
      // Worktop nema dvirka ani sokl
    }

    geometryCache.set(key, geometries)
  }

  return geometryCache.get(key)
}

// ============================================================================
// HANDLE COMPONENT - Madlo
// ============================================================================
function Handle({ position, width }) {
  const handleMaterial = textureManager.getMaterial('stainlessHandle')
  const handleLength = Math.min(width * 0.6, 0.15)

  if (!handleMaterial) return null

  return (
    <group position={position}>
      <mesh position={[0, 0, 0.012]} material={handleMaterial}>
        <boxGeometry args={[handleLength, 0.012, 0.008]} />
      </mesh>
      <mesh position={[handleLength/2 - 0.01, 0, 0.006]} rotation={[0, 0, Math.PI/2]} material={handleMaterial}>
        <cylinderGeometry args={[0.004, 0.004, 0.012, 8]} />
      </mesh>
      <mesh position={[-handleLength/2 + 0.01, 0, 0.006]} rotation={[0, 0, Math.PI/2]} material={handleMaterial}>
        <cylinderGeometry args={[0.004, 0.004, 0.012, 8]} />
      </mesh>
    </group>
  )
}

// ============================================================================
// SINK 3D - Nerezový dřez s baterií
// ============================================================================

function Sink3D({ sinkInfo, worktopDepth, worktopHeight }) {
  // Rozměry dřezu
  const sinkW = Math.min((sinkInfo.width - 100) / 1000, 0.68)
  const sinkD = Math.min(worktopDepth - 0.12, 0.40)
  const rim = 0.03

  // Pozice středu dřezu na worktop
  const px = (sinkInfo.offsetFromLeft + sinkInfo.width / 2) / 1000
  const pz = worktopDepth / 2

  return (
    <group position={[px, worktopHeight + 0.001, pz]}>
      {/* ========== TMAVÁ PLOCHA = DŘEZ (vizuální díra) ========== */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[sinkW, sinkD]} />
        <meshBasicMaterial color={0x252525} />
      </mesh>

      {/* ========== RÁM DŘEZU (stříbrný, výraznější) ========== */}
      {/* Přední */}
      <mesh position={[0, 0.008, sinkD/2 + rim/2]}>
        <boxGeometry args={[sinkW + rim*2, 0.016, rim]} />
        <meshLambertMaterial color={0xb0b0b0} />
      </mesh>
      {/* Zadní */}
      <mesh position={[0, 0.008, -sinkD/2 - rim/2]}>
        <boxGeometry args={[sinkW + rim*2, 0.016, rim]} />
        <meshLambertMaterial color={0xb0b0b0} />
      </mesh>
      {/* Levý */}
      <mesh position={[-sinkW/2 - rim/2, 0.008, 0]}>
        <boxGeometry args={[rim, 0.016, sinkD]} />
        <meshLambertMaterial color={0xb0b0b0} />
      </mesh>
      {/* Pravý */}
      <mesh position={[sinkW/2 + rim/2, 0.008, 0]}>
        <boxGeometry args={[rim, 0.016, sinkD]} />
        <meshLambertMaterial color={0xb0b0b0} />
      </mesh>

      {/* ========== ODTOK (na tmavé ploše) ========== */}
      <mesh position={[0, 0.003, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.006, 24]} />
        <meshLambertMaterial color={0x444444} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.004, 16]} />
        <meshLambertMaterial color={0x666666} />
      </mesh>

      {/* ========== BATERIE ========== */}
      <group position={[0, 0, -sinkD/2 - rim - 0.03]}>
        {/* Základna */}
        <mesh position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.024, 0.03, 0.05, 24]} />
          <meshLambertMaterial color={0xd0d0d0} />
        </mesh>
        {/* Tělo */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.28, 20]} />
          <meshLambertMaterial color={0xd0d0d0} />
        </mesh>
        {/* Ohyb */}
        <mesh position={[0, 0.30, 0.03]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.1, 16]} />
          <meshLambertMaterial color={0xd0d0d0} />
        </mesh>
        {/* Výtok */}
        <mesh position={[0, 0.28, 0.10]} rotation={[1.4, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.012, 0.07, 16]} />
          <meshLambertMaterial color={0xd0d0d0} />
        </mesh>
        {/* Páka */}
        <mesh position={[0.04, 0.24, 0]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[0.07, 0.014, 0.014]} />
          <meshLambertMaterial color={0xd0d0d0} />
        </mesh>
      </group>
    </group>
  )
}

// ============================================================================
// SELECTION OVERLAY - Samostatna vrstva pro highlight (NEMENI geometrii)
// ============================================================================
function SelectionOverlay({ width, height, depth, isSelected, isDragging, isHovered, isConstraintViolated }) {
  const color = isDragging
    ? '#2196f3'
    : isSelected
      ? '#1a5fb4'
      : isConstraintViolated
        ? '#d9480f'
        : isHovered
          ? '#4a90d9'
          : '#888'
  const opacity = isDragging ? 1.0 : isSelected ? 0.8 : isConstraintViolated ? 0.85 : isHovered ? 0.6 : 0.3
  const lineWidth = isDragging || isSelected ? 2 : 1

  // Edges geometry - vytvorena jednou
  const edgesGeo = useMemo(() => {
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth))
  }, [width, height, depth])

  return (
    <>
      {/* Obrysova cara - RAYCAST DISABLED aby neprekryvala jine skrinky */}
      <lineSegments position={[width/2, height/2, depth/2]} geometry={edgesGeo} raycast={() => null}>
        <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={lineWidth} />
      </lineSegments>

      {/* Stin pri tazeni - RAYCAST DISABLED */}
      {isDragging && (
        <mesh position={[width/2, 0.002, depth/2]} rotation={[-Math.PI/2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[width + 0.02, depth + 0.02]} />
          <meshBasicMaterial color="#2196f3" transparent opacity={0.25} />
        </mesh>
      )}

      {/* Highlight obrys pri vyberu - RAYCAST DISABLED */}
      {(isSelected || isDragging) && (
        <mesh position={[width/2, height/2, depth/2]} raycast={() => null}>
          <boxGeometry args={[width + 0.006, height + 0.006, depth + 0.006]} />
          <meshBasicMaterial
            color={isDragging ? '#2196f3' : '#1a5fb4'}
            transparent
            opacity={0.08}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </>
  )
}

// ============================================================================
// SNAP CONNECTORS - Zelene linky spojeni se sousedy
// ============================================================================
function SnapConnectors({ cabinet, width, height, depth }) {
  // DULEZITE: Jednotlivy selektor - re-render pouze pri zmene placedCabinets
  const placedCabinets = useStore(s => s.placedCabinets)

  const neighbors = useMemo(() => {
    const result = { left: null, right: null }
    const myX = cabinet.position[0]
    const myZ = cabinet.position[2]
    const myRight = myX + width

    const sameLevelCabs = placedCabinets.filter(c =>
      c.instanceId !== cabinet.instanceId &&
      ((cabinet.type === 'wall' && c.type === 'wall') ||
       (cabinet.type !== 'wall' && c.type !== 'wall'))
    )

    for (const other of sameLevelCabs) {
      const otherX = other.position[0]
      const otherZ = other.position[2]
      const otherW = (other.width || 600) / 1000
      const otherRight = otherX + otherW

      if (Math.abs(myZ - otherZ) > 0.1) continue

      if (Math.abs(myX - otherRight) < 0.01) {
        result.left = { height: (other.height || 720) / 1000 }
      }
      if (Math.abs(myRight - otherX) < 0.01) {
        result.right = { height: (other.height || 720) / 1000 }
      }
    }

    return result
  }, [cabinet, placedCabinets, width])

  return (
    <>
      {neighbors.left && (
        <mesh position={[0.002, height/2, depth/2]} raycast={() => null}>
          <boxGeometry args={[0.004, Math.min(height, neighbors.left.height) - 0.02, 0.02]} />
          <meshBasicMaterial color="#4caf50" />
        </mesh>
      )}
      {neighbors.right && (
        <mesh position={[width - 0.002, height/2, depth/2]} raycast={() => null}>
          <boxGeometry args={[0.004, Math.min(height, neighbors.right.height) - 0.02, 0.02]} />
          <meshBasicMaterial color="#4caf50" />
        </mesh>
      )}
    </>
  )
}

// ============================================================================
// CABINET 3D - Hlavni komponenta skrinky
// ============================================================================
export function Cabinet3D({ cabinet, isSelected }) {
  const groupRef = useRef()
  const [hovered, setHovered] = useState(false)

  // Store - pouzij SELEKTORY pro minimalni re-rendery
  const updateCabinetPosition = useStore(s => s.updateCabinetPosition)
  const updateCabinetRotation = useStore(s => s.updateCabinetRotation)
  const selectCabinet = useStore(s => s.selectCabinet)
  const startDragging = useStore(s => s.startDragging)
  const stopDragging = useStore(s => s.stopDragging)
  const draggingCabinetId = useStore(s => s.draggingCabinetId)
  const constraintViolations = useStore(s => s.constraintViolations)

  // Dekory - selektory
  const globalDecors = useStore(s => s.globalDecors)
  const findDecorById = useStore(s => s.findDecorById)

  // Je TATO skrinka prave tazena?
  const isBeingDragged = draggingCabinetId === cabinet.instanceId
  const isConstraintViolated = constraintViolations.includes(cabinet.instanceId)

  // Three.js - stabilni reference
  const { gl, controls, camera, raycaster } = useThree()

  // Floor plane pro raycast (Y = vyska skrinky pro horni, 0 pro spodni)
  const floorPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // Rozmery v metrech - STATICKE pro tuto skrinku
  const width = (cabinet.width || 600) / 1000
  const height = (cabinet.height || 720) / 1000
  const depth = (cabinet.depth || 560) / 1000
  const cabType = cabinet.type || 'base'
  const t = 0.018

  // GEOMETRIE - cachovana
  const geometries = useMemo(() => {
    return getOrCreateGeometry(cabType, width, height, depth)
  }, [cabType, width, height, depth])

  // MATERIALY z dekoru - pouzij vybrane dekory nebo fallback
  const corpusMaterial = useMemo(() => {
    // Pro worktop pouzij countertopDecor, pro ostatni bodyDecor
    const isWorktop = cabType === 'worktop'
    const decorId = isWorktop
      ? (cabinet.decors?.countertopDecor || globalDecors.countertopDecor)
      : (cabinet.decors?.bodyDecor || globalDecors.bodyDecor)

    if (decorId) {
      const decorData = findDecorById(decorId)
      if (decorData) {
        return textureManager.getDecorMaterial(decorId, decorData, isWorktop ? 'countertop' : 'body')
      }
    }
    // Fallback
    const fallback = textureManager.getMaterial('lightOak')
    if (fallback) return fallback
    // Ultimate fallback - svetly dub
    return new THREE.MeshStandardMaterial({
      color: '#c4a77d',
      roughness: 0.6,
      metalness: 0.0
    })
  }, [cabType, cabinet.decors?.bodyDecor, cabinet.decors?.countertopDecor, globalDecors.bodyDecor, globalDecors.countertopDecor, findDecorById])

  // Material pro dvirka (dekor) - jeden material pro vsechny strany
  const doorMaterial = useMemo(() => {
    const decorId = cabinet.decors?.frontDecor || globalDecors.frontDecor
    if (decorId) {
      const decorData = findDecorById(decorId)
      if (decorData) {
        return textureManager.getDecorMaterial(decorId, decorData, 'front')
      }
    }
    return textureManager.getMaterial('whiteFront')
  }, [cabinet.decors?.frontDecor, globalDecors.frontDecor, findDecorById])

  const plinthMaterial = textureManager.getMaterial('plinth')

  // INSTANCEID jako konstanta - NEMENI SE
  const instanceId = cabinet.instanceId

  // Pomocna funkce pro vypocet pozice na podlaze z mouse coords
  const getFloorPosition = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )

    raycaster.setFromCamera(mouse, camera)
    const intersection = new THREE.Vector3()

    // Nastav vysku plane podle typu skrinky
    const planeY = cabinet.type === 'wall' ? -1.4 : 0
    floorPlaneRef.current.constant = planeY

    raycaster.ray.intersectPlane(floorPlaneRef.current, intersection)
    return intersection
  }, [gl, camera, raycaster, cabinet.type])

  // ===== POINTER DOWN =====
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.stopPropagation()

    // Ziskej instanceId PRIMO z kliknute group (userData)
    let clickedGroup = e.object
    while (clickedGroup && !clickedGroup.userData?.cabinetId) {
      clickedGroup = clickedGroup.parent
    }

    const clickedId = clickedGroup?.userData?.cabinetId

    // Reaguj POUZE pokud jsme klikli na TUTO skrinku
    if (clickedId !== instanceId) return

    // Vypni OrbitControls
    if (controls) controls.enabled = false

    // Najdi skrinku ve store
    const store = useStore.getState()
    const cab = store.placedCabinets.find(c => c.instanceId === instanceId)

    if (!cab) return

    selectCabinet(cab)

    // Vypocitej floor position a offset
    const floorPos = getFloorPosition(e.clientX, e.clientY)
    const offsetX = cab.position[0] - floorPos.x
    const offsetZ = cab.position[2] - floorPos.z

    // Zacni tazeni
    startDragging(instanceId, offsetX, offsetZ)
    gl.domElement.style.cursor = 'grabbing'
  }, [instanceId, selectCabinet, startDragging, gl, controls, getFloorPosition])

  const handlePointerOver = useCallback((e) => {
    // Zkontroluj ze event patri TETO skrince
    let clickedGroup = e.object
    while (clickedGroup && !clickedGroup.userData?.cabinetId) {
      clickedGroup = clickedGroup.parent
    }
    if (clickedGroup?.userData?.cabinetId !== instanceId) return

    e.stopPropagation()
    setHovered(true)
    if (!useStore.getState().isDragging) gl.domElement.style.cursor = 'grab'
  }, [instanceId, gl])

  const handlePointerOut = useCallback((e) => {
    // Zkontroluj ze event patri TETO skrince
    let clickedGroup = e.object
    while (clickedGroup && !clickedGroup.userData?.cabinetId) {
      clickedGroup = clickedGroup.parent
    }
    if (clickedGroup?.userData?.cabinetId !== instanceId) return

    setHovered(false)
    if (!useStore.getState().isDragging) gl.domElement.style.cursor = 'default'
  }, [instanceId, gl])

  // ===== GLOBALNI LISTENER PRO POHYB A PUSTENI =====
  useEffect(() => {
    if (!isBeingDragged) return

    const handleGlobalPointerMove = (e) => {
      const store = useStore.getState()
      if (store.draggingCabinetId !== instanceId) return

      const cab = store.placedCabinets.find(c => c.instanceId === instanceId)
      if (!cab) return

      // Vypocitej pozici na podlaze
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )

      raycaster.setFromCamera(mouse, camera)
      const intersection = new THREE.Vector3()
      const planeY = cab.type === 'wall' ? -1.4 : 0
      floorPlaneRef.current.constant = planeY
      raycaster.ray.intersectPlane(floorPlaneRef.current, intersection)

      if (!intersection) return

      const offset = store.dragOffset
      const rawX = intersection.x + offset.x
      const rawZ = intersection.z + offset.z
      // Použij VIZUÁLNÍ rotaci z Three.js (ne uloženou v state)
      // Díky tomu WallSnapper nemusí přepočítávat rotaci každý frame od nuly
      // a rotace se plynule mění při přechodu mezi stěnami
      const rotation = groupRef.current ? groupRef.current.rotation.y : (cab.rotation || 0)
      const roomW = store.roomWidth / 1000
      const roomD = store.roomDepth / 1000

      // UNIFIED FLOW: snap → clamp (bez collision check při pohybu)
      // Snap PRVNÍ, pak clamp - aby snap mohl přitáhnout ke stěně
      const result = store._collision.checkPlacement(
        cab,
        [rawX, cab.position[1], rawZ],
        rotation,
        instanceId,
        {
          snap: true,
          snapSystem: store._snapSystem,
          snapContext: {
            spatialGrid: store._spatialGrid,
            excludeId: instanceId,
            cabinetType: cab.type,
            room: { width: roomW, depth: roomD }
          }
        }
      )

      // OKAMŽITÝ imperativní update - POUZE Three.js vizuální feedback
      if (groupRef.current) {
        groupRef.current.position.set(result.position[0], cab.position[1], result.position[2])
        groupRef.current.rotation.y = result.rotation
      }
    }

    const handleGlobalPointerUp = () => {
      const store = useStore.getState()
      if (store.draggingCabinetId !== instanceId) return

      const cab = store.placedCabinets.find(c => c.instanceId === instanceId)
      if (cab && groupRef.current) {
        const roomW = store.roomWidth / 1000
        const roomD = store.roomDepth / 1000

        // Použij aktuální pozici z Three.js objektu
        const x = groupRef.current.position.x
        const y = groupRef.current.position.y
        const z = groupRef.current.position.z
        const rotation = groupRef.current.rotation.y

        // BEZ snap - pozice je už nasnappovaná z posledního drag frame
        // Pouze clamp + collision check (snap by mohl vytvořit jiný výsledek kvůli float)
        const result = store._collision.checkPlacement(
          cab,
          [x, y, z],
          rotation,
          instanceId,
          { snap: false }
        )

        if (!result.valid) {
          // Kolize - vrať na původní pozici
          const originalPos = store.dragOriginalPosition
          const originalRot = store.dragOriginalRotation

          if (originalPos) {
            if (groupRef.current) {
              groupRef.current.position.set(originalPos[0], originalPos[1], originalPos[2])
              groupRef.current.rotation.y = originalRot
            }
            updateCabinetPosition(instanceId, originalPos)
            updateCabinetRotation(instanceId, originalRot)
          }

          // VŽDY ukonči drag a vrať se při kolizi (i bez originalPos)
          stopDragging()
          gl.domElement.style.cursor = 'default'
          if (controls) {
            setTimeout(() => { controls.enabled = true }, 50)
          }
          return
        }

        // Aplikuj finální pozici
        updateCabinetPosition(instanceId, result.position)
        updateCabinetRotation(instanceId, result.rotation)
      }

      stopDragging()
      gl.domElement.style.cursor = 'default'
      if (controls) {
        setTimeout(() => { controls.enabled = true }, 50)
      }
    }

    window.addEventListener('pointermove', handleGlobalPointerMove)
    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('pointercancel', handleGlobalPointerUp)

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('pointercancel', handleGlobalPointerUp)
    }
  }, [isBeingDragged, stopDragging, gl, controls, instanceId, updateCabinetPosition, updateCabinetRotation, camera, raycaster])

  // Pozice madla - na strane dvirek (z = depth)
  const handlePosition = useMemo(() => {
    if (cabType === 'wall') return [width/2, height * 0.15, depth - t/2]
    if (cabType === 'tall') return null
    return [width/2, height * 0.85, depth - t/2]
  }, [cabType, width, height, depth, t])

  // Cekej na inicializaci TextureManager
  if (!geometries || !corpusMaterial) {
    return null
  }

  return (
    <group
      ref={groupRef}
      position={cabinet.position}
      rotation={[0, cabinet.rotation || 0, 0]}
      userData={{ cabinetId: instanceId }}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* CORPUS - staticka geometrie, dynamicke materialy */}
      {geometries.corpus.map((geo, i) => (
        <mesh key={`corpus-${i}`} geometry={geo} material={corpusMaterial} castShadow receiveShadow />
      ))}

      {/* DVIRKA */}
      {Array.isArray(geometries.door) ? (
        geometries.door.map((geo, i) => (
          <mesh key={`door-${i}`} geometry={geo} material={doorMaterial} castShadow />
        ))
      ) : geometries.door && (
        <mesh geometry={geometries.door} material={doorMaterial} castShadow />
      )}

      {/* SOKL */}
      {geometries.plinth && plinthMaterial && (
        <mesh geometry={geometries.plinth} material={plinthMaterial} />
      )}

      {/* DREZ - pouze pro worktop s drezovou skrinkou pod sebou */}
      {cabType === 'worktop' && cabinet.sink && (
        <Sink3D
          sinkInfo={cabinet.sink}
          worktopDepth={depth}
          worktopHeight={height}
        />
      )}

      {/* MADLA - pouze kdyz neni vybrano/tazeno */}
      {!isBeingDragged && !isSelected && (
        <>
          {handlePosition && <Handle position={handlePosition} width={width} />}
          {cabType === 'tall' && (
            <>
              <Handle position={[width/2, height * 0.75, depth - t/2]} width={width} />
              <Handle position={[width/2, height * 0.25, depth - t/2]} width={width} />
            </>
          )}
        </>
      )}

      {/* SELECTION OVERLAY - samostatna vrstva, nemeni geometrii */}
      <SelectionOverlay
        width={width}
        height={height}
        depth={depth}
        isSelected={isSelected}
        isDragging={isBeingDragged}
        isHovered={hovered}
        isConstraintViolated={isConstraintViolated}
      />

      {/* SNAP CONNECTORS - pouze pri tazeni */}
      {isBeingDragged && (
        <SnapConnectors cabinet={cabinet} width={width} height={height} depth={depth} />
      )}
    </group>
  )
}
