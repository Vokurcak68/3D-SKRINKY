import { useState } from 'react'
import { WallComposer } from './WallComposer'

// Vyjížděcí 1D composer přes scénu
export function WallComposerDrawer() {
  const [open, setOpen] = useState(true)

  return (
    <div style={styles.wrapper}>
      <button
        onClick={() => setOpen(!open)}
        style={styles.toggle}
        title={open ? 'Skrýt 1D pás' : 'Zobrazit 1D pás'}
      >
        {open ? '▾ 1D STĚNA' : '▸ 1D STĚNA'}
      </button>

      <div style={{ ...styles.drawer, height: open ? '160px' : '0px' }}>
        <div style={styles.drawerInner}>
          <WallComposer />
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    position: 'absolute',
    left: '16px',
    right: '16px',
    bottom: '16px',
    zIndex: 200,
    pointerEvents: 'auto'
  },
  toggle: {
    background: '#212529',
    color: 'white',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.5px'
  },
  drawer: {
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid #dee2e6',
    borderTop: 'none',
    borderRadius: '0 8px 8px 8px',
    overflow: 'hidden',
    transition: 'height 0.2s ease'
  },
  drawerInner: {
    height: '160px',
    overflow: 'auto'
  }
}
