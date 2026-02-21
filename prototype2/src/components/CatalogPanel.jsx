import { useState, useMemo, useCallback } from 'react'
import { useStore } from '../store'

// Panel s katalogem skrynek
export function CatalogPanel() {
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const catalog = useStore(s => s.catalog)
  const addCabinet = useStore(s => s.addCabinet)
  const setDraggedCabinet = useStore(s => s.setDraggedCabinet)
  const draggedCabinet = useStore(s => s.draggedCabinet)
  const wallInsertCabinet = useStore(s => s.wallInsertCabinet)
  const setWallInsertCabinet = useStore(s => s.setWallInsertCabinet)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [selectedType, setSelectedType] = useState('all')

  // Ziskej znacky z katalogu
  const brands = useMemo(() => {
    return catalog.brands || []
  }, [catalog.brands])

  // Ziskej unikatni skupiny (filtrovane podle vybrane znacky)
  const groups = useMemo(() => {
    const filteredCabs = selectedBrand === 'all'
      ? catalog.cabinets
      : catalog.cabinets.filter(c => c.brandId === parseInt(selectedBrand))
    const groupSet = new Set(filteredCabs.map(c => c.group || 'Ostatni'))
    return ['all', ...Array.from(groupSet).sort()]
  }, [catalog.cabinets, selectedBrand])

  // Typy skrynek (worktop se negeneruje rucne, pouzij tlacitko v properties panelu)
  const types = [
    { value: 'all', label: 'Vsechny typy' },
    { value: 'base', label: 'Spodni skrinky' },
    { value: 'wall', label: 'Horni skrinky' },
    { value: 'tall', label: 'Vysoke skrinky' }
  ]

  // Filtruj skrinky
  const filteredCabinets = useMemo(() => {
    return catalog.cabinets.filter(cab => {
      const matchesSearch = !searchTerm ||
        cab.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cab.code?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesBrand = selectedBrand === 'all' || cab.brandId === parseInt(selectedBrand)
      const matchesGroup = selectedGroup === 'all' || cab.group === selectedGroup
      const matchesType = selectedType === 'all' || cab.type === selectedType

      return matchesSearch && matchesBrand && matchesGroup && matchesType
    })
  }, [catalog.cabinets, searchTerm, selectedBrand, selectedGroup, selectedType])

  // Pocty podle typu
  const typeCounts = useMemo(() => {
    const counts = { base: 0, wall: 0, tall: 0 }
    catalog.cabinets.forEach(c => {
      if (counts[c.type] !== undefined) counts[c.type]++
    })
    return counts
  }, [catalog.cabinets])

  // Drag handlers
  const handleDragStart = useCallback((cabinet) => {
    setDraggedCabinet(cabinet)
  }, [setDraggedCabinet])

  const handleDragEnd = useCallback(() => {
    // Pokud se nepustilo nad scenou, zrus drag
    setDraggedCabinet(null)
  }, [setDraggedCabinet])

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>
        Katalog skrynek
        <span style={styles.titleBadge}>{catalog.cabinets.length}</span>
      </h3>

      {/* Instrukce pro drag */}
      <div style={styles.dragHint}>
        Pretahni skrinku do sceny nebo klikni na +
      </div>

      {/* Vyhledavani */}
      <input
        type="text"
        placeholder="Hledat skrinku..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={styles.searchInput}
      />

      {/* Filtr typu */}
      <div style={styles.typeFilter}>
        {types.map(t => (
          <button
            key={t.value}
            onClick={() => setSelectedType(t.value)}
            style={{
              ...styles.typeButton,
              ...(selectedType === t.value ? styles.typeButtonActive : {})
            }}
          >
            {t.value === 'all' ? 'Vse' : t.label.split(' ')[0]}
            {t.value !== 'all' && (
              <span style={styles.typeCount}>{typeCounts[t.value]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtr znacky */}
      <select
        value={selectedBrand}
        onChange={(e) => {
          setSelectedBrand(e.target.value)
          setSelectedGroup('all')
        }}
        style={styles.brandSelect}
      >
        <option value="all">Vsechny znacky</option>
        {brands.map(b => (
          <option key={b.id} value={b.id}>
            {b.label || b.name}
          </option>
        ))}
      </select>

      {/* Filtr skupin */}
      <select
        value={selectedGroup}
        onChange={(e) => setSelectedGroup(e.target.value)}
        style={styles.select}
      >
        {groups.map(g => (
          <option key={g} value={g}>
            {g === 'all' ? 'Vsechny skupiny' : g}
          </option>
        ))}
      </select>

      {/* Seznam skrynek */}
      <div style={styles.cabinetList}>
        {filteredCabinets.length === 0 ? (
          <div style={styles.empty}>Zadne skrinky nenalezeny</div>
        ) : (
          filteredCabinets.map(cabinet => (
            <CabinetItem
              key={cabinet.id}
              cabinet={cabinet}
              onAdd={() => addCabinet(cabinet)}
              onDragStart={() => handleDragStart(cabinet)}
              onDragEnd={handleDragEnd}
              onSetInsert={() => setWallInsertCabinet(cabinet)}
              isInsertActive={wallInsertCabinet?.id === cabinet.id}
              isDragging={draggedCabinet?.id === cabinet.id}
            />
          ))
        )}
      </div>

      <div style={styles.stats}>
        Zobrazeno: {filteredCabinets.length} z {catalog.cabinets.length}
      </div>
    </div>
  )
}

// Polozka skrinky v katalogu - s drag podporou
function CabinetItem({ cabinet, onAdd, onDragStart, onDragEnd, isDragging, onSetInsert, isInsertActive }) {
  const typeColors = {
    base: '#28a745',
    wall: '#17a2b8',
    tall: '#fd7e14'
  }

  const typeLabels = {
    base: 'Spodni',
    wall: 'Horni',
    tall: 'Vysoka'
  }

  const brandColors = {
    'Oresi': '#e74c3c',
    'Livanza': '#9b59b6',
    'Bauformat': '#3498db',
    'Satni skrine': '#27ae60'
  }

  return (
    <div
      style={{
        ...styles.cabinetItem,
        ...(isInsertActive ? styles.cabinetItemActive : {}),
        ...(isDragging ? styles.cabinetItemDragging : {}),
        cursor: 'grab'
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', cabinet.id)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
    >
      {/* Drag handle ikona */}
      <div style={styles.dragHandle}>
        <span style={styles.dragIcon}>⋮⋮</span>
      </div>

      <div style={styles.cabinetInfo}>
        <div style={styles.cabinetHeader}>
          <span style={styles.cabinetName}>{cabinet.name}</span>
          <span style={{
            ...styles.typeBadge,
            background: typeColors[cabinet.type] || '#6c757d'
          }}>
            {typeLabels[cabinet.type] || cabinet.type}
          </span>
        </div>
        <div style={styles.cabinetMeta}>
          <span style={styles.cabinetCode}>{cabinet.code}</span>
          {cabinet.brand && (
            <span style={{
              ...styles.brandBadge,
              background: brandColors[cabinet.brand] || '#6c757d'
            }}>
              {cabinet.brand}
            </span>
          )}
        </div>
        <div style={styles.cabinetDims}>
          {cabinet.width} x {cabinet.height} x {cabinet.depth} mm
        </div>
        {cabinet.widths && cabinet.widths.length > 1 && (
          <div style={styles.cabinetWidths}>
            Sirky: {cabinet.widths.slice(0, 5).join(', ')}
            {cabinet.widths.length > 5 && '...'}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
        style={styles.addButton}
        title="Pridat skrinku"
      >
        +
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSetInsert()
        }}
        style={styles.insertButton}
        title="Nastavit pro vkladani do 1D steny"
      >
        1D
      </button>
    </div>
  )
}

const styles = {
  panel: {
    width: '320px',
    height: '100%',
    background: '#f8f9fa',
    borderRight: '1px solid #dee2e6',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  title: {
    margin: 0,
    padding: '16px',
    background: '#343a40',
    color: 'white',
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleBadge: {
    background: 'rgba(255,255,255,0.2)',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '13px'
  },
  dragHint: {
    padding: '8px 12px',
    background: '#e8f5e9',
    color: '#2e7d32',
    fontSize: '11px',
    textAlign: 'center',
    borderBottom: '1px solid #c8e6c9'
  },
  searchInput: {
    margin: '12px 12px 8px',
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  typeFilter: {
    display: 'flex',
    gap: '4px',
    margin: '0 12px 8px',
  },
  typeButton: {
    flex: 1,
    padding: '6px 4px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    background: 'white',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px'
  },
  typeButtonActive: {
    background: '#228be6',
    color: 'white',
    borderColor: '#228be6'
  },
  typeCount: {
    fontSize: '10px',
    opacity: 0.8
  },
  brandSelect: {
    margin: '0 12px 8px',
    padding: '10px 12px',
    border: '2px solid #228be6',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white',
    fontWeight: 600,
    color: '#228be6'
  },
  select: {
    margin: '0 12px 12px',
    padding: '8px 12px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white'
  },
  cabinetList: {
    flex: 1,
    overflow: 'auto',
    padding: '0 12px'
  },
  cabinetItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    marginBottom: '8px',
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'transform 0.1s, box-shadow 0.1s, opacity 0.1s',
    userSelect: 'none'
  },
  cabinetItemDragging: {
    opacity: 0.5,
    transform: 'scale(0.98)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  },
  cabinetItemActive: {
    outline: '2px solid #2f9e44'
  },
  dragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    marginRight: '8px',
    color: '#adb5bd',
    cursor: 'grab'
  },
  dragIcon: {
    fontSize: '14px',
    letterSpacing: '-2px'
  },
  cabinetInfo: {
    flex: 1,
    minWidth: 0
  },
  cabinetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '2px'
  },
  cabinetName: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#212529',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  typeBadge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    color: 'white',
    fontWeight: 500,
    flexShrink: 0
  },
  cabinetMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '2px'
  },
  cabinetCode: {
    fontSize: '12px',
    color: '#6c757d'
  },
  brandBadge: {
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '9px',
    color: 'white',
    fontWeight: 500
  },
  cabinetDims: {
    fontSize: '11px',
    color: '#868e96',
    marginTop: '4px'
  },
  cabinetWidths: {
    fontSize: '10px',
    color: '#adb5bd',
    marginTop: '2px'
  },
  addButton: {
    width: '36px',
    height: '36px',
    background: '#228be6',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '20px',
    fontWeight: 500,
    marginLeft: '8px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  insertButton: {
    width: '36px',
    height: '36px',
    background: '#2f9e44',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 700,
    marginLeft: '6px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: '#868e96'
  },
  stats: {
    padding: '12px',
    fontSize: '12px',
    color: '#868e96',
    borderTop: '1px solid #dee2e6',
    textAlign: 'center'
  }
}
