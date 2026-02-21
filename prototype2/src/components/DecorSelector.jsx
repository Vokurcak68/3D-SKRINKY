import { useState, useEffect } from 'react'
import { useStore } from '../store'

/**
 * DecorSelector - Komponenta pro vyber dekoru
 * Podporuje globalni vychozi nastaveni i per-cabinet override
 */
export function DecorSelector({ mode = 'global', cabinet = null }) {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const decors = useStore(s => s.decors)
  const globalDecors = useStore(s => s.globalDecors)
  const setGlobalDecor = useStore(s => s.setGlobalDecor)
  const setCabinetDecor = useStore(s => s.setCabinetDecor)
  const clearCabinetDecor = useStore(s => s.clearCabinetDecor)
  const findDecorById = useStore(s => s.findDecorById)

  const [expandedCollection, setExpandedCollection] = useState('dolti')

  // Pro worktop zobraz jen countertopDecor, pro ostatni vsechny
  const isWorktop = cabinet?.type === 'worktop'
  const allDecorTypes = [
    { key: 'frontDecor', label: 'Dvirka', icon: '🚪' },
    { key: 'bodyDecor', label: 'Korpus', icon: '📦' },
    { key: 'countertopDecor', label: 'Deska', icon: '⬛' }
  ]
  const decorTypes = isWorktop
    ? [{ key: 'countertopDecor', label: 'Deska', icon: '⬛' }]
    : allDecorTypes

  // Vychozi aktivni typ - pro worktop countertopDecor, jinak frontDecor
  const [activeType, setActiveType] = useState(isWorktop ? 'countertopDecor' : 'frontDecor')

  // Pri zmene typu skrinky (napr. z base na worktop) nastav spravny aktivni typ
  useEffect(() => {
    if (isWorktop && activeType !== 'countertopDecor') {
      setActiveType('countertopDecor')
    } else if (!isWorktop && activeType === 'countertopDecor' && mode === 'cabinet') {
      // Pokud prejdeme z worktop na jiny typ, vrat se na frontDecor
      setActiveType('frontDecor')
    }
  }, [isWorktop, activeType, mode])

  // Ziskej aktualni dekor pro dany typ
  const getCurrentDecor = (type) => {
    if (mode === 'cabinet' && cabinet?.decors?.[type]) {
      return cabinet.decors[type]
    }
    return globalDecors[type]
  }

  // Handler pro vyber dekoru
  const handleDecorSelect = (type, decorId) => {
    if (mode === 'cabinet' && cabinet) {
      setCabinetDecor(cabinet.instanceId, type, decorId)
    } else {
      setGlobalDecor(type, decorId)
    }
  }

  // Handler pro reset na globalni
  const handleResetToGlobal = (type) => {
    if (mode === 'cabinet' && cabinet) {
      clearCabinetDecor(cabinet.instanceId, type)
    }
  }

  const currentDecorId = getCurrentDecor(activeType)
  const currentDecor = findDecorById(currentDecorId)
  const hasOverride = mode === 'cabinet' && cabinet?.decors?.[activeType]

  // Bezpecnostni kontrola - pokud data nejsou nactena
  const collections = decors?.collections || []

  if (collections.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          {mode === 'global' ? 'Globalni dekory' : 'Dekory skrinky'}
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#868e96' }}>
          Nacitam dekory...
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {mode === 'global' ? 'Globalni dekory' : 'Dekory skrinky'}
      </div>

      {/* Prepinani typu dekoru */}
      <div style={styles.typeSelector}>
        {decorTypes.map(({ key, label, icon }) => {
          const isActive = activeType === key
          const hasLocalOverride = mode === 'cabinet' && cabinet?.decors?.[key]
          return (
            <button
              key={key}
              onClick={() => setActiveType(key)}
              style={{
                ...styles.typeButton,
                ...(isActive ? styles.typeButtonActive : {}),
                ...(hasLocalOverride ? styles.typeButtonOverride : {})
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
              {hasLocalOverride && <span style={styles.overrideDot}>●</span>}
            </button>
          )
        })}
      </div>

      {/* Aktualni dekor */}
      <div style={styles.currentDecor}>
        <div style={styles.currentDecorPreview}>
          {currentDecor?.imageUrl ? (
            <img
              src={currentDecor.imageUrl}
              alt={currentDecor.name}
              style={styles.currentDecorImage}
            />
          ) : (
            <div style={styles.noPreview}>?</div>
          )}
        </div>
        <div style={styles.currentDecorInfo}>
          <div style={styles.currentDecorName}>
            {currentDecor?.name || 'Nevybrano'}
          </div>
          <div style={styles.currentDecorCollection}>
            {currentDecor?.collection || ''}
          </div>
          {hasOverride && (
            <button
              onClick={() => handleResetToGlobal(activeType)}
              style={styles.resetButton}
            >
              ↩ Pouzit globalni
            </button>
          )}
        </div>
      </div>

      {/* Seznam kolekci */}
      <div style={styles.collections}>
        {collections.map(collection => (
          <div key={collection.id} style={styles.collection}>
            <button
              onClick={() => setExpandedCollection(
                expandedCollection === collection.id ? null : collection.id
              )}
              style={styles.collectionHeader}
            >
              <span>{collection.name}</span>
              <span style={styles.collectionCount}>
                {collection.decors.length}
              </span>
              <span style={styles.expandIcon}>
                {expandedCollection === collection.id ? '▼' : '▶'}
              </span>
            </button>

            {expandedCollection === collection.id && (
              <div style={styles.decorGrid}>
                {collection.decors.map(decor => {
                  const isSelected = currentDecorId === decor.id
                  return (
                    <button
                      key={decor.id}
                      onClick={() => handleDecorSelect(activeType, decor.id)}
                      style={{
                        ...styles.decorItem,
                        ...(isSelected ? styles.decorItemSelected : {})
                      }}
                      title={decor.name}
                    >
                      <div style={styles.decorPreview}>
                        <img
                          src={decor.thumbUrl || decor.imageUrl}
                          alt={decor.name}
                          style={styles.decorImage}
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                      <div style={styles.decorName}>{decor.name}</div>
                      {isSelected && (
                        <div style={styles.checkmark}>✓</div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  header: {
    padding: '10px 12px',
    background: '#495057',
    color: 'white',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  typeSelector: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    background: '#f8f9fa',
    borderBottom: '1px solid #dee2e6'
  },
  typeButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 4px',
    background: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#495057',
    position: 'relative',
    transition: 'all 0.15s'
  },
  typeButtonActive: {
    background: '#e7f5ff',
    borderColor: '#339af0',
    color: '#1971c2'
  },
  typeButtonOverride: {
    borderStyle: 'dashed',
    borderColor: '#fab005'
  },
  overrideDot: {
    position: 'absolute',
    top: '2px',
    right: '4px',
    color: '#fab005',
    fontSize: '8px'
  },
  currentDecor: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    borderBottom: '1px solid #dee2e6'
  },
  currentDecorPreview: {
    width: '60px',
    height: '60px',
    borderRadius: '6px',
    overflow: 'hidden',
    background: '#e9ecef',
    flexShrink: 0
  },
  currentDecorImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  noPreview: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#adb5bd',
    fontSize: '24px'
  },
  currentDecorInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '4px'
  },
  currentDecorName: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#212529'
  },
  currentDecorCollection: {
    fontSize: '12px',
    color: '#868e96'
  },
  resetButton: {
    marginTop: '4px',
    padding: '4px 8px',
    background: '#fff3bf',
    border: '1px solid #fab005',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#e67700',
    cursor: 'pointer'
  },
  collections: {
    maxHeight: '300px',
    overflow: 'auto'
  },
  collection: {
    borderBottom: '1px solid #e9ecef'
  },
  collectionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    color: '#343a40',
    textAlign: 'left'
  },
  collectionCount: {
    marginLeft: 'auto',
    padding: '2px 6px',
    background: '#e9ecef',
    borderRadius: '10px',
    fontSize: '11px',
    color: '#6c757d'
  },
  expandIcon: {
    fontSize: '10px',
    color: '#868e96'
  },
  decorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    padding: '8px 12px 12px',
    background: '#f8f9fa'
  },
  decorItem: {
    position: 'relative',
    padding: '4px',
    background: 'white',
    border: '2px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  decorItemSelected: {
    borderColor: '#339af0',
    background: '#e7f5ff'
  },
  decorPreview: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '4px',
    overflow: 'hidden',
    background: '#e9ecef'
  },
  decorImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  decorName: {
    marginTop: '4px',
    fontSize: '9px',
    color: '#495057',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  checkmark: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    width: '16px',
    height: '16px',
    background: '#339af0',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold'
  }
}
