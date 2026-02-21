import React, { useState, useEffect, useCallback } from 'react'
import { RealisticCanvas } from './components/RealisticCanvas'
import { onMessage, broadcastFocusRequest } from './sync/channelSync'

/**
 * Aplikace pro realisticky nahled - bezi v samostatnem okne
 * Prijima stav z hlavniho okna pres BroadcastChannel
 */
export function PreviewApp() {
  const [sceneData, setSceneData] = useState({
    placedCabinets: [],
    selectedInstanceId: null,
    room: { width: 4000, depth: 3000, height: 2600 }
  })
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Listener pro zpravy z hlavniho okna
  useEffect(() => {
    onMessage((message) => {
      if (message.type === 'SCENE_UPDATE') {
        setSceneData({
          placedCabinets: message.data.placedCabinets,
          selectedInstanceId: message.data.selectedCabinet,
          room: message.data.room
        })
        setConnected(true)
        setLastUpdate(new Date().toLocaleTimeString())
      } else if (message.type === 'SELECTION_CHANGE') {
        setSceneData(prev => ({
          ...prev,
          selectedInstanceId: message.data.selectedInstanceId
        }))
      }
    })
  }, [])

  // Kliknuti na skrinku v nahledu -> posle focus request do hlavniho okna
  const handleCabinetClick = useCallback((instanceId) => {
    broadcastFocusRequest(instanceId)
    setSceneData(prev => ({
      ...prev,
      selectedInstanceId: instanceId
    }))
  }, [])

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Realisticky nahled</h1>
        <div style={styles.status}>
          <span style={{
            ...styles.statusDot,
            background: connected ? '#4CAF50' : '#f44336'
          }} />
          {connected ? 'Pripojeno' : 'Cekam na designer...'}
          {lastUpdate && <span style={styles.lastUpdate}>({lastUpdate})</span>}
        </div>
        <div style={styles.stats}>
          {sceneData.placedCabinets.length} skrynek
        </div>
      </header>

      {/* 3D scene */}
      <div style={styles.canvas}>
        {sceneData.placedCabinets.length > 0 ? (
          <RealisticCanvas
            cabinets={sceneData.placedCabinets}
            selectedInstanceId={sceneData.selectedInstanceId}
            room={sceneData.room}
            onCabinetClick={handleCabinetClick}
          />
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🏠</div>
            <h2>Zadne skrinky</h2>
            <p>Pridejte skrinky v hlavnim okne designeru</p>
          </div>
        )}
      </div>

      {/* Footer s ovladanim */}
      <footer style={styles.footer}>
        <span>Otaceni: leve tlacitko | Posun: prave tlacitko | Zoom: kolecko</span>
      </footer>
    </div>
  )
}

const styles = {
  app: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a1a',
    color: 'white'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  lastUpdate: {
    opacity: 0.7,
    fontSize: '11px'
  },
  stats: {
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '12px',
    fontSize: '12px'
  },
  canvas: {
    flex: 1,
    position: 'relative'
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  footer: {
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.5)',
    fontSize: '12px',
    color: '#888',
    textAlign: 'center'
  }
}
