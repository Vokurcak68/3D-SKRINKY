import { useMemo } from 'react'
import { useStore } from '../store'

/**
 * Rychly toolbar nad scenou s nejpouzivanejsimi skrinkami
 */
export function QuickToolbar() {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const catalog = useStore(s => s.catalog)
  const addCabinet = useStore(s => s.addCabinet)
  const setDraggedCabinet = useStore(s => s.setDraggedCabinet)

  // Najdi nejpouzivanejsi skrinky podle typu
  const quickCabinets = useMemo(() => {
    const baseCabs = catalog.cabinets.filter(c => c.type === 'base')
    const wallCabs = catalog.cabinets.filter(c => c.type === 'wall')
    const tallCabs = catalog.cabinets.filter(c => c.type === 'tall')

    // Vyber reprezentativni skrinky pro rychly pristup
    const quick = []

    // Spodni skrinky - ruzne sirky
    const baseWidths = [400, 500, 600, 800, 900]
    baseWidths.forEach(w => {
      const cab = baseCabs.find(c => c.width === w)
      if (cab) quick.push({ ...cab, quickLabel: `${w/10}` })
    })

    // Horni skrinka
    const wall60 = wallCabs.find(c => c.width === 600) || wallCabs[0]
    if (wall60) quick.push({ ...wall60, quickLabel: 'H60', quickType: 'wall' })

    const wall80 = wallCabs.find(c => c.width === 800)
    if (wall80) quick.push({ ...wall80, quickLabel: 'H80', quickType: 'wall' })

    // Vysoka skrinka
    const tall = tallCabs[0]
    if (tall) quick.push({ ...tall, quickLabel: 'Vysoká', quickType: 'tall' })

    return quick.slice(0, 8) // Max 8 tlacitek
  }, [catalog.cabinets])

  if (quickCabinets.length === 0) return null

  return (
    <div style={styles.toolbar}>
      <span style={styles.label}>Rychle pridat:</span>

      {quickCabinets.map((cab, i) => (
        <QuickButton
          key={`${cab.id}-${i}`}
          cabinet={cab}
          onAdd={() => addCabinet(cab)}
          onDragStart={() => setDraggedCabinet(cab)}
          onDragEnd={() => setDraggedCabinet(null)}
        />
      ))}
    </div>
  )
}

function QuickButton({ cabinet, onAdd, onDragStart, onDragEnd }) {
  const typeColors = {
    base: { bg: '#28a745', hover: '#218838' },
    wall: { bg: '#17a2b8', hover: '#138496' },
    tall: { bg: '#fd7e14', hover: '#e8590c' }
  }

  const colors = typeColors[cabinet.type] || typeColors.base

  return (
    <button
      style={{
        ...styles.button,
        background: colors.bg
      }}
      onClick={onAdd}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', cabinet.id)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      title={`${cabinet.name} (${cabinet.width}x${cabinet.height}x${cabinet.depth}mm)`}
      onMouseEnter={(e) => e.target.style.background = colors.hover}
      onMouseLeave={(e) => e.target.style.background = colors.bg}
    >
      <span style={styles.buttonLabel}>{cabinet.quickLabel}</span>
      <span style={styles.buttonSize}>{cabinet.width}</span>
    </button>
  )
}

const styles = {
  toolbar: {
    position: 'absolute',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    zIndex: 100
  },
  label: {
    fontSize: '12px',
    color: '#666',
    marginRight: '8px',
    fontWeight: 500
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '44px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'grab',
    color: 'white',
    transition: 'transform 0.1s, background 0.15s',
    padding: '4px'
  },
  buttonLabel: {
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: 1
  },
  buttonSize: {
    fontSize: '9px',
    opacity: 0.85,
    marginTop: '2px'
  }
}
