import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Html,
  PerspectiveCamera,
  Lightformer,
  AccumulativeShadows,
  RandomizedLight
} from '@react-three/drei'
import * as THREE from 'three'

/**
 * Realisticky canvas pro nahledove okno
 * Pouziva lepsí materialy a osvetleni nez pracovni scena
 */
export function RealisticCanvas({ cabinets, selectedInstanceId, room, onCabinetClick }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2
      }}
    >
      <PerspectiveCamera makeDefault position={[4, 3, 5]} fov={45} />

      {/* Realisticke osvetleni */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[8, 12, 8]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-5, 8, -5]} intensity={0.5} />

      {/* HDRI Environment pro realisticke odrazy */}
      <Environment preset="apartment" background={false}>
        <Lightformer
          position={[0, 5, -5]}
          scale={[10, 1, 1]}
          intensity={2}
        />
      </Environment>

      <Suspense fallback={<LoadingIndicator />}>
        {/* Mistnost */}
        <RealisticRoom room={room} />

        {/* Skrinky */}
        {cabinets.map((cabinet) => (
          <RealisticCabinet
            key={cabinet.instanceId}
            cabinet={cabinet}
            isSelected={selectedInstanceId === cabinet.instanceId}
            onClick={() => onCabinetClick(cabinet.instanceId)}
          />
        ))}

        {/* Akumulativni stiny - mekci a realistictejsi */}
        <AccumulativeShadows
          position={[0, 0.001, 0]}
          scale={12}
          color="#316d39"
          opacity={0.7}
          frames={100}
          temporal
        >
          <RandomizedLight
            amount={8}
            radius={8}
            ambient={0.5}
            position={[5, 8, -5]}
            bias={0.001}
          />
        </AccumulativeShadows>
      </Suspense>

      {/* Ovladani kamery */}
      <OrbitControls
        makeDefault
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={1.5}
        maxDistance={12}
        target={[0, 0.6, 0]}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  )
}

// Realisticka mistnost s lepimi materialy
function RealisticRoom({ room }) {
  const w = room.width / 1000
  const d = room.depth / 1000
  const h = room.height / 1000

  // Materialy
  const floorMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8B7355',
    roughness: 0.6,
    metalness: 0.0
  }), [])

  const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#F5F5F0',
    roughness: 0.95,
    metalness: 0.0
  }), [])

  return (
    <group>
      {/* Podlaha */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <primitive object={floorMaterial} attach="material" />
      </mesh>

      {/* Zadni stena */}
      <mesh position={[0, h / 2, -d / 2]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>

      {/* Leva stena */}
      <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>

      {/* Prava stena - lehce pruhledna */}
      <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial
          color="#F5F5F0"
          roughness={0.95}
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  )
}

// Realisticka skrinka s PBR materialy
function RealisticCabinet({ cabinet, isSelected, onClick }) {
  const width = (cabinet.width || 600) / 1000
  const height = (cabinet.height || 720) / 1000
  const depth = (cabinet.depth || 560) / 1000
  const t = 0.018
  const cabType = cabinet.type || 'base'

  // PBR materialy
  const corpusMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#D4B896',
    roughness: 0.7,
    metalness: 0.0
  }), [])

  const frontMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FAFAFA',
    roughness: 0.1,
    metalness: 0.02,
    envMapIntensity: 0.8
  }), [])

  const handleMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#C0C0C0',
    roughness: 0.15,
    metalness: 0.9,
    envMapIntensity: 1.2
  }), [])

  const plinthMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2A2A2A',
    roughness: 0.8,
    metalness: 0.1
  }), [])

  // Uprav Y pozici pro horni skrinky a pracovni desky
  const baseY = cabType === 'wall' ? 1.4 : cabType === 'worktop' ? 0.72 : 0

  return (
    <group
      position={[cabinet.position[0], baseY, cabinet.position[2]]}
      rotation={[0, cabinet.rotation || 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Korpus - boky */}
      <mesh position={[t/2, height/2, depth/2]} castShadow receiveShadow>
        <boxGeometry args={[t, height, depth]} />
        <primitive object={corpusMaterial} attach="material" />
      </mesh>
      <mesh position={[width - t/2, height/2, depth/2]} castShadow receiveShadow>
        <boxGeometry args={[t, height, depth]} />
        <primitive object={corpusMaterial} attach="material" />
      </mesh>

      {/* Spodek */}
      <mesh position={[width/2, t/2, depth/2]} receiveShadow>
        <boxGeometry args={[width - 2*t, t, depth]} />
        <primitive object={corpusMaterial} attach="material" />
      </mesh>

      {/* Vrch (pro wall a tall) */}
      {(cabType === 'wall' || cabType === 'tall') && (
        <mesh position={[width/2, height - t/2, depth/2]} receiveShadow>
          <boxGeometry args={[width - 2*t, t, depth]} />
          <primitive object={corpusMaterial} attach="material" />
        </mesh>
      )}

      {/* Zada */}
      <mesh position={[width/2, height/2, depth - t/4]}>
        <boxGeometry args={[width - 2*t, height - (cabType === 'wall' ? 2*t : t), t/2]} />
        <primitive object={corpusMaterial} attach="material" />
      </mesh>

      {/* Dvirka */}
      {cabType === 'tall' ? (
        <>
          <mesh position={[width/2, height * 0.75, t/2]} castShadow>
            <boxGeometry args={[width - 0.004, height/2 - 0.01, t]} />
            <primitive object={frontMaterial} attach="material" />
          </mesh>
          <mesh position={[width/2, height * 0.25, t/2]} castShadow>
            <boxGeometry args={[width - 0.004, height/2 - 0.01, t]} />
            <primitive object={frontMaterial} attach="material" />
          </mesh>
        </>
      ) : (
        <mesh position={[width/2, height/2, t/2]} castShadow>
          <boxGeometry args={[width - 0.004, height - 0.004, t]} />
          <primitive object={frontMaterial} attach="material" />
        </mesh>
      )}

      {/* Madlo */}
      <Handle
        position={[width/2, cabType === 'wall' ? height * 0.15 : height * 0.85, t/2 + 0.012]}
        material={handleMaterial}
        width={width}
      />
      {cabType === 'tall' && (
        <>
          <Handle position={[width/2, height * 0.75, t/2 + 0.012]} material={handleMaterial} width={width} />
          <Handle position={[width/2, height * 0.25, t/2 + 0.012]} material={handleMaterial} width={width} />
        </>
      )}

      {/* Sokl */}
      {(cabType === 'base' || cabType === 'tall') && (
        <mesh position={[width/2, -0.05, depth/2 - 0.02]}>
          <boxGeometry args={[width - 0.02, 0.1, depth - 0.05]} />
          <primitive object={plinthMaterial} attach="material" />
        </mesh>
      )}

      {/* Selection highlight */}
      {isSelected && (
        <mesh position={[width/2, height/2, depth/2]}>
          <boxGeometry args={[width + 0.01, height + 0.01, depth + 0.01]} />
          <meshBasicMaterial
            color="#1a5fb4"
            transparent
            opacity={0.15}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  )
}

// Madlo
function Handle({ position, material, width }) {
  const handleLength = Math.min(width * 0.5, 0.12)

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[handleLength, 0.01, 0.008]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}

// Loading indicator
function LoadingIndicator() {
  return (
    <Html center>
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '20px 40px',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        Nacitam realistickou scenu...
      </div>
    </Html>
  )
}
