import React, { useEffect, useState } from 'react'
import { Scene3D } from './components/Scene3D'
import { CatalogPanel } from './components/CatalogPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { QuickToolbar } from './components/QuickToolbar'
import { WallComposerDrawer } from './components/WallComposerDrawer'
import { TopDownEditor } from './components/TopDownEditor'
import { AIAssistantModal } from './components/AIAssistantModal'
import { useStore } from './store'
import { textureManager } from './utils/TextureManager'

// Import dat katalogu
import catalogData from './data/catalog.json'

export default function App() {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const setCatalog = useStore(s => s.setCatalog)
  const catalog = useStore(s => s.catalog)
  const selectedCabinet = useStore(s => s.selectedCabinet)
  const rotateCabinet = useStore(s => s.rotateCabinet)
  const removeCabinet = useStore(s => s.removeCabinet)
  const updateCabinetPosition = useStore(s => s.updateCabinetPosition)
  const [loading, setLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('Inicializuji...')
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [viewMode, setViewMode] = useState('3d') // '3d' | 'split'

  // Inicializace pri startu - katalog + textury
  useEffect(() => {
    async function initialize() {
      // 1. Inicializuj TextureManager (predgeneruje textury)
      setLoadingText('Pripravuji textury...')
      await textureManager.initialize()

      // 2. Nacti katalog - pouze Oresi skrinky
      setLoadingText('Nacitam katalog Oresi...')
      const oresiCatalog = {
        brands: catalogData.brands.filter(b => b.name === 'Oresi'),
        cabinets: catalogData.cabinets.filter(c => c.brand === 'Oresi')
      }
      setCatalog(oresiCatalog)

      // Hotovo
      setLoading(false)
    }

    initialize()
  }, [setCatalog])

  // Klávesové zkratky
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignoruj pokud je focus v inputu/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      // R - rotace vybrané skříňky
      if ((e.key === 'r' || e.key === 'R') && selectedCabinet) {
        e.preventDefault()
        const direction = e.shiftKey ? -1 : 1 // Shift+R = doprava, R = doleva
        rotateCabinet(selectedCabinet.instanceId, direction)
      }

      // Delete / Backspace - smazání vybrané skříňky
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCabinet) {
        e.preventDefault()
        removeCabinet(selectedCabinet.instanceId)
      }

      // Shift + ArrowLeft / ArrowRight - posun k nejbližší skříňce nebo ke zdi
      if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedCabinet) {
        e.preventDefault()
        const direction = e.key === 'ArrowLeft' ? -1 : 1
        const state = useStore.getState()
        const { placedCabinets, roomWidth, roomDepth } = state

        const cab = selectedCabinet
        const rot = cab.rotation || 0
        const width = (cab.width || 600) / 1000
        const depth = (cab.depth || 560) / 1000

        const isWall = cab.type === 'wall'
        const sameLevel = (c) => (isWall ? c.type === 'wall' : c.type !== 'wall')

        const roomW = roomWidth / 1000
        const roomD = roomDepth / 1000

        const isRot0 = Math.abs(rot) < 0.1
        const isRotPos = Math.abs(rot - Math.PI / 2) < 0.1
        const isRotNeg = Math.abs(rot + Math.PI / 2) < 0.1

        let axis = 'x'
        let start = cab.position[0]
        let end = cab.position[0] + width
        let minBound = -roomW / 2
        let maxBound = roomW / 2
        let alignEps = 0.05

        if (isRotPos) {
          axis = 'z'
          start = cab.position[2] - width
          end = cab.position[2]
          minBound = -roomD / 2
          maxBound = roomD / 2
          alignEps = 0.05
        } else if (isRotNeg) {
          axis = 'z'
          start = cab.position[2]
          end = cab.position[2] + width
          minBound = -roomD / 2
          maxBound = roomD / 2
          alignEps = 0.05
        }

        const aligned = (c) => {
          if (axis === 'x') {
            return Math.abs(c.position[2] - cab.position[2]) < alignEps
          }
          return Math.abs(c.position[0] - cab.position[0]) < alignEps
        }

        const candidates = placedCabinets.filter(c =>
          c.instanceId !== cab.instanceId &&
          sameLevel(c) &&
          aligned(c) &&
          ((isRot0 && Math.abs((c.rotation || 0)) < 0.1) ||
           (isRotPos && Math.abs((c.rotation || 0) - Math.PI / 2) < 0.1) ||
           (isRotNeg && Math.abs((c.rotation || 0) + Math.PI / 2) < 0.1))
        )

        const getSpan = (c) => {
          const r = c.rotation || 0
          const w = (c.width || 600) / 1000
          if (axis === 'x') {
            return { s: c.position[0], e: c.position[0] + w }
          }
          if (Math.abs(r - Math.PI / 2) < 0.1) {
            return { s: c.position[2] - w, e: c.position[2] }
          }
          return { s: c.position[2], e: c.position[2] + w }
        }

        let neighbor = null
        let bestDist = Infinity

        for (const c of candidates) {
          const span = getSpan(c)
          if (direction < 0) {
            if (span.e <= start) {
              const dist = start - span.e
              if (dist < bestDist) {
                bestDist = dist
                neighbor = span
              }
            }
          } else {
            if (span.s >= end) {
              const dist = span.s - end
              if (dist < bestDist) {
                bestDist = dist
                neighbor = span
              }
            }
          }
        }

        let newPos = [...cab.position]
        if (neighbor) {
          if (axis === 'x') {
            newPos[0] = direction < 0 ? neighbor.e : neighbor.s - width
          } else if (isRotPos) {
            newPos[2] = direction < 0 ? neighbor.e + width : neighbor.s
          } else if (isRotNeg) {
            newPos[2] = direction < 0 ? neighbor.e : neighbor.s - width
          }
        } else {
          if (axis === 'x') {
            newPos[0] = direction < 0 ? minBound : maxBound - width
          } else if (isRotPos) {
            newPos[2] = direction < 0 ? minBound + width : maxBound
          } else if (isRotNeg) {
            newPos[2] = direction < 0 ? minBound : maxBound - width
          }
        }

        // Collision check - prevent moving into occupied space
        // canPlace() includes Y-overlap filtering (base won't collide with wall cabinets above)
        const moveCheck = state._collision.canPlace(cab, newPos, rot, cab.instanceId)
        if (!moveCheck.valid) return

        updateCabinetPosition(cab.instanceId, newPos)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCabinet, rotateCabinet, removeCabinet])

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>{loadingText}</p>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>
          <span style={styles.logoIcon}>🏠</span>
          Oresi Kitchen Designer
        </h1>
        <div style={styles.headerInfo}>
          <button
            onClick={() => setShowAIAssistant(true)}
            style={styles.aiButton}
            title="Otevřít AI asistenta pro návrh kuchyně"
          >
            🤖 AI Designer
          </button>
          <span style={styles.badge}>{catalog.cabinets.length} skříněk</span>
          <span style={styles.badge}>PROTOTYPE v0.2 (optimized)</span>
        </div>
      </header>

      {/* Hlavní obsah */}
      <div style={styles.main}>
        {/* Levý panel - Katalog */}
        <CatalogPanel />

        {/* 3D scéna */}
        <div style={styles.viewport}>
          <div style={styles.viewToggle}>
            <button
              onClick={() => setViewMode('3d')}
              style={{ ...styles.toggleButton, ...(viewMode === '3d' ? styles.toggleActive : {}) }}
            >
              3D
            </button>
            <button
              onClick={() => setViewMode('split')}
              style={{ ...styles.toggleButton, ...(viewMode === 'split' ? styles.toggleActive : {}) }}
            >
              2D + 3D
            </button>
          </div>

          {viewMode === '3d' ? (
            <>
              <Scene3D />
              <QuickToolbar />
              <WallComposerDrawer />
            </>
          ) : (
            <div style={styles.split}>
              <div style={styles.splitLeft}>
                <TopDownEditor />
              </div>
              <div style={styles.splitRight}>
                <Scene3D />
              </div>
            </div>
          )}

          {/* Instrukce */}
          <div style={styles.instructions}>
            <strong>Ovládání:</strong>
            <span>Levé tlačítko: otáčení kamery</span>
            <span>Pravé/Střední: posun</span>
            <span>Kolečko: zoom</span>
            <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '16px' }}>
              R: rotace skříňky | Del: smazat
            </span>
          </div>
        </div>

        {/* Pravý panel - Vlastnosti */}
        <PropertiesPanel />
      </div>

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
      />
    </div>
  )
}

const styles = {
  app: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#e9ecef'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
    color: 'white',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
  },
  logo: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoIcon: {
    fontSize: '24px'
  },
  headerInfo: {
    display: 'flex',
    gap: '10px'
  },
  badge: {
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '20px',
    fontSize: '12px'
  },
  aiButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'white',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },
  viewport: {
    flex: 1,
    position: 'relative',
    background: '#ddd'
  },
  split: {
    position: 'absolute',
    inset: 0,
    display: 'flex'
  },
  splitLeft: {
    flex: 1
  },
  splitRight: {
    width: '38%',
    minWidth: '320px',
    borderLeft: '1px solid #dee2e6'
  },
  viewToggle: {
    position: 'absolute',
    top: '12px',
    right: '16px',
    zIndex: 300,
    display: 'flex',
    gap: '6px',
    background: 'rgba(255,255,255,0.9)',
    padding: '6px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  toggleButton: {
    border: '1px solid #ced4da',
    background: 'white',
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  toggleActive: {
    background: '#212529',
    color: 'white',
    borderColor: '#212529'
  },
  instructions: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    display: 'flex',
    gap: '16px',
    padding: '10px 16px',
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    borderRadius: '8px',
    fontSize: '12px',
    pointerEvents: 'none'
  },
  loading: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8f9fa',
    gap: '20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e9ecef',
    borderTop: '4px solid #228be6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
}

// CSS animace pro spinner
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`
document.head.appendChild(styleSheet)
