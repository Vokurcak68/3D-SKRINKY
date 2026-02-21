import { useMemo, useState } from 'react'
import { useStore } from '../store'

export function RoomWizardModal({ isOpen, onClose }) {
  const catalog = useStore(s => s.catalog)
  const setRoomDimensions = useStore(s => s.setRoomDimensions)
  const clearAllCabinets = useStore(s => s.clearAllCabinets)
  const addCabinetAtPosition = useStore(s => s.addCabinetAtPosition)
  const setSelectedWall = useStore(s => s.setSelectedWall)
  const setRoomFeatures = useStore(s => s.setRoomFeatures)

  const [step, setStep] = useState(1)
  const [roomWidth, setRoomWidth] = useState(4000)
  const [roomDepth, setRoomDepth] = useState(3000)
  const [roomHeight, setRoomHeight] = useState(2600)
  const [shape, setShape] = useState('I')
  const [includeWall, setIncludeWall] = useState(true)
  const [includeTall, setIncludeTall] = useState(true)
  const [minPassage, setMinPassage] = useState(900)
  const [enforceAdjacency, setEnforceAdjacency] = useState(true)
  const [minSinkCookGap, setMinSinkCookGap] = useState(600)
  const [doorEnabled, setDoorEnabled] = useState(false)
  const [doorWall, setDoorWall] = useState('back')
  const [doorOffset, setDoorOffset] = useState(500)
  const [doorWidth, setDoorWidth] = useState(900)
  const [windowEnabled, setWindowEnabled] = useState(false)
  const [windowWall, setWindowWall] = useState('back')
  const [windowOffset, setWindowOffset] = useState(800)
  const [windowWidth, setWindowWidth] = useState(1200)
  const [plumbingEnabled, setPlumbingEnabled] = useState(false)
  const [plumbingWall, setPlumbingWall] = useState('back')
  const [plumbingOffset, setPlumbingOffset] = useState(800)
  const [plumbingRange, setPlumbingRange] = useState(600)
  const [sinkWall, setSinkWall] = useState('back')
  const [cookWall, setCookWall] = useState('back')
  const [fridgeWall, setFridgeWall] = useState('right')
  const [wizardError, setWizardError] = useState('')
  const [wizardWarnings, setWizardWarnings] = useState([])

  const baseCabs = useMemo(
    () => catalog.cabinets.filter(c => c.type === 'base'),
    [catalog.cabinets]
  )
  const wallCabs = useMemo(
    () => catalog.cabinets.filter(c => c.type === 'wall'),
    [catalog.cabinets]
  )
  const tallCabs = useMemo(
    () => catalog.cabinets.filter(c => c.type === 'tall'),
    [catalog.cabinets]
  )

  if (!isOpen) return null

  const pickByWidth = (list, width) => list.find(c => c.width === width) || list[0]

  const findByKeyword = (list, keywords) => {
    const lower = keywords.map(k => k.toLowerCase())
    return list.find(c => {
      const text = `${c.name || ''} ${c.code || ''}`.toLowerCase()
      return lower.some(k => text.includes(k))
    })
  }

  const buildSequence = (wallLengthMM, list) => {
    if (list.length === 0) return []
    const widths = [900, 800, 600, 500, 400]
    const seq = []
    let remaining = wallLengthMM - 100 // nech malou rezervu u rohu
    widths.forEach(w => {
      while (remaining >= w + 50) {
        const cab = pickByWidth(list, w)
        if (!cab) break
        seq.push(cab)
        remaining -= w
      }
    })
    return seq.length > 0 ? seq : [list[0]]
  }

  const applyWizard = () => {
    setWizardError('')
    setWizardWarnings([])
    setRoomDimensions(roomWidth, roomDepth, roomHeight)
    clearAllCabinets()

    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000

    const walls = ['back', ...(shape !== 'I' ? ['right'] : []), ...(shape === 'U' ? ['left'] : [])]

    const blocked = []
    if (doorEnabled) {
      blocked.push({ wall: doorWall, start: doorOffset, end: doorOffset + doorWidth, affects: 'base' })
    }
    if (windowEnabled) {
      blocked.push({ wall: windowWall, start: windowOffset, end: windowOffset + windowWidth, affects: 'wall' })
    }
    setRoomFeatures({
      doors: doorEnabled ? [{ wall: doorWall, start: doorOffset, end: doorOffset + doorWidth }] : [],
      windows: windowEnabled ? [{ wall: windowWall, start: windowOffset, end: windowOffset + windowWidth }] : [],
      plumbing: plumbingEnabled ? { wall: plumbingWall, start: plumbingOffset, end: plumbingOffset + plumbingRange } : null
    })

    const wallLength = (wall) => wall === 'back' ? roomWidth : roomDepth
    const cornerClear = 50
    const reservations = []

    const reserve = (wall, type, start, end) => {
      reservations.push({ wall, type, start, end })
    }

    const getFreeSegments = (wall, type) => {
      let segments = [[cornerClear, wallLength(wall) - cornerClear]]
      blocked
        .filter(b => b.wall === wall && (b.affects === type || b.affects === 'all'))
        .forEach(b => {
          segments = segments.flatMap(([s, e]) => {
            if (b.end <= s || b.start >= e) return [[s, e]]
            const next = []
            if (b.start > s) next.push([s, b.start])
            if (b.end < e) next.push([b.end, e])
            return next
          })
        })
      reservations
        .filter(r => r.wall === wall && r.type === type)
        .forEach(r => {
          segments = segments.flatMap(([s, e]) => {
            if (r.end <= s || r.start >= e) return [[s, e]]
            const next = []
            if (r.start > s) next.push([s, r.start])
            if (r.end < e) next.push([r.end, e])
            return next
          })
        })

      return segments.filter(([s, e]) => e - s > 200)
    }

    const placeOnWall = (wall, list, type) => {
      if (!list.length) return
      const segments = getFreeSegments(wall, type)
      const widths = [900, 800, 600, 500, 400]
      segments.forEach(([s, e]) => {
        let cursor = s
        while (cursor + 350 <= e) {
          const width = widths.find(w => cursor + w <= e) || widths[widths.length - 1]
          const cab = pickByWidth(list, width) || list[0]
          const pos = getPositionForWall(wall, cursor, cab.width || width, type === 'wall')
          addCabinetAtPosition(cab, pos.position, pos.rotation)
          reserve(wall, type, cursor, cursor + (cab.width || width))
          cursor += (cab.width || width)
        }
      })
    }

    const getPositionForWall = (wall, startMM, cabWidthMM, isWall) => {
      const y = isWall ? 1.4 : 0
      if (wall === 'back') {
        return { position: [-roomW / 2 + (startMM / 1000), y, -roomD / 2], rotation: 0 }
      }
      const zStartM = -roomD / 2 + (startMM / 1000)
      if (wall === 'left') {
        return { position: [-roomW / 2, y, zStartM + (cabWidthMM / 1000)], rotation: Math.PI / 2 }
      }
      return { position: [roomW / 2, y, zStartM], rotation: -Math.PI / 2 }
    }

    const placeZone = (wall, list, keywords, type, preferRange = null) => {
      const cab = findByKeyword(list, keywords)
      if (!cab) return
      const segments = getFreeSegments(wall, type)
      if (segments.length === 0) return
      let [s, e] = segments[0]
      if (preferRange) {
        const [rStart, rEnd] = preferRange
        const match = segments.find(([a, b]) => rEnd > a && rStart < b)
        if (match) {
          s = Math.max(match[0], rStart)
          e = match[1]
        }
      }
      if (s + (cab.width || 600) > e) return
      const pos = getPositionForWall(wall, s, cab.width || 600, type === 'wall')
      addCabinetAtPosition(cab, pos.position, pos.rotation)
      reserve(wall, type, s, s + (cab.width || 600))
    }

    // Zóny (základní)
    const effectiveSinkWall = plumbingEnabled ? plumbingWall : sinkWall
    const sinkRange = plumbingEnabled
      ? [plumbingOffset, plumbingOffset + plumbingRange]
      : null

    placeZone(effectiveSinkWall, baseCabs, ['sink', 'drez', 'dřez'], 'base', sinkRange)
    placeZone(cookWall, baseCabs, ['cook', 'var', 'varn', 'varná'], 'base')
    placeZone(fridgeWall, tallCabs, ['fridge', 'led', 'chlad'], 'base')

    if (enforceAdjacency) {
      const sinkCab = findByKeyword(baseCabs, ['sink', 'drez', 'dřez'])
      const dishCab = findByKeyword(baseCabs, ['dish', 'myc', 'myčka'])
      if (sinkCab && dishCab && effectiveSinkWall) {
        const segments = getFreeSegments(effectiveSinkWall, 'base')
        if (segments.length > 0) {
          const [s] = segments[0]
          const pos = getPositionForWall(effectiveSinkWall, s, dishCab.width || 600, false)
          addCabinetAtPosition(dishCab, pos.position, pos.rotation)
          reserve(effectiveSinkWall, 'base', s, s + (dishCab.width || 600))
        }
      }
    }

    // Zbytek skříněk podle stěn
    walls.forEach(w => {
      setSelectedWall(w)
      if (includeTall && w === 'back' && tallCabs.length > 0) {
        const pos = getPositionForWall(w, cornerClear, tallCabs[0].width || 600, false)
        addCabinetAtPosition(tallCabs[0], pos.position, pos.rotation)
        reserve(w, 'base', cornerClear, cornerClear + (tallCabs[0].width || 600))
      }
      placeOnWall(w, baseCabs, 'base')
      if (includeWall) {
        placeOnWall(w, wallCabs, 'wall')
      }
    })

    // Validace průchodu (hrubá)
    const warnings = []
    const baseDepthMM = 600
    if (shape === 'U') {
      const passage = roomWidth - baseDepthMM * 2
      if (passage < minPassage) warnings.push(`Průchod v U-kuchyni je cca ${passage} mm (min ${minPassage} mm).`)
    } else {
      const passage = roomDepth - baseDepthMM
      if (passage < minPassage) warnings.push(`Průchod je cca ${passage} mm (min ${minPassage} mm).`)
    }

    if (minSinkCookGap && effectiveSinkWall === cookWall) {
      warnings.push('Dřez i varná jsou na stejné stěně. Zkontroluj rozestup.')
    }

    if (warnings.length > 0) {
      setWizardWarnings(warnings)
    }

    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Room Wizard</h3>
            <p style={styles.subtitle}>Rychly start navrhu kuchyne</p>
          </div>
          <button onClick={onClose} style={styles.close}>✕</button>
        </div>

        <div style={styles.content}>
          {step === 1 && (
            <div>
              <p style={styles.sectionTitle}>Rozmery mistnosti</p>
              <div style={styles.grid}>
                <Field label="Sirka (mm)" value={roomWidth} onChange={setRoomWidth} />
                <Field label="Hloubka (mm)" value={roomDepth} onChange={setRoomDepth} />
                <Field label="Vyska (mm)" value={roomHeight} onChange={setRoomHeight} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={styles.sectionTitle}>Tvar kuchyne</p>
              <div style={styles.row}>
                <Radio value="I" current={shape} onChange={setShape} label="I - jedna stena" />
                <Radio value="L" current={shape} onChange={setShape} label="L - zadni + prava" />
                <Radio value="U" current={shape} onChange={setShape} label="U - zadni + leva + prava" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p style={styles.sectionTitle}>Obsah navrhu a omezeni</p>
              <label style={styles.checkbox}>
                <input type="checkbox" checked={includeWall} onChange={() => setIncludeWall(!includeWall)} />
                <span>Horní skrinky</span>
              </label>
              <label style={styles.checkbox}>
                <input type="checkbox" checked={includeTall} onChange={() => setIncludeTall(!includeTall)} />
                <span>Vysoka skrinka (na zacatek)</span>
              </label>
              <div style={styles.subSection}>
                <p style={styles.sectionHint}>Ergonomie</p>
                <Field label="Min. pruchod (mm)" value={minPassage} onChange={setMinPassage} />
                <label style={styles.checkbox}>
                  <input type="checkbox" checked={enforceAdjacency} onChange={() => setEnforceAdjacency(!enforceAdjacency)} />
                  <span>Preferovat drez + mycku u sebe</span>
                </label>
                <Field label="Min. mezera drez-varna (mm)" value={minSinkCookGap} onChange={setMinSinkCookGap} />
              </div>
              <div style={styles.subSection}>
                <label style={styles.checkbox}>
                  <input type="checkbox" checked={doorEnabled} onChange={() => setDoorEnabled(!doorEnabled)} />
                  <span>Dvere (blokují spodni)</span>
                </label>
                {doorEnabled && (
                  <div style={styles.row}>
                    <Select label="Stena" value={doorWall} onChange={setDoorWall} />
                    <Field label="Offset (mm)" value={doorOffset} onChange={setDoorOffset} />
                    <Field label="Sirka (mm)" value={doorWidth} onChange={setDoorWidth} />
                  </div>
                )}
              </div>
              <div style={styles.subSection}>
                <label style={styles.checkbox}>
                  <input type="checkbox" checked={windowEnabled} onChange={() => setWindowEnabled(!windowEnabled)} />
                  <span>Okno (blokuje horni)</span>
                </label>
                {windowEnabled && (
                  <div style={styles.row}>
                    <Select label="Stena" value={windowWall} onChange={setWindowWall} />
                    <Field label="Offset (mm)" value={windowOffset} onChange={setWindowOffset} />
                    <Field label="Sirka (mm)" value={windowWidth} onChange={setWindowWidth} />
                  </div>
                )}
              </div>
              <div style={styles.subSection}>
                <label style={styles.checkbox}>
                  <input type="checkbox" checked={plumbingEnabled} onChange={() => setPlumbingEnabled(!plumbingEnabled)} />
                  <span>Rozvody vody/odpadu (pro drez)</span>
                </label>
                {plumbingEnabled && (
                  <div style={styles.row}>
                    <Select label="Stena" value={plumbingWall} onChange={setPlumbingWall} />
                    <Field label="Offset (mm)" value={plumbingOffset} onChange={setPlumbingOffset} />
                    <Field label="Rozsah (mm)" value={plumbingRange} onChange={setPlumbingRange} />
                  </div>
                )}
              </div>
              <div style={styles.subSection}>
                <p style={styles.sectionHint}>Zony (orientacne)</p>
                <div style={styles.row}>
                  <Select label="Drez" value={sinkWall} onChange={setSinkWall} />
                  <Select label="Varna" value={cookWall} onChange={setCookWall} />
                  <Select label="Lednice" value={fridgeWall} onChange={setFridgeWall} />
                </div>
              </div>
              <div style={styles.note}>
                Poznamka: Wizard pouzije nejbeznejsi sirky z katalogu.
              </div>
            </div>
          )}
        </div>

        {wizardError && (
          <div style={styles.errorBox}>{wizardError}</div>
        )}
        {wizardWarnings.length > 0 && (
          <div style={styles.warnBox}>
            {wizardWarnings.map((w, i) => (
              <div key={i}>• {w}</div>
            ))}
          </div>
        )}

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.secondary}>Zrusit</button>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={styles.secondary}>Zpet</button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} style={styles.primary}>Dalsi</button>
          ) : (
            <button onClick={applyWizard} style={styles.primary}>Vytvorit navrh</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={styles.input}
        step={100}
      />
    </label>
  )
}

function Radio({ value, current, onChange, label }) {
  return (
    <label style={styles.radio}>
      <input type="radio" checked={current === value} onChange={() => onChange(value)} />
      <span>{label}</span>
    </label>
  )
}

function Select({ label, value, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      >
        <option value="back">Zadni</option>
        <option value="left">Leva</option>
        <option value="right">Prava</option>
      </select>
    </label>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modal: {
    background: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '640px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    margin: 0,
    fontSize: '18px'
  },
  subtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#6c757d'
  },
  close: {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer'
  },
  content: {
    padding: '20px'
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginBottom: '12px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  row: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#6c757d'
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #ced4da',
    borderRadius: '6px'
  },
  radio: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '14px'
  },
  checkbox: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px'
  },
  note: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#6c757d'
  },
  errorBox: {
    margin: '0 20px 10px 20px',
    padding: '8px 10px',
    background: '#fff5f5',
    border: '1px solid #ffa8a8',
    color: '#c92a2a',
    borderRadius: '6px',
    fontSize: '12px'
  },
  warnBox: {
    margin: '0 20px 10px 20px',
    padding: '8px 10px',
    background: '#fff9db',
    border: '1px solid #ffe066',
    color: '#8f6b00',
    borderRadius: '6px',
    fontSize: '12px'
  },
  subSection: {
    marginTop: '12px'
  },
  sectionHint: {
    fontSize: '12px',
    color: '#6c757d',
    marginBottom: '6px'
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #e9ecef',
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  primary: {
    background: '#228be6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 600
  },
  secondary: {
    background: '#f1f3f5',
    color: '#343a40',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    padding: '8px 14px',
    cursor: 'pointer'
  }
}
