import React, { useCallback } from 'react'
import { useStore } from '../store'

// Komponenta pro vykreslení místnosti
export function Room() {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const roomHeight = useStore(s => s.roomHeight)
  const selectedWall = useStore(s => s.selectedWall)
  const setSelectedWall = useStore(s => s.setSelectedWall)

  // Převod na metry
  const w = roomWidth / 1000
  const d = roomDepth / 1000
  const h = roomHeight / 1000

  // Handler pro kliknutí na stěnu
  const handleWallClick = useCallback((wall) => (e) => {
    e.stopPropagation()
    setSelectedWall(wall)
  }, [setSelectedWall])

  // Barvy pro stěny (normální / vybraná)
  const getWallColor = (wall) => {
    if (selectedWall === wall) {
      return '#4CAF50' // Zelená pro vybranou stěnu
    }
    return wall === 'back' ? '#f5f5f0' : '#f0f0eb'
  }

  const getWallOpacity = (wall) => {
    if (wall === 'right') return selectedWall === 'right' ? 0.6 : 0.3
    return 1
  }

  return (
    <group>
      {/* Podlaha - RAYCAST DISABLED pro lepsi interakci se skriankami */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color="#b5a388"
          roughness={0.8}
          metalness={0}
        />
      </mesh>

      {/* Mřížka na podlaze */}
      <gridHelper args={[Math.max(w, d), 20, '#999', '#ccc']} position={[0, 0.001, 0]} />

      {/* Zadní stěna - KLIKNUTELNÁ */}
      <mesh
        position={[0, h / 2, -d / 2]}
        receiveShadow
        onClick={handleWallClick('back')}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'default' }}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={getWallColor('back')}
          roughness={0.9}
          metalness={0}
          side={2}
          emissive={selectedWall === 'back' ? '#2E7D32' : '#000000'}
          emissiveIntensity={selectedWall === 'back' ? 0.2 : 0}
        />
      </mesh>

      {/* Levá stěna - KLIKNUTELNÁ */}
      <mesh
        position={[-w / 2, h / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
        onClick={handleWallClick('left')}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'default' }}
      >
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial
          color={getWallColor('left')}
          roughness={0.9}
          metalness={0}
          side={2}
          emissive={selectedWall === 'left' ? '#2E7D32' : '#000000'}
          emissiveIntensity={selectedWall === 'left' ? 0.2 : 0}
        />
      </mesh>

      {/* Pravá stěna (průhledná pro lepší viditelnost) - KLIKNUTELNÁ */}
      <mesh
        position={[w / 2, h / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        onClick={handleWallClick('right')}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'default' }}
      >
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial
          color={getWallColor('right')}
          roughness={0.9}
          metalness={0}
          transparent
          opacity={getWallOpacity('right')}
          side={2}
          emissive={selectedWall === 'right' ? '#2E7D32' : '#000000'}
          emissiveIntensity={selectedWall === 'right' ? 0.3 : 0}
        />
      </mesh>

      {/* Obrys místnosti - posunutý tak, aby spodek byl na podlaze */}
      <lineSegments position={[0, h / 2, 0]} raycast={() => null}>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color="#999" />
      </lineSegments>
    </group>
  )
}

// Potřebujeme THREE pro EdgesGeometry
import * as THREE from 'three'
