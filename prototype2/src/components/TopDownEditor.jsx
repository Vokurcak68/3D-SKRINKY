import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'

// Jednoduchý 2D top‑down editor
export function TopDownEditor() {
  const svgRef = useRef(null)
  const placedCabinets = useStore(s => s.placedCabinets)
  const selectedCabinet = useStore(s => s.selectedCabinet)
  const selectCabinet = useStore(s => s.selectCabinet)
  const updateCabinetPosition = useStore(s => s.updateCabinetPosition)
  const rotateCabinet = useStore(s => s.rotateCabinet)
  const snapPosition = useStore(s => s.snapPosition)
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const roomFeatures = useStore(s => s.roomFeatures)

  const [dragging, setDragging] = useState(null)
  const [pxPerMm, setPxPerMm] = useState(0.2)

  const roomW = roomWidth / 1000
  const roomD = roomDepth / 1000

  const toRect = (cab) => {
    const rot = cab.rotation || 0
    const w = (cab.width || 600) / 1000
    const d = (cab.depth || 560) / 1000

    let minX = cab.position[0]
    let minZ = cab.position[2]
    let rectW = w
    let rectD = d

    if (Math.abs(rot - Math.PI / 2) < 0.1) {
      minX = cab.position[0]
      minZ = cab.position[2] - w
      rectW = d
      rectD = w
    } else if (Math.abs(rot + Math.PI / 2) < 0.1) {
      minX = cab.position[0] - d
      minZ = cab.position[2]
      rectW = d
      rectD = w
    }

    const mmX = (minX + roomW / 2) * 1000
    const mmZ = (minZ + roomD / 2) * 1000

    return {
      id: cab.instanceId,
      cab,
      x: mmX,
      y: mmZ,
      w: rectW * 1000,
      h: rectD * 1000
    }
  }

  const rectangles = useMemo(
    () => placedCabinets.map(toRect),
    [placedCabinets, roomW, roomD]
  )

  const overlapRects = useMemo(() => {
    const baseRects = rectangles.filter(r => r.cab.type !== 'wall')
    const wallRects = rectangles.filter(r => r.cab.type === 'wall')
    const overlaps = []
    for (const b of baseRects) {
      for (const w of wallRects) {
        const x1 = Math.max(b.x, w.x)
        const y1 = Math.max(b.y, w.y)
        const x2 = Math.min(b.x + b.w, w.x + w.w)
        const y2 = Math.min(b.y + b.h, w.y + w.h)
        if (x2 - x1 > 1 && y2 - y1 > 1) {
          overlaps.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
        }
      }
    }
    return overlaps
  }, [rectangles])

  const getMouseMM = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width * roomWidth
    const y = (e.clientY - rect.top) / rect.height * roomDepth
    return { x, y }
  }

  const handleMouseDown = (e, rect) => {
    e.stopPropagation()
    selectCabinet(rect.cab)
    const mouse = getMouseMM(e)
    setDragging({
      id: rect.id,
      offsetX: mouse.x - rect.x,
      offsetY: mouse.y - rect.y
    })
  }

  const handleMouseMove = (e) => {
    if (!dragging) return
    const rect = rectangles.find(r => r.id === dragging.id)
    if (!rect) return

    const mouse = getMouseMM(e)
    let newX = mouse.x - dragging.offsetX
    let newY = mouse.y - dragging.offsetY

    // Clamp do místnosti
    newX = Math.max(0, Math.min(roomWidth - rect.w, newX))
    newY = Math.max(0, Math.min(roomDepth - rect.h, newY))

    // Převod na world
    const rot = rect.cab.rotation || 0
    const w = (rect.cab.width || 600) / 1000
    const d = (rect.cab.depth || 560) / 1000
    const minX = (newX / 1000) - roomW / 2
    const minZ = (newY / 1000) - roomD / 2
    let posX = minX
    let posZ = minZ

    if (Math.abs(rot - Math.PI / 2) < 0.1) {
      posX = minX
      posZ = minZ + w
    } else if (Math.abs(rot + Math.PI / 2) < 0.1) {
      posX = minX + d
      posZ = minZ
    }

    const snapped = snapPosition(
      posX,
      rect.cab.position[1],
      posZ,
      rect.cab.width || 600,
      rect.cab.depth || 560,
      rect.cab.type,
      rect.cab.instanceId,
      rot
    )

    updateCabinetPosition(rect.cab.instanceId, snapped.position)
  }

  const handleMouseUp = () => {
    setDragging(null)
  }

  useEffect(() => {
    const updateScale = () => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const sx = rect.width / roomWidth
      const sy = rect.height / roomDepth
      const avg = (sx + sy) / 2
      if (avg > 0) setPxPerMm(avg)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [roomWidth, roomDepth])

  const pxToMm = (px) => px / Math.max(pxPerMm, 0.0001)

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>2D Top‑Down Editor</span>
        <span style={styles.subtitle}>{roomWidth} × {roomDepth} mm</span>
      </div>
      <div style={styles.tools}>
        <button
          style={styles.toolButton}
          onClick={() => {
            if (!selectedCabinet) return
            rotateCabinet(selectedCabinet.instanceId, 1)
          }}
        >
          ⟲ 90°
        </button>
        <button
          style={styles.toolButton}
          onClick={() => {
            if (!selectedCabinet) return
            rotateCabinet(selectedCabinet.instanceId, -1)
          }}
        >
          ⟳ 90°
        </button>
        {selectedCabinet && (
          <span style={styles.toolHint}>
            {selectedCabinet.name} ({selectedCabinet.width}×{selectedCabinet.depth})
          </span>
        )}
      </div>
      <div style={styles.main}>
        <div style={styles.canvas}>
          <svg
            ref={svgRef}
            viewBox={`${-200} ${-160} ${roomWidth + 300} ${roomDepth + 300}`}
            style={styles.svg}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseDown={() => selectCabinet(null)}
          >
            <defs>
              <marker
                id="dimArrow"
                markerWidth={pxToMm(24)}
                markerHeight={pxToMm(24)}
                refX="10"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
                viewBox="0 0 10 10"
              >
                <path d="M0,5 L10,0 L10,10 Z" fill="#212529" />
              </marker>
              <marker
                id="dimArrowFlip"
                markerWidth={pxToMm(24)}
                markerHeight={pxToMm(24)}
                refX="0"
                refY="5"
                orient="auto"
                markerUnits="userSpaceOnUse"
                viewBox="0 0 10 10"
              >
                <path d="M10,5 L0,0 L0,10 Z" fill="#212529" />
              </marker>
              <pattern id="hatchOverlap" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#5c7cfa" strokeWidth="2" />
              </pattern>
            </defs>
            {/* Grid */}
            {Array.from({ length: Math.floor(roomWidth / 250) }).map((_, i) => {
              const x = i * 250
              return <line key={`gx-${i}`} x1={x} y1="0" x2={x} y2={roomDepth} stroke="#f1f3f5" />
            })}
            {Array.from({ length: Math.floor(roomDepth / 250) }).map((_, i) => {
              const y = i * 250
              return <line key={`gy-${i}`} x1="0" y1={y} x2={roomWidth} y2={y} stroke="#f1f3f5" />
            })}
            <rect x="0" y="0" width={roomWidth} height={roomDepth} fill="#f8f9fa" stroke="#adb5bd" />
            {/* Room dimensions (technical) */}
            <line x1="0" y1={-pxToMm(70)} x2={roomWidth} y2={-pxToMm(70)} stroke="#212529" strokeWidth={pxToMm(2)} markerStart="url(#dimArrowFlip)" markerEnd="url(#dimArrow)" />
            <line x1="0" y1={-pxToMm(40)} x2="0" y2="0" stroke="#212529" strokeWidth={pxToMm(2)} />
            <line x1={roomWidth} y1={-pxToMm(40)} x2={roomWidth} y2="0" stroke="#212529" strokeWidth={pxToMm(2)} />
            <text
              x={roomWidth / 2 - pxToMm(30)}
              y={-pxToMm(84)}
              fontSize={pxToMm(16)}
              fill="#212529"
              stroke="#ffffff"
              strokeWidth={pxToMm(2)}
              paintOrder="stroke"
            >
              {roomWidth} mm
            </text>

            <line x1={-pxToMm(70)} y1="0" x2={-pxToMm(70)} y2={roomDepth} stroke="#212529" strokeWidth={pxToMm(2)} markerStart="url(#dimArrowFlip)" markerEnd="url(#dimArrow)" />
            <line x1={-pxToMm(40)} y1="0" x2="0" y2="0" stroke="#212529" strokeWidth={pxToMm(2)} />
            <line x1={-pxToMm(40)} y1={roomDepth} x2="0" y2={roomDepth} stroke="#212529" strokeWidth={pxToMm(2)} />
            <text
              x={-pxToMm(140)}
              y={roomDepth / 2}
              fontSize={pxToMm(16)}
              fill="#212529"
              stroke="#ffffff"
              strokeWidth={pxToMm(2)}
              paintOrder="stroke"
            >
              {roomDepth} mm
            </text>
            {/* Axis ticks */}
            {Array.from({ length: Math.floor(roomWidth / 500) }).map((_, i) => {
              const x = i * 500
              return <line key={`x-${i}`} x1={x} y1="0" x2={x} y2="12" stroke="#ced4da" />
            })}
            {Array.from({ length: Math.floor(roomDepth / 500) }).map((_, i) => {
              const y = i * 500
              return <line key={`y-${i}`} x1="0" y1={y} x2="12" y2={y} stroke="#ced4da" />
            })}
            {/* Doors */}
            {roomFeatures.doors.map((d, i) => {
              const line = wallLine(d.wall, d.start, d.end, roomWidth, roomDepth)
              return <line key={`door-${i}`} {...line} stroke="#e8590c" strokeWidth="6" />
            })}
            {/* Windows */}
            {roomFeatures.windows.map((w, i) => {
              const line = wallLine(w.wall, w.start, w.end, roomWidth, roomDepth)
              return <line key={`win-${i}`} {...line} stroke="#228be6" strokeWidth="6" />
            })}
            {/* Overlaps: base under wall (hatched) */}
            {overlapRects.map((o, i) => (
              <rect
                key={`overlap-${i}`}
                x={o.x}
                y={o.y}
                width={o.w}
                height={o.h}
                fill="url(#hatchOverlap)"
                opacity="0.7"
              />
            ))}
            {rectangles.map(r => (
              <g key={r.id}>
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={selectedCabinet?.instanceId === r.id
                  ? '#4dabf7'
                  : (r.cab.type === 'wall' ? 'rgba(255,214,165,0.6)' : '#ced4da')}
                stroke={selectedCabinet?.instanceId === r.id
                  ? '#1c7ed6'
                  : (r.cab.type === 'wall' ? '#f08c00' : '#868e96')}
                strokeWidth="4"
                strokeDasharray={r.cab.type === 'wall' ? '8 4' : '0'}
                onMouseDown={(e) => handleMouseDown(e, r)}
                />
                <text
                  x={r.x + 6}
                  y={r.y + 14}
                  fontSize="10"
                  fill="#212529"
                >
                  {r.cab.width}
                </text>
                {selectedCabinet?.instanceId === r.id && (
                  <>
                    {/* Cabinet dimensions (technical) */}
                    <line x1={r.x} y1={r.y - pxToMm(36)} x2={r.x + r.w} y2={r.y - pxToMm(36)} stroke="#212529" strokeWidth={pxToMm(2)} markerStart="url(#dimArrowFlip)" markerEnd="url(#dimArrow)" />
                    <line x1={r.x} y1={r.y - pxToMm(16)} x2={r.x} y2={r.y} stroke="#212529" strokeWidth={pxToMm(2)} />
                    <line x1={r.x + r.w} y1={r.y - pxToMm(16)} x2={r.x + r.w} y2={r.y} stroke="#212529" strokeWidth={pxToMm(2)} />
                    <text
                      x={r.x + r.w / 2 - pxToMm(22)}
                      y={r.y - pxToMm(50)}
                      fontSize={pxToMm(14)}
                      fill="#212529"
                      stroke="#ffffff"
                      strokeWidth={pxToMm(2)}
                      paintOrder="stroke"
                    >
                      {Math.round(r.w)} mm
                    </text>

                    <line x1={r.x - pxToMm(36)} y1={r.y} x2={r.x - pxToMm(36)} y2={r.y + r.h} stroke="#212529" strokeWidth={pxToMm(2)} markerStart="url(#dimArrowFlip)" markerEnd="url(#dimArrow)" />
                    <line x1={r.x - pxToMm(16)} y1={r.y} x2={r.x} y2={r.y} stroke="#212529" strokeWidth={pxToMm(2)} />
                    <line x1={r.x - pxToMm(16)} y1={r.y + r.h} x2={r.x} y2={r.y + r.h} stroke="#212529" strokeWidth={pxToMm(2)} />
                    <text
                      x={r.x - pxToMm(80)}
                      y={r.y + r.h / 2}
                      fontSize={pxToMm(14)}
                      fill="#212529"
                      stroke="#ffffff"
                      strokeWidth={pxToMm(2)}
                      paintOrder="stroke"
                    >
                      {Math.round(r.h)} mm
                    </text>
                  </>
                )}
              </g>
            ))}
            {/* Labels overlay (always on top) */}
            {rectangles.map(r => {
              const label = formatLabel(r.cab.name || r.cab.code)
              const cx = r.x + r.w / 2
              const cy = r.y + r.h / 2
              const isWall = r.cab.type === 'wall'
              const labelOffset = isWall ? -pxToMm(26) : 0
              const fontSize = pxToMm(20)
              const rot = r.cab.rotation || 0
              const isLeftWall = Math.abs(rot - Math.PI / 2) < 0.1
              const isRightWall = Math.abs(rot + Math.PI / 2) < 0.1
              const isSideWall = isLeftWall || isRightWall
              let labelRotation = isWall
                ? (isSideWall ? 0 : 90)
                : (isSideWall ? ((rot * 180) / Math.PI) : 0)
              if (isLeftWall && !isWall) labelRotation += 180
              if (isRightWall && !isWall) labelRotation += 180
              if (isLeftWall && isWall) labelRotation = 0
              while (labelRotation > 180) labelRotation -= 360
              while (labelRotation < -180) labelRotation += 360
              const edgePad = pxToMm(8)
              const labelX = isWall
                ? cx
                : (isLeftWall ? (r.x + r.w - edgePad) : (isRightWall ? (r.x + edgePad) : cx))
              const labelY = isWall
                ? (cy + labelOffset)
                : (isSideWall ? cy : (r.y + r.h - edgePad))
              const anchor = 'middle'
              const labelTransform = `rotate(${labelRotation} ${labelX} ${labelY})`
              return (
                <g
                  key={`label-${r.id}`}
                  pointerEvents="none"
                  transform={labelTransform}
                >
                  <text
                    x={labelX}
                    y={labelY}
                    fontSize={fontSize}
                    fill="#212529"
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    stroke="#ffffff"
                    strokeWidth={pxToMm(2)}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div style={styles.sidePanel}>
          {selectedCabinet ? (
            <>
              <div style={styles.sideTitle}>Vybraná skříňka</div>
              <div style={styles.sideRow}>Název: {selectedCabinet.name}</div>
              <div style={styles.sideRow}>Rozměry: {selectedCabinet.width}×{selectedCabinet.height}×{selectedCabinet.depth}</div>
              <div style={styles.sideRow}>Typ: {selectedCabinet.type}</div>
              <div style={styles.sideRow}>
                X (m):
                <input
                  type="number"
                  value={selectedCabinet.position[0].toFixed(2)}
                  onChange={(e) => updateCabinetPosition(
                    selectedCabinet.instanceId,
                    [+e.target.value, selectedCabinet.position[1], selectedCabinet.position[2]]
                  )}
                  style={styles.sideInput}
                  step={0.1}
                />
              </div>
              <div style={styles.sideRow}>
                Z (m):
                <input
                  type="number"
                  value={selectedCabinet.position[2].toFixed(2)}
                  onChange={(e) => updateCabinetPosition(
                    selectedCabinet.instanceId,
                    [selectedCabinet.position[0], selectedCabinet.position[1], +e.target.value]
                  )}
                  style={styles.sideInput}
                  step={0.1}
                />
              </div>
            </>
          ) : (
            <div style={styles.sideEmpty}>Vyber skříňku v 2D</div>
          )}
        </div>
      </div>
      <div style={styles.hint}>Tahej skříňky v 2D, snap funguje i zde. Klik pro výběr, tlačítka pro rotaci.</div>
    </div>
  )
}

function wallLine(wall, start, end, roomW, roomD) {
  if (wall === 'back') {
    return { x1: start, y1: 0, x2: end, y2: 0 }
  }
  if (wall === 'left') {
    return { x1: 0, y1: start, x2: 0, y2: end }
  }
  return { x1: roomW, y1: start, x2: roomW, y2: end }
}

function formatLabel(value) {
  const text = value || ''
  if (text.length <= 18) return text
  return `${text.slice(0, 18)}…`
}

function getLabelRotation(rotationRad = 0) {
  let deg = (rotationRad * 180) / Math.PI
  let angle = deg - 90 // label o 90° proti rotaci skříňky
  while (angle > 180) angle -= 360
  while (angle < -180) angle += 360
  if (angle > 90) angle -= 180
  if (angle < -90) angle += 180
  return angle
}

const styles = {
  wrapper: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRight: '1px solid #dee2e6'
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '12px',
    fontWeight: 700
  },
  subtitle: {
    fontSize: '11px',
    color: '#6c757d'
  },
  tools: {
    padding: '6px 12px',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  toolButton: {
    border: '1px solid #ced4da',
    background: 'white',
    padding: '4px 8px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  toolHint: {
    fontSize: '11px',
    color: '#495057'
  },
  main: {
    flex: 1,
    display: 'flex',
    minHeight: 0
  },
  canvas: {
    flex: 1,
    position: 'relative'
  },
  svg: {
    width: '100%',
    height: '100%',
    display: 'block'
  },
  hint: {
    padding: '6px 12px',
    borderTop: '1px solid #e9ecef',
    fontSize: '11px',
    color: '#6c757d'
  },
  sidePanel: {
    width: '220px',
    borderLeft: '1px solid #e9ecef',
    background: '#f8f9fa',
    padding: '8px 12px'
  },
  sideTitle: {
    fontSize: '12px',
    fontWeight: 700,
    marginBottom: '6px'
  },
  sideRow: {
    fontSize: '11px',
    marginBottom: '6px',
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  sideInput: {
    width: '80px',
    padding: '2px 4px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '11px'
  },
  sideEmpty: {
    fontSize: '11px',
    color: '#868e96'
  }
}
