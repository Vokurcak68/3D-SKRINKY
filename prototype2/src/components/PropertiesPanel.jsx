import { useState, useRef } from 'react'
import { useStore } from '../store'
import { DecorSelector } from './DecorSelector'
import { RoomWizardModal } from './RoomWizardModal'
import { PhotoRenderModal } from './PhotoRenderModal'

// Panel s vlastnostmi vybrané skříňky
export function PropertiesPanel() {
  const [showWizard, setShowWizard] = useState(false)
  const [showPhotoRender, setShowPhotoRender] = useState(false)
  const [designName, setDesignName] = useState('')
  const [showSavedList, setShowSavedList] = useState(false)
  const fileInputRef = useRef(null)
  // DULEZITE: Jednotlive selektory pro minimalni re-rendery
  const selectedCabinet = useStore(s => s.selectedCabinet)
  const removeCabinet = useStore(s => s.removeCabinet)
  const updateCabinetPosition = useStore(s => s.updateCabinetPosition)
  const updateCabinetRotation = useStore(s => s.updateCabinetRotation)
  const rotateCabinet = useStore(s => s.rotateCabinet)
  const placedCabinets = useStore(s => s.placedCabinets)
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const roomHeight = useStore(s => s.roomHeight)
  const setRoomDimensions = useStore(s => s.setRoomDimensions)
  const loadSampleKitchen = useStore(s => s.loadSampleKitchen)
  const clearAllCabinets = useStore(s => s.clearAllCabinets)
  const selectCabinet = useStore(s => s.selectCabinet)
  const snapToGrid = useStore(s => s.snapToGrid)
  const snapToWall = useStore(s => s.snapToWall)
  const snapToCabinet = useStore(s => s.snapToCabinet)
  const toggleSnapToGrid = useStore(s => s.toggleSnapToGrid)
  const toggleSnapToWall = useStore(s => s.toggleSnapToWall)
  const toggleSnapToCabinet = useStore(s => s.toggleSnapToCabinet)
  const gridSize = useStore(s => s.gridSize)
  const setGridSize = useStore(s => s.setGridSize)
  const constraintMode = useStore(s => s.constraintMode)
  const setConstraintMode = useStore(s => s.setConstraintMode)
  const constraintConfig = useStore(s => s.constraintConfig)
  const setConstraintConfig = useStore(s => s.setConstraintConfig)
  const constraintIssues = useStore(s => s.constraintIssues)
  const constraintDetails = useStore(s => s.constraintDetails)
  const applyConstraints = useStore(s => s.applyConstraints)
  const generateWorktop = useStore(s => s.generateWorktop)
  const saveDesign = useStore(s => s.saveDesign)
  const loadDesign = useStore(s => s.loadDesign)
  const getSavedDesigns = useStore(s => s.getSavedDesigns)
  const deleteDesign = useStore(s => s.deleteDesign)
  const exportDesign = useStore(s => s.exportDesign)
  const importDesign = useStore(s => s.importDesign)

  // Seznam uložených návrhů
  const savedDesigns = getSavedDesigns()

  // Uložit návrh
  const handleSaveDesign = () => {
    if (!designName.trim()) {
      alert('Zadejte název návrhu')
      return
    }
    saveDesign(designName.trim())
    setDesignName('')
    alert(`Návrh "${designName.trim()}" byl uložen`)
  }

  // Načíst návrh
  const handleLoadDesign = (name) => {
    if (confirm(`Načíst návrh "${name}"? Aktuální rozložení bude nahrazeno.`)) {
      loadDesign(name)
      setShowSavedList(false)
    }
  }

  // Smazat návrh
  const handleDeleteDesign = (name, e) => {
    e.stopPropagation()
    if (confirm(`Opravdu smazat návrh "${name}"?`)) {
      deleteDesign(name)
    }
  }

  // Export do souboru
  const handleExportDesign = () => {
    const json = exportDesign()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kuchyne_${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import ze souboru
  const handleImportDesign = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        importDesign(event.target.result)
        alert('Návrh byl úspěšně načten')
      } catch (err) {
        alert('Chyba při načítání souboru: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }

  return (
    <>
    <div style={styles.panel}>
      <h3 style={styles.title}>Vlastnosti</h3>

      {/* Rozměry místnosti */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Místnost</h4>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Šířka (mm)</label>
          <input
            type="number"
            value={roomWidth}
            onChange={(e) => setRoomDimensions(+e.target.value, roomDepth, roomHeight)}
            style={styles.input}
            step={100}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Hloubka (mm)</label>
          <input
            type="number"
            value={roomDepth}
            onChange={(e) => setRoomDimensions(roomWidth, +e.target.value, roomHeight)}
            style={styles.input}
            step={100}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Výška (mm)</label>
          <input
            type="number"
            value={roomHeight}
            onChange={(e) => setRoomDimensions(roomWidth, roomDepth, +e.target.value)}
            style={styles.input}
            step={100}
          />
        </div>
      </div>

      {/* Přichytávání */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Přichytávání</h4>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={toggleSnapToGrid}
            style={styles.checkbox}
          />
          Přichytávat k mřížce
        </label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={snapToWall}
            onChange={toggleSnapToWall}
            style={styles.checkbox}
          />
          Přichytávat ke stěnám
        </label>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={snapToCabinet}
            onChange={toggleSnapToCabinet}
            style={styles.checkbox}
          />
          Přichytávat ke skříňkám
        </label>
        {snapToGrid && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>Velikost mřížky (cm)</label>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(parseFloat(e.target.value))}
              style={styles.input}
            >
              <option value={0.01}>1 cm</option>
              <option value={0.025}>2.5 cm</option>
              <option value={0.05}>5 cm</option>
              <option value={0.1}>10 cm</option>
            </select>
          </div>
        )}
      </div>

      {/* Constraint mode */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Constraint Mode</h4>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={constraintMode}
            onChange={(e) => setConstraintMode(e.target.checked)}
            style={styles.checkbox}
          />
          Automatické dodržování pravidel
        </label>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Min. mezera dřez–varná (mm)</label>
          <input
            type="number"
            value={constraintConfig.minSinkCookGap}
            onChange={(e) => setConstraintConfig({ minSinkCookGap: +e.target.value })}
            style={styles.input}
            step={50}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Pracovní trojúhelník min (mm)</label>
          <input
            type="number"
            value={constraintConfig.workTriangleMin}
            onChange={(e) => setConstraintConfig({ workTriangleMin: +e.target.value })}
            style={styles.input}
            step={100}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Pracovní trojúhelník max (mm)</label>
          <input
            type="number"
            value={constraintConfig.workTriangleMax}
            onChange={(e) => setConstraintConfig({ workTriangleMax: +e.target.value })}
            style={styles.input}
            step={100}
          />
        </div>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={constraintConfig.requireDishwasherAdjacent}
            onChange={(e) => setConstraintConfig({ requireDishwasherAdjacent: e.target.checked })}
            style={styles.checkbox}
          />
          Myčka vedle dřezu
        </label>
        <button onClick={applyConstraints} style={styles.constraintButton}>
          Auto‑fix now
        </button>
        {constraintIssues.length > 0 && (
          <div style={styles.constraintWarn}>
            {constraintIssues.map((m, i) => (
              <div key={i}>• {m}</div>
            ))}
          </div>
        )}
        {constraintDetails.length > 0 && (
          <div style={styles.constraintDetails}>
            {constraintDetails.map((m, i) => (
              <div key={i}>• {m.message}</div>
            ))}
          </div>
        )}
      </div>

      {/* Akce */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Akce</h4>
        <button onClick={() => setShowWizard(true)} style={styles.wizardButton}>
          Room Wizard
        </button>
        <button onClick={() => setShowPhotoRender(true)} style={styles.wizardButton}>
          AI foto render
        </button>
        <button onClick={loadSampleKitchen} style={styles.actionButton}>
          Nacist vzorovou kuchyn
        </button>
        <button
          onClick={() => window.open('/preview.html', 'preview', 'width=1200,height=800')}
          style={styles.previewButton}
        >
          Otevrit realisticky nahled
        </button>
        {placedCabinets.length > 0 && (
          <button onClick={clearAllCabinets} style={styles.clearButton}>
            Vycistit scenu
          </button>
        )}
      </div>

      {/* Ukládání návrhu */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Ukladani navrhu</h4>

        {/* Uložit */}
        <div style={styles.saveGroup}>
          <input
            type="text"
            placeholder="Nazev navrhu..."
            value={designName}
            onChange={(e) => setDesignName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveDesign()}
            style={styles.saveInput}
          />
          <button onClick={handleSaveDesign} style={styles.saveButton}>
            Ulozit
          </button>
        </div>

        {/* Seznam uložených */}
        {savedDesigns.length > 0 && (
          <>
            <button
              onClick={() => setShowSavedList(!showSavedList)}
              style={styles.loadListButton}
            >
              {showSavedList ? 'Skryt ulozene' : `Nacist ulozeny (${savedDesigns.length})`}
            </button>

            {showSavedList && (
              <div style={styles.savedList}>
                {savedDesigns.map(design => (
                  <div
                    key={design.name}
                    style={styles.savedItem}
                    onClick={() => handleLoadDesign(design.name)}
                  >
                    <div style={styles.savedItemInfo}>
                      <span style={styles.savedName}>{design.name}</span>
                      <span style={styles.savedDate}>
                        {new Date(design.savedAt).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDesign(design.name, e)}
                      style={styles.deleteSmall}
                      title="Smazat"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Export/Import */}
        <div style={styles.exportGroup}>
          <button onClick={handleExportDesign} style={styles.exportButton}>
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={styles.importButton}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportDesign}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Globalni dekory */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Vychozi dekory</h4>
        <DecorSelector mode="global" />
      </div>

      {/* Vybraná skříňka */}
      {selectedCabinet ? (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Vybraná skříňka</h4>

          <div style={styles.cabinetName}>{selectedCabinet.name}</div>
          <div style={styles.cabinetCode}>{selectedCabinet.code}</div>

          <div style={styles.dimensions}>
            <span>{selectedCabinet.width}</span> ×
            <span>{selectedCabinet.height}</span> ×
            <span>{selectedCabinet.depth}</span> mm
          </div>

          {/* Pozice */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Pozice X (m)</label>
            <input
              type="number"
              value={selectedCabinet.position[0].toFixed(2)}
              onChange={(e) => updateCabinetPosition(
                selectedCabinet.instanceId,
                [+e.target.value, selectedCabinet.position[1], selectedCabinet.position[2]]
              )}
              style={styles.input}
              step={0.1}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Pozice Z (m)</label>
            <input
              type="number"
              value={selectedCabinet.position[2].toFixed(2)}
              onChange={(e) => updateCabinetPosition(
                selectedCabinet.instanceId,
                [selectedCabinet.position[0], selectedCabinet.position[1], +e.target.value]
              )}
              style={styles.input}
              step={0.1}
            />
          </div>

          {/* Rotace */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Rotace</label>
            <div style={styles.rotationControls}>
              <button
                onClick={() => rotateCabinet(selectedCabinet.instanceId, 1)}
                style={styles.rotateButton}
                title="Otočit doleva (90° CCW) - klávesa R"
              >
                ⟲ 90°
              </button>
              <input
                type="text"
                value={Math.round((selectedCabinet.rotation || 0) * 180 / Math.PI) + '°'}
                readOnly
                style={styles.rotationDisplay}
              />
              <button
                onClick={() => rotateCabinet(selectedCabinet.instanceId, -1)}
                style={styles.rotateButton}
                title="Otočit doprava (90° CW) - klávesa Shift+R"
              >
                ⟳ 90°
              </button>
            </div>
          </div>

          {/* Dekory skrinky */}
          <div style={{ marginTop: '16px' }}>
            <DecorSelector mode="cabinet" cabinet={selectedCabinet} />
          </div>

          {/* Tlačítko pro generování pracovní desky - pouze pro base skříňky */}
          {selectedCabinet.type === 'base' && (
            <button
              onClick={() => generateWorktop()}
              style={styles.worktopButton}
            >
              Přidat pracovní desku
            </button>
          )}

          <button
            onClick={() => removeCabinet(selectedCabinet.instanceId)}
            style={styles.removeButton}
          >
            Odstranit skříňku
          </button>
        </div>
      ) : (
        <div style={styles.noSelection}>
          <p>Klikněte na skříňku pro zobrazení vlastností</p>
        </div>
      )}

      {/* Seznam umístěných skříněk */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          Umístěné skříňky ({placedCabinets.length})
        </h4>
        <div style={styles.placedList}>
          {placedCabinets.map((cab, index) => (
            <div
              key={cab.instanceId}
              style={{
                ...styles.placedItem,
                background: selectedCabinet?.instanceId === cab.instanceId ? '#e7f5ff' : 'white',
                cursor: 'pointer'
              }}
              onClick={() => selectCabinet(cab)}
            >
              <span>{index + 1}. {cab.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeCabinet(cab.instanceId)
                }}
                style={styles.removeSmall}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>

    <RoomWizardModal isOpen={showWizard} onClose={() => setShowWizard(false)} />
    <PhotoRenderModal isOpen={showPhotoRender} onClose={() => setShowPhotoRender(false)} />
    </>
  )
}

const styles = {
  panel: {
    width: '280px',
    height: '100%',
    background: '#f8f9fa',
    borderLeft: '1px solid #dee2e6',
    overflow: 'auto'
  },
  title: {
    margin: 0,
    padding: '16px',
    background: '#343a40',
    color: 'white',
    fontSize: '16px',
    fontWeight: 600
  },
  section: {
    padding: '16px',
    borderBottom: '1px solid #dee2e6'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#495057',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  inputGroup: {
    marginBottom: '10px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#6c757d',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px'
  },
  cabinetName: {
    fontWeight: 600,
    fontSize: '16px',
    marginBottom: '4px'
  },
  cabinetCode: {
    fontSize: '13px',
    color: '#6c757d',
    marginBottom: '8px'
  },
  dimensions: {
    fontSize: '13px',
    color: '#495057',
    marginBottom: '16px',
    padding: '8px',
    background: '#e9ecef',
    borderRadius: '4px',
    textAlign: 'center'
  },
  worktopButton: {
    width: '100%',
    padding: '10px',
    background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '12px',
    fontWeight: 500
  },
  removeButton: {
    width: '100%',
    padding: '10px',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '8px'
  },
  actionButton: {
    width: '100%',
    padding: '10px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  wizardButton: {
    width: '100%',
    padding: '10px',
    background: '#212529',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '8px'
  },
  previewButton: {
    width: '100%',
    padding: '10px',
    background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '8px',
    fontWeight: 500
  },
  clearButton: {
    width: '100%',
    padding: '10px',
    background: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '8px'
  },
  noSelection: {
    padding: '20px',
    textAlign: 'center',
    color: '#868e96',
    fontStyle: 'italic'
  },
  placedList: {
    maxHeight: '200px',
    overflow: 'auto'
  },
  placedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    marginBottom: '4px',
    background: 'white',
    borderRadius: '4px',
    fontSize: '13px'
  },
  removeSmall: {
    width: '22px',
    height: '22px',
    background: '#f8d7da',
    color: '#721c24',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#495057',
    marginBottom: '8px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  rotationControls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  rotateButton: {
    flex: '0 0 auto',
    padding: '8px 12px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.15s',
    whiteSpace: 'nowrap'
  },
  rotationDisplay: {
    flex: '1',
    padding: '8px 10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center',
    background: '#e9ecef',
    fontWeight: 600,
    color: '#495057'
  },
  constraintWarn: {
    marginTop: '8px',
    padding: '8px',
    background: '#fff3cd',
    border: '1px solid #ffeeba',
    color: '#856404',
    borderRadius: '6px',
    fontSize: '12px'
  },
  constraintDetails: {
    marginTop: '8px',
    padding: '8px',
    background: '#f8f9fa',
    border: '1px solid #dee2e6',
    color: '#495057',
    borderRadius: '6px',
    fontSize: '12px'
  },
  constraintButton: {
    width: '100%',
    marginTop: '8px',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #212529',
    background: '#212529',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px'
  },
  saveGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px'
  },
  saveInput: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '13px'
  },
  saveButton: {
    padding: '8px 14px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  loadListButton: {
    width: '100%',
    padding: '8px',
    background: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    marginBottom: '8px'
  },
  savedList: {
    maxHeight: '150px',
    overflow: 'auto',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    marginBottom: '10px'
  },
  savedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: '1px solid #e9ecef',
    cursor: 'pointer',
    transition: 'background 0.15s'
  },
  savedItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  savedName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#212529'
  },
  savedDate: {
    fontSize: '11px',
    color: '#6c757d'
  },
  deleteSmall: {
    width: '22px',
    height: '22px',
    background: '#f8d7da',
    color: '#721c24',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1
  },
  exportGroup: {
    display: 'flex',
    gap: '8px'
  },
  exportButton: {
    flex: 1,
    padding: '8px',
    background: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  importButton: {
    flex: 1,
    padding: '8px',
    background: '#495057',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  }
}
