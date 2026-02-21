import { useMemo, useState } from 'react'
import { useStore } from '../store'

const ROT_EPS = 0.15

// 1D "Wall Composer" - první krok k zadávání přes stěnu
export function WallComposer() {
  const placedCabinets = useStore(s => s.placedCabinets)
  const selectedWall = useStore(s => s.selectedWall)
  const setSelectedWall = useStore(s => s.setSelectedWall)
  const selectCabinet = useStore(s => s.selectCabinet)
  const wallInsertCabinet = useStore(s => s.wallInsertCabinet)
  const insertCabinetOnWall = useStore(s => s.insertCabinetOnWall)
  const wallInsertError = useStore(s => s.wallInsertError)
  const clearWallInsertError = useStore(s => s.clearWallInsertError)
  const draggedCabinet = useStore(s => s.draggedCabinet)
  const setDraggedCabinet = useStore(s => s.setDraggedCabinet)
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const catalog = useStore(s => s.catalog)
  const [hoverText, setHoverText] = useState('')
  const [fillerGap, setFillerGap] = useState(null)

  const wallLength = selectedWall === 'back' ? roomWidth : roomDepth

  const segments = useMemo(() => {
    const isOnWall = (cab) => {
      const rot = cab.rotation || 0
      if (selectedWall === 'back') return Math.abs(rot) < ROT_EPS
      if (selectedWall === 'left') return Math.abs(rot - Math.PI / 2) < ROT_EPS
      if (selectedWall === 'right') return Math.abs(rot + Math.PI / 2) < ROT_EPS
      return false
    }

    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000

    const toSegments = (filterFn) => {
      const wallCabs = placedCabinets.filter(cab => isOnWall(cab) && filterFn(cab))

      const withPositions = wallCabs.map(cab => {
        const widthMM = cab.width || 600
        const sizeMM = (selectedWall === 'back') ? widthMM : widthMM

        let startMM = 0
        if (selectedWall === 'back') {
          const startM = cab.position[0] + roomW / 2
          startMM = startM * 1000
        } else {
          const widthM = (cab.width || 600) / 1000
          const startM = selectedWall === 'left'
            ? (cab.position[2] - widthM) + roomD / 2
            : cab.position[2] + roomD / 2
          startMM = startM * 1000
        }

        const clampedStart = Math.max(0, Math.min(wallLength, startMM))
        return {
          id: cab.instanceId,
          cab,
          startMM: clampedStart,
          sizeMM,
          endMM: clampedStart + sizeMM
        }
      })

      const ordered = withPositions.sort((a, b) => a.startMM - b.startMM)

      // Vytvoř sekvenci včetně mezer (gap)
      const result = []
      let cursor = 0
      ordered.forEach(seg => {
        if (seg.startMM - cursor > 5) {
          result.push({
            type: 'gap',
            sizeMM: seg.startMM - cursor,
            startMM: cursor
          })
        }
        result.push({
          type: 'cabinet',
          ...seg
        })
        cursor = Math.max(cursor, seg.endMM)
      })

      if (wallLength - cursor > 5) {
        result.push({
          type: 'gap',
          sizeMM: wallLength - cursor,
          startMM: cursor
        })
      }

      if (result.length === 0) {
        result.push({
          type: 'gap',
          sizeMM: wallLength,
          startMM: 0
        })
      }

      return result
    }

    return {
      base: toSegments(cab => cab.type !== 'wall'),
      wall: toSegments(cab => cab.type === 'wall')
    }
  }, [placedCabinets, selectedWall, roomWidth, roomDepth, wallLength])

  const renderRow = (label, rowKey, rowType) => {
    const rowSegments = segments[rowKey]
    const activeCabinet = draggedCabinet || wallInsertCabinet
    const rowEnabled = activeCabinet
      ? (activeCabinet.type === 'wall' ? rowType === 'wall' : rowType === 'base')
      : false

    return (
      <div style={styles.row}>
        <div style={styles.rowLabel}>{label}</div>
        <div style={styles.strip}>
          {rowSegments.length === 0 ? (
            <div style={styles.empty}>Na této stěně zatím nic není</div>
          ) : (
            rowSegments.map((seg, i) => {
              if (seg.type === 'gap') {
                const neededMM = activeCabinet
                  ? (selectedWall === 'back'
                    ? (activeCabinet.width || 600)
                    : (activeCabinet.width || 600))
                  : 0
                const hasCabinet = !!activeCabinet
                const canInsert = rowEnabled && hasCabinet && seg.sizeMM >= neededMM
                const canFill = seg.sizeMM >= 150
                let reason = ''
                if (!hasCabinet) {
                  reason = 'Nejdřív vyber skříňku (1D) v katalogu.'
                } else if (!rowEnabled) {
                  reason = rowType === 'wall'
                    ? 'Horní řada je pro horní skříňky.'
                    : 'Spodní řada je pro spodní a vysoké skříňky.'
                } else if (!canInsert) {
                  reason = `Mezera je malá (${Math.round(seg.sizeMM)} mm). Skříňka potřebuje ${Math.round(neededMM)} mm.`
                } else {
                  reason = `Klikni pro vložení (${Math.round(neededMM)} mm).`
                }

                return (
                  <div
                    key={`gap-${rowKey}-${i}`}
                    style={{
                      ...styles.gap,
                      width: `${(seg.sizeMM / wallLength) * 100}%`,
                      ...(canInsert ? styles.gapActive : styles.gapDisabled)
                    }}
                    title={reason}
                    onMouseEnter={() => setHoverText(reason)}
                    onMouseLeave={() => setHoverText('')}
                    onDragOver={(e) => {
                      if (!draggedCabinet) return
                      if (!canInsert) {
                        setHoverText(reason)
                        return
                      }
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'copy'
                      setHoverText(reason)
                    }}
                    onDrop={(e) => {
                      if (!draggedCabinet || !canInsert) return
                      e.preventDefault()
                      clearWallInsertError()
                      insertCabinetOnWall(draggedCabinet, selectedWall, seg.startMM, seg.startMM + seg.sizeMM)
                      setDraggedCabinet(null)
                      setHoverText('')
                    }}
                    onClick={() => {
                      if (!canInsert) return
                      clearWallInsertError()
                      insertCabinetOnWall(activeCabinet, selectedWall, seg.startMM, seg.startMM + seg.sizeMM)
                    }}
                  >
                    {canFill && (
                      <button
                        style={styles.fillButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFillerGap({
                            rowType,
                            startMM: seg.startMM,
                            endMM: seg.startMM + seg.sizeMM,
                            sizeMM: seg.sizeMM
                          })
                        }}
                      >
                        Vyplnit
                      </button>
                    )}
                  </div>
                )
              }

              return (
                <div
                  key={seg.id}
                  style={{
                    ...styles.segment,
                    width: `${(seg.sizeMM / wallLength) * 100}%`
                  }}
                  onClick={() => selectCabinet(seg.cab)}
                  title={`${seg.cab.name} (${seg.sizeMM} mm)`}
                >
                  <span style={styles.segmentLabel}>{seg.sizeMM}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>Stěna (1D)</span>
        <span style={styles.length}>{wallLength} mm</span>
      </div>

      <div style={styles.wallSelector}>
        <WallButton
          active={selectedWall === 'back'}
          onClick={() => setSelectedWall('back')}
          label="Zadní"
        />
        <WallButton
          active={selectedWall === 'left'}
          onClick={() => setSelectedWall('left')}
          label="Levá"
        />
        <WallButton
          active={selectedWall === 'right'}
          onClick={() => setSelectedWall('right')}
          label="Pravá"
        />
      </div>

      {renderRow('Spodní + vysoké', 'base', 'base')}
      {renderRow('Horní', 'wall', 'wall')}

      <div style={styles.hint}>
        Tip: nejdřív vyber skříňku tlačítkem 1D v katalogu, pak klikni do mezery.
      </div>

      {hoverText && (
        <div style={styles.tooltip}>
          {hoverText}
        </div>
      )}

      {wallInsertError && (
        <div style={styles.error}>
          {wallInsertError}
        </div>
      )}

      {fillerGap && (
        <FillerPicker
          catalog={catalog}
          rowType={fillerGap.rowType}
          gapSize={fillerGap.sizeMM}
          onClose={() => setFillerGap(null)}
          onPick={(cab) => {
            insertCabinetOnWall(cab, selectedWall, fillerGap.startMM, fillerGap.endMM)
            setFillerGap(null)
          }}
          onAutoFill={(plan) => {
            let cursor = fillerGap.startMM
            plan.forEach((cab) => {
              insertCabinetOnWall(cab, selectedWall, cursor, fillerGap.endMM)
              cursor += cab.width || 0
            })
            setFillerGap(null)
          }}
        />
      )}
    </div>
  )
}

function WallButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.wallButton,
        ...(active ? styles.wallButtonActive : {})
      }}
    >
      {label}
    </button>
  )
}

const styles = {
  wrapper: {
    padding: '12px',
    borderBottom: '1px solid #dee2e6',
    background: '#f1f3f5'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  title: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#343a40',
    textTransform: 'uppercase',
    letterSpacing: '0.6px'
  },
  length: {
    fontSize: '12px',
    color: '#6c757d'
  },
  wallSelector: {
    display: 'flex',
    gap: '6px',
    marginBottom: '10px'
  },
  wallButton: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ced4da',
    background: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  wallButtonActive: {
    background: '#212529',
    color: 'white',
    borderColor: '#212529'
  },
  strip: {
    display: 'flex',
    alignItems: 'stretch',
    height: '36px',
    background: '#fff',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  row: {
    marginBottom: '10px'
  },
  rowLabel: {
    fontSize: '11px',
    color: '#495057',
    marginBottom: '4px',
    fontWeight: 600
  },
  segment: {
    background: 'linear-gradient(135deg, #4dabf7 0%, #228be6 100%)',
    color: 'white',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    borderRight: '1px solid rgba(255,255,255,0.4)'
  },
  segmentLabel: {
    fontWeight: 600
  },
  gap: {
    background: 'repeating-linear-gradient(45deg, #f1f3f5, #f1f3f5 6px, #dee2e6 6px, #dee2e6 12px)',
    position: 'relative'
  },
  gapActive: {
    cursor: 'pointer'
  },
  gapDisabled: {
    opacity: 0.6
  },
  fillButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#212529',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '10px',
    cursor: 'pointer'
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#adb5bd'
  },
  hint: {
    marginTop: '8px',
    fontSize: '11px',
    color: '#6c757d'
  },
  error: {
    marginTop: '8px',
    padding: '6px 8px',
    background: '#fff3cd',
    border: '1px solid #ffeeba',
    color: '#856404',
    borderRadius: '6px',
    fontSize: '11px'
  },
  tooltip: {
    marginTop: '8px',
    padding: '6px 8px',
    background: '#212529',
    color: 'white',
    borderRadius: '6px',
    fontSize: '11px'
  }
}

function FillerPicker({ catalog, rowType, gapSize, onClose, onPick, onAutoFill }) {
  const [query, setQuery] = useState('')

  const oresiOnly = useMemo(() => {
    return (catalog.cabinets || []).filter(c => c.brandId === 1 || c.brand === 'Oresi')
  }, [catalog.cabinets])

  const items = useMemo(() => {
    const type = rowType === 'wall' ? 'wall' : 'base'
    return oresiOnly
      .filter(c => c.type === type)
      .filter(c => (c.width || 0) <= gapSize)
      .filter(c => {
        if (!query) return true
        const text = `${c.name || ''} ${c.code || ''} ${c.width || ''}`.toLowerCase()
        return text.includes(query.toLowerCase())
      })
      .sort((a, b) => (a.width || 0) - (b.width || 0))
      .slice(0, 50)
  }, [oresiOnly, rowType, gapSize, query])

  const panelItems = useMemo(() => {
    const widths = [50, 80, 100, 120, 150, 200, 250, 300]
    return widths
      .filter(w => w <= gapSize)
      .map(w => ({
        id: `panel-${rowType}-${w}`,
        name: `Oresi Panel ${w}`,
        width: w,
        type: rowType === 'wall' ? 'wall' : 'base',
        virtual: true
      }))
  }, [gapSize, rowType])

  const handlePick = (cab) => {
    if (!cab.virtual) {
      onPick(cab)
      return
    }
    const ref = oresiOnly.find(c => c.type === cab.type) || {}
    const virtualCab = {
      id: Date.now() + Math.random(),
      name: cab.name,
      code: 'PANEL',
      brand: 'Oresi',
      brandId: 1,
      type: cab.type,
      width: cab.width,
      height: ref.height || (cab.type === 'wall' ? 720 : 720),
      depth: 18
    }
    onPick(virtualCab)
  }

  const autoFillPlan = () => {
    const type = rowType === 'wall' ? 'wall' : 'base'
    const widths = Array.from(new Set(
      oresiOnly.filter(c => c.type === type).map(c => c.width || 0)
    ))
      .filter(w => w > 0 && w <= gapSize)
      .sort((a, b) => b - a)

    let remaining = gapSize
    const plan = []
    widths.forEach(w => {
      while (remaining >= w) {
        const cab = oresiOnly.find(c => c.type === type && c.width === w)
        if (!cab) break
        plan.push(cab)
        remaining -= w
      }
    })
    return plan
  }

  return (
    <div style={pickerStyles.overlay}>
      <div style={pickerStyles.modal}>
        <div style={pickerStyles.header}>
          <div>
            <strong>Vyplnit mezeru (Oresi)</strong>
            <div style={pickerStyles.sub}>Max šířka: {Math.round(gapSize)} mm</div>
          </div>
          <button onClick={onClose} style={pickerStyles.close}>✕</button>
        </div>
        <div style={pickerStyles.toolbar}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat v Oresi..."
            style={pickerStyles.search}
          />
          <button
            style={pickerStyles.auto}
            onClick={() => onAutoFill(autoFillPlan())}
            title="Automaticky vyplnit více skříňkami"
          >
            Auto‑fill
          </button>
        </div>
        <div style={pickerStyles.list}>
          <div style={pickerStyles.section}>Skříňky</div>
          {items.length === 0 ? (
            <div style={pickerStyles.empty}>Žádná vhodná skříňka</div>
          ) : (
            items.map(c => (
              <button
                key={c.id}
                style={pickerStyles.item}
                onClick={() => handlePick(c)}
              >
                <span>{c.name}</span>
                <span style={pickerStyles.dim}>{c.width} mm</span>
              </button>
            ))
          )}
          <div style={pickerStyles.section}>Panel filler</div>
          {panelItems.map(p => (
            <button
              key={p.id}
              style={pickerStyles.itemAlt}
              onClick={() => handlePick(p)}
            >
              <span>{p.name}</span>
              <span style={pickerStyles.dim}>{p.width} mm</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const pickerStyles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500
  },
  modal: {
    background: 'white',
    width: '480px',
    maxHeight: '360px',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
  },
  header: {
    padding: '10px 12px',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sub: {
    fontSize: '11px',
    color: '#6c757d'
  },
  close: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px'
  },
  toolbar: {
    padding: '8px 12px',
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #e9ecef'
  },
  search: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '12px'
  },
  auto: {
    background: '#212529',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    cursor: 'pointer'
  },
  list: {
    maxHeight: '260px',
    overflow: 'auto'
  },
  section: {
    padding: '6px 12px',
    fontSize: '11px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.6px'
  },
  item: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f3f5',
    fontSize: '13px'
  },
  itemAlt: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: '#f8f9fa',
    display: 'flex',
    justifyContent: 'space-between',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f3f5',
    fontSize: '13px'
  },
  dim: {
    color: '#6c757d'
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: '#868e96'
  }
}
