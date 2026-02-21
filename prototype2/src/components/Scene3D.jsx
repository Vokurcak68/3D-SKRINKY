import React, { Suspense, useRef, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Html, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { Cabinet3D } from './Cabinet3D'
import { Room } from './Room'
import { DragPreview } from './DragPreview'

// Komponenta pro sledovani mysi a drop handling uvnitr Canvas
function DropZoneHandler() {
  const { gl, camera, raycaster } = useThree()
  // DULEZITE: Pouzij jednotlive selektory misto useStore() pro minimalni re-rendery
  const draggedCabinet = useStore(s => s.draggedCabinet)
  const updateDragPreview = useStore(s => s.updateDragPreview)
  const addCabinetAtPosition = useStore(s => s.addCabinetAtPosition)
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const selectedWall = useStore(s => s.selectedWall)

  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // Vypocet 3D pozice z mouse coordinates
  const getFloorPosition = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )

    raycaster.setFromCamera(mouse, camera)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(floorPlane.current, intersection)

    return intersection
  }, [gl, camera, raycaster])

  // Ziskej setDraggedCabinet pro reset
  const setDraggedCabinet = useStore(s => s.setDraggedCabinet)

  /**
   * Vypočítá offset od stěny pro danou skříňku
   * POUZE spodní skříňky hloubky 500mm mají offset 65mm (pro pracovní desku)
   */
  const getWallOffset = useCallback((cabType, cabDepth) => {
    // Pouze base skříňky s hloubkou přesně 500mm
    if (cabType === 'base' && cabDepth === 500) {
      return 0.065 // 65mm
    }
    return 0
  }, [])

  /**
   * Vypočítá pozici skříňky u vybrané stěny
   * Respektuje rotaci a správně počítá rozměry
   */
  const getWallPosition = useCallback((mousePos, cabWidth, cabDepth, wall, roomW, roomD, cabType) => {
    const w = cabWidth / 1000  // šířka v metrech
    const d = cabDepth / 1000  // hloubka v metrech

    // Offset od stěny pro base skříňky s hloubkou 500mm
    const wallOffset = getWallOffset(cabType, cabDepth)

    // Po rotaci se rozměry prohodí (efektivní rozměry ve world space)
    // effectiveW = šířka podél zdi, effectiveD = hloubka od zdi
    const effectiveW = (wall === 'left' || wall === 'right') ? d : w
    const effectiveD = (wall === 'left' || wall === 'right') ? w : d

    let x, z, rotation

    switch (wall) {
      case 'back':
        // Zadní stěna - rotace 0°
        x = Math.max(-roomW/2, Math.min(roomW/2 - effectiveW, mousePos.x))
        z = -roomD/2 + wallOffset  // U zadní stěny + offset
        rotation = 0
        break

      case 'left':
        // Levá stěna - rotace +90° (záda k levé zdi)
        x = -roomW/2 + wallOffset  // U levé stěny + offset
        z = Math.max(-roomD/2 + effectiveD, Math.min(roomD/2, mousePos.z))
        rotation = Math.PI / 2
        break

      case 'right':
        // Pravá stěna - rotace -90° (záda k pravé zdi, dvířka do místnosti)
        // Skříňka se rozšiřuje směrem -X a +Z
        // Z min = -roomD/2 (u zadní stěny), Z max = roomD/2 - effectiveD (aby se vešla)
        x = roomW/2 - wallOffset  // U pravé stěny - offset
        z = Math.max(-roomD/2, Math.min(roomD/2 - effectiveD, mousePos.z))
        rotation = -Math.PI / 2
        break

      default:
        // Fallback - zadní stěna
        x = Math.max(-roomW/2, Math.min(roomW/2 - effectiveW, mousePos.x))
        z = -roomD/2 + wallOffset
        rotation = 0
    }

    return { x, z, rotation, effectiveW, effectiveD }
  }, [getWallOffset])

  // Listener pro dragover - aktualizuje preview pozici
  React.useEffect(() => {
    if (!draggedCabinet) return

    const handleDragOver = (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'

      const pos = getFloorPosition(e.clientX, e.clientY)
      if (pos) {
        const cabWidth = draggedCabinet.width || 600
        const cabDepth = draggedCabinet.depth || 560
        const roomW = roomWidth / 1000
        const roomD = roomDepth / 1000

        // Získej pozici podle vybrané stěny (předej i typ pro výpočet offsetu)
        const wallPos = getWallPosition(pos, cabWidth, cabDepth, selectedWall, roomW, roomD, draggedCabinet.type)

        // Preview Y pozice
        const previewY = draggedCabinet.type === 'wall' ? 1.4 : draggedCabinet.type === 'worktop' ? 0.72 : 0

        updateDragPreview([wallPos.x, previewY, wallPos.z], wallPos.rotation)
      }
    }

    const handleDrop = (e) => {
      e.preventDefault()

      const pos = getFloorPosition(e.clientX, e.clientY)
      if (pos && draggedCabinet) {
        const cabWidth = draggedCabinet.width || 600
        const cabDepth = draggedCabinet.depth || 560
        const roomW = roomWidth / 1000
        const roomD = roomDepth / 1000

        // Získej pozici podle vybrané stěny (předej i typ pro výpočet offsetu)
        const wallPos = getWallPosition(pos, cabWidth, cabDepth, selectedWall, roomW, roomD, draggedCabinet.type)

        // Uprav Y pro horni skrinky a pracovni desky
        const finalY = draggedCabinet.type === 'wall' ? 1.4 : draggedCabinet.type === 'worktop' ? 0.72 : 0
        const finalPos = [wallPos.x, finalY, wallPos.z]

        // Přidej skříňku s collision detection (store to ověří)
        addCabinetAtPosition(draggedCabinet, finalPos, wallPos.rotation)
      } else {
        // Vynucene resetovani stavu pokud drop selze
        updateDragPreview(null, 0)
      }
    }

    const handleDragLeave = (e) => {
      // Zrus preview pokud opustime canvas
      if (e.relatedTarget === null || !gl.domElement.contains(e.relatedTarget)) {
        updateDragPreview(null, 0)
      }
    }

    // Fallback - pokud drag skonci bez dropu, resetuj stav
    const handleDragEnd = () => {
      setTimeout(() => {
        const state = useStore.getState()
        if (state.draggedCabinet) {
          setDraggedCabinet(null)
        }
      }, 100)
    }

    gl.domElement.addEventListener('dragover', handleDragOver)
    gl.domElement.addEventListener('drop', handleDrop)
    gl.domElement.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragend', handleDragEnd)

    return () => {
      gl.domElement.removeEventListener('dragover', handleDragOver)
      gl.domElement.removeEventListener('drop', handleDrop)
      gl.domElement.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragend', handleDragEnd)
    }
  }, [draggedCabinet, getFloorPosition, updateDragPreview, addCabinetAtPosition, gl, setDraggedCabinet, selectedWall, roomWidth, roomDepth, getWallPosition])

  return null
}

// Hlavni 3D scena
export function Scene3D() {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const placedCabinets = useStore(s => s.placedCabinets)
  const selectedCabinet = useStore(s => s.selectedCabinet)
  const isDragging = useStore(s => s.isDragging)
  const draggedCabinet = useStore(s => s.draggedCabinet)

  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true }}>
      <PerspectiveCamera makeDefault position={[3, 2.5, 4]} fov={50} />

      {/* Osvetleni */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />

      {/* Prostredi pro realisticke odrazy */}
      <Environment preset="apartment" />

      {/* Drop zone handler */}
      <DropZoneHandler />

      <Suspense fallback={<LoadingIndicator />}>
        {/* Mistnost */}
        <Room />

        {/* Skrinky */}
        {placedCabinets.map((cabinet) => (
          <Cabinet3D
            key={cabinet.instanceId}
            cabinet={cabinet}
            isSelected={selectedCabinet?.instanceId === cabinet.instanceId}
          />
        ))}

        {/* Ghost preview pri tazeni z katalogu */}
        <DragPreview />

        {/* Stiny na podlaze */}
        <ContactShadows
          position={[0, 0, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />
      </Suspense>

      {/* Ovladani kamery - zakazano behem tazeni */}
      <OrbitControls
        makeDefault
        enabled={!isDragging && !draggedCabinet}
        enableDamping={false}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={1}
        maxDistance={15}
        target={[0, 0.5, 0]}
      />
    </Canvas>
  )
}

// Loading indikator
function LoadingIndicator() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '20px 40px',
        borderRadius: '8px',
        fontSize: '16px'
      }}>
        Nacitam 3D scenu...
      </div>
    </Html>
  )
}
