import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'

/**
 * Ghost preview skrinky pri tazeni z katalogu
 * Zobrazuje pruhlednou siluetu na miste kam se skrinka umisti
 */
export function DragPreview() {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const draggedCabinet = useStore(s => s.draggedCabinet)
  const dragPreviewPosition = useStore(s => s.dragPreviewPosition)
  const dragPreviewRotation = useStore(s => s.dragPreviewRotation)

  // Material pro ghost preview
  const ghostMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#4CAF50',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    })
  }, [])

  const edgeMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: '#2E7D32',
      linewidth: 2
    })
  }, [])

  // Pokud neni nic tazeno, nic nezobrazuj
  if (!draggedCabinet || !dragPreviewPosition) {
    return null
  }

  const width = (draggedCabinet.width || 600) / 1000
  const height = (draggedCabinet.height || 720) / 1000
  const depth = (draggedCabinet.depth || 560) / 1000

  // Uprav Y pozici podle typu skrinky
  const yOffset = draggedCabinet.type === 'wall' ? 1.4 : draggedCabinet.type === 'worktop' ? 0.72 : 0

  return (
    <group
      position={[
        dragPreviewPosition[0],
        yOffset,
        dragPreviewPosition[2]
      ]}
      rotation={[0, dragPreviewRotation, 0]}
    >
      {/* Hlavni ghost box - RAYCAST DISABLED */}
      <mesh position={[width/2, height/2, depth/2]} raycast={() => null}>
        <boxGeometry args={[width, height, depth]} />
        <primitive object={ghostMaterial} attach="material" />
      </mesh>

      {/* Obrysove hrany - RAYCAST DISABLED */}
      <lineSegments position={[width/2, height/2, depth/2]} raycast={() => null}>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <primitive object={edgeMaterial} attach="material" />
      </lineSegments>

      {/* Stin na podlaze - RAYCAST DISABLED */}
      <mesh position={[width/2, 0.003, depth/2]} rotation={[-Math.PI/2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[width + 0.04, depth + 0.04]} />
        <meshBasicMaterial color="#4CAF50" transparent opacity={0.3} />
      </mesh>

      {/* Indikator typu */}
      <TypeIndicator type={draggedCabinet.type} width={width} height={height} depth={depth} />
    </group>
  )
}

/**
 * Maly indikator typu skrinky
 */
function TypeIndicator({ type, width, height, depth }) {
  const colors = {
    base: '#28a745',
    wall: '#17a2b8',
    tall: '#fd7e14'
  }

  const labels = {
    base: 'S',  // Spodni
    wall: 'H',  // Horni
    tall: 'V'   // Vysoka
  }

  return (
    <group position={[width/2, height + 0.1, depth/2]}>
      {/* Pozadi - RAYCAST DISABLED */}
      <mesh raycast={() => null}>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial color={colors[type] || '#666'} />
      </mesh>
    </group>
  )
}
