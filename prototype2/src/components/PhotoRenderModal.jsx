import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { getApiKey as getOpenAIApiKey } from '../ai/OpenAIKitchenAssistant'

export function PhotoRenderModal({ isOpen, onClose }) {
  const placedCabinets = useStore(s => s.placedCabinets)
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const roomHeight = useStore(s => s.roomHeight)

  const [angle, setAngle] = useState('front')
  const [size, setSize] = useState('1536x1024')
  const [quality, setQuality] = useState('medium')
  const [useScreenshot, setUseScreenshot] = useState(true)
  const [useMask, setUseMask] = useState(true)
  const [useOverlay, setUseOverlay] = useState(true)
  const [strictMode, setStrictMode] = useState(true)
  const [layoutExactMode, setLayoutExactMode] = useState(false)
  const [noAppliances, setNoAppliances] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState('')

  const layoutSummary = useMemo(() => {
    const list = placedCabinets.map(c => ({
      id: c.instanceId,
      type: c.type,
      width: c.width,
      height: c.height,
      depth: c.depth,
      position: c.position,
      rotationDeg: Math.round(((c.rotation || 0) * 180) / Math.PI)
    }))
    return JSON.stringify({
      room: { width: roomWidth, depth: roomDepth, height: roomHeight },
      cabinets: list
    }, null, 2)
  }, [placedCabinets, roomWidth, roomDepth, roomHeight])

  const dimensionTable = useMemo(() => {
    const rows = placedCabinets.map((c, i) => {
      const rotDeg = Math.round(((c.rotation || 0) * 180) / Math.PI)
      const isRotated = Math.abs((c.rotation || 0) % Math.PI) > 0.1
      const footprintWidth = isRotated ? c.depth : c.width
      const footprintDepth = isRotated ? c.width : c.depth
      return `${i + 1}. ${c.code || c.name || 'CAB'} | w:${c.width} h:${c.height} d:${c.depth} mm | footprintWidth:${footprintWidth} mm footprintDepth:${footprintDepth} mm | rot:${rotDeg}°`
    })
    return rows.join('\n')
  }, [placedCabinets])

  const wallCounts = useMemo(() => {
    const counts = {
      back: { total: 0, base: 0, wall: 0, tall: 0 },
      left: { total: 0, base: 0, wall: 0, tall: 0 },
      right: { total: 0, base: 0, wall: 0, tall: 0 }
    }
    placedCabinets.forEach(c => {
      const rot = c.rotation || 0
      let wall = 'back'
      if (Math.abs(rot - Math.PI / 2) < 0.1) wall = 'left'
      if (Math.abs(rot + Math.PI / 2) < 0.1) wall = 'right'
      counts[wall].total += 1
      if (c.type === 'wall') counts[wall].wall += 1
      else if (c.type === 'tall') counts[wall].tall += 1
      else counts[wall].base += 1
    })
    return counts
  }, [placedCabinets])

  const getEffectiveAngle = () => angle
  const isEffectiveTop = () => getEffectiveAngle() === 'top'

  useEffect(() => {
    if (layoutExactMode) {
      setUseScreenshot(true)
    }
  }, [layoutExactMode])

  const buildPrompt = () => {
    const effectiveAngle = getEffectiveAngle()
    const angleText = effectiveAngle === 'front'
      ? 'front view'
      : effectiveAngle === 'isometric'
        ? 'isometric 3/4 view'
        : 'top-down view'

    return [
      'Create a photorealistic kitchen render based on the input image.',
      'Do NOT change cabinet positions, sizes, or counts. Preserve geometry exactly.',
      'The number of cabinets must match the layout exactly. No additions or removals.',
      'Cabinet depths (front-to-back) must match the layout footprint exactly. Do NOT shrink or expand depth.',
      effectiveAngle === 'isometric'
        ? 'In isometric view, preserve the front-to-back depth from the layout footprint exactly.'
        : '',
      noAppliances
        ? 'Do NOT replace any cabinet with an appliance. No fridge/oven/dishwasher/sink/cooktop unless clearly visible in the input image.'
        : '',
      noAppliances
        ? 'All tall cabinets are plain cabinetry unless an appliance is explicitly visible in the input image.'
        : '',
      'Do NOT render any text or labels on cabinet fronts.',
      `Camera: ${angleText}.`,
      'Lighting: soft daylight, realistic shadows.',
      'Materials: modern neutral surfaces; you may infer countertop, floor, and wall textures.',
      'Set wall color to complement the cabinet decor and countertop (harmonious, neutral).',
      'Add a few tasteful accessories (e.g., a plant, small bowl, minimal utensils) but keep it minimal.',
      'Keep the exact layout; only improve realism.',
      'The inset layout map is authoritative. Do not add or remove rectangles. Keep empty areas empty.',
      `Cabinet counts by wall (must match exactly): back=${wallCounts.back.total} (base:${wallCounts.back.base}, wall:${wallCounts.back.wall}, tall:${wallCounts.back.tall}), left=${wallCounts.left.total} (base:${wallCounts.left.base}, wall:${wallCounts.left.wall}, tall:${wallCounts.left.tall}), right=${wallCounts.right.total} (base:${wallCounts.right.base}, wall:${wallCounts.right.wall}, tall:${wallCounts.right.tall}).`,
      strictMode ? 'STRICT MODE: Cabinet widths, heights, depths MUST match the dimension table exactly.' : '',
      strictMode ? 'If unsure, do NOT change geometry. Prioritize exact proportions over style.' : '',
      '',
      'LAYOUT SPEC (mm and meters as provided):',
      layoutSummary,
      '',
      'DIMENSION TABLE (exact, mm):',
      dimensionTable
    ].join('\n')
  }

  const buildCabinetRects = () => {
    const roomW = roomWidth / 1000
    const roomD = roomDepth / 1000
    return placedCabinets.map(cab => {
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
      return {
        id: cab.instanceId,
        label: cab.code || cab.name || '',
        x: (minX + roomW / 2) * 1000,
        y: (minZ + roomD / 2) * 1000,
        w: rectW * 1000,
        h: rectD * 1000
      }
    })
  }

  const drawTopDownOverlay = (ctx, w, h) => {
    const rects = buildCabinetRects()
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    rects.forEach((r, i) => {
      const cx = (r.x / roomWidth) * w + (r.w / roomWidth) * w / 2
      const cy = (r.y / roomDepth) * h + (r.h / roomDepth) * h / 2
      ctx.beginPath()
      ctx.arc(cx, cy, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'black'
      ctx.fillText(String(i + 1), cx, cy)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
    })
    ctx.restore()
  }

  const drawOverlay = (ctx, w, h) => {
    if (!useOverlay) return
    if (isEffectiveTop()) {
      drawTopDownOverlay(ctx, w, h)
    }
  }

  const buildMaskBlob = async (w, h) => {
    // mask works reliably for top‑down only
    if (!useMask || !isEffectiveTop()) return null
    const rects = buildCabinetRects()
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    const ctx = mask.getContext('2d')
    // transparent background = editable
    ctx.clearRect(0, 0, w, h)
    // opaque cabinets = preserve
    ctx.fillStyle = 'rgba(255,255,255,1)'
    rects.forEach(r => {
      const x = (r.x / roomWidth) * w
      const y = (r.y / roomDepth) * h
      const rw = (r.w / roomWidth) * w
      const rh = (r.h / roomDepth) * h
      ctx.fillRect(x, y, rw, rh)
    })
    return new Promise(resolve => mask.toBlob(resolve, 'image/png'))
  }

  const captureCanvasBlob = async () => {
    const canvases = Array.from(document.querySelectorAll('canvas'))
    let target = null
    for (const c of canvases) {
      const gl = c.getContext('webgl') || c.getContext('webgl2')
      if (gl) {
        target = c
        break
      }
    }
    if (!target) throw new Error('Nelze najít 3D canvas')

    const [w, h] = size.split('x').map(Number)
    // Počkej na další frame, ať je canvas určitě překreslený
    await new Promise(requestAnimationFrame)

    // Vždy renderuj do offscreen canvasu o zvolené velikosti,
    // aby se maska a image velikost vždy shodovala.
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const ctx = off.getContext('2d')
    ctx.drawImage(target, 0, 0, w, h)
    drawOverlay(ctx, w, h)
    const dataUrl = off.toDataURL('image/png')

    if (!dataUrl || dataUrl.length < 100) {
      throw new Error('Screenshot je prázdný nebo zablokovaný (CORS na texturách).')
    }

    const res = await fetch(dataUrl)
    return await res.blob()
  }

  const handleGenerate = async () => {
    setError('')
    setImageUrl('')
    setIsLoading(true)
    try {
      const apiKey = getOpenAIApiKey()
      const form = new FormData()
      form.append('model', 'gpt-image-1')
      form.append('prompt', buildPrompt())
      form.append('size', size)
      form.append('quality', quality)
      form.append('n', '1')
      form.append('input_fidelity', 'high')

      if (useScreenshot || layoutExactMode) {
        const blob = await captureCanvasBlob()
        form.append('image', blob, 'layout.png')
        const maskBlob = await buildMaskBlob(...size.split('x').map(Number))
        if (maskBlob) {
          form.append('mask', maskBlob, 'mask.png')
        }
      }

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: form
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || response.statusText)
      }

      const data = await response.json()
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) throw new Error('API nevrátil obrázek')
      setImageUrl(`data:image/png;base64,${b64}`)
    } catch (e) {
      setError(e.message || 'Chyba při generování')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Realistický render kuchyně</h3>
            <p style={styles.subtitle}>OpenAI Image API (gpt-image-1)</p>
          </div>
          <button onClick={onClose} style={styles.close}>✕</button>
        </div>

        <div style={styles.body}>
          <div style={styles.controls}>
            <label style={styles.label}>
              Úhel
              <select
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                style={styles.input}
                disabled={layoutExactMode}
              >
                <option value="front">Front</option>
                <option value="isometric">Isometric</option>
                <option value="top">Top‑down</option>
              </select>
            </label>
            <label style={styles.label}>
              Velikost
              <select value={size} onChange={(e) => setSize(e.target.value)} style={styles.input}>
                <option value="1536x1024">1536×1024</option>
                <option value="1024x1024">1024×1024</option>
                <option value="1024x1536">1024×1536</option>
              </select>
            </label>
            <label style={styles.label}>
              Kvalita
              <select value={quality} onChange={(e) => setQuality(e.target.value)} style={styles.input}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={useScreenshot}
                onChange={(e) => setUseScreenshot(e.target.checked)}
                disabled={layoutExactMode}
              />
              Použít screenshot 3D scény (přesnější)
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={useOverlay}
                onChange={(e) => setUseOverlay(e.target.checked)}
              />
              Přidat overlay (top‑down)
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(e) => setStrictMode(e.target.checked)}
              />
              Strict mode (rozměry 1:1)
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={layoutExactMode}
                onChange={(e) => setLayoutExactMode(e.target.checked)}
              />
              Přesné dispoziční (striktní rozměry + půdorys inset)
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={noAppliances}
                onChange={(e) => setNoAppliances(e.target.checked)}
              />
              Zakázat spotřebiče (pokud nejsou na inputu)
            </label>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={useMask}
                onChange={(e) => setUseMask(e.target.checked)}
                disabled={angle !== 'top'}
              />
              Použít masku (top‑down, chrání skříňky)
            </label>
            <button
              onClick={() => {
                const blob = new Blob([buildPrompt()], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'photo-render-prompt.txt'
                a.click()
                URL.revokeObjectURL(url)
              }}
              style={styles.secondary}
            >
              Export prompt
            </button>
            <button
              onClick={async () => {
                try {
                  const blob = await captureCanvasBlob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'photo-render-screenshot.png'
                  a.click()
                  URL.revokeObjectURL(url)
                } catch (e) {
                  setError(e.message || 'Chyba při exportu screenshotu')
                }
              }}
              style={styles.secondary}
            >
              Export screenshot
            </button>
            <button
              onClick={() => {
                const blob = new Blob([layoutSummary], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'photo-render-layout.json'
                a.click()
                URL.revokeObjectURL(url)
              }}
              style={styles.secondary}
            >
              Export layout JSON
            </button>
            <button onClick={handleGenerate} style={styles.primary} disabled={isLoading}>
              {isLoading ? 'Generuji...' : 'Vytvořit foto'}
            </button>
          </div>

          <div style={styles.preview}>
            {error && <div style={styles.error}>Chyba: {error}</div>}
            {!error && !imageUrl && (
              <div style={styles.placeholder}>Zde se zobrazí render</div>
            )}
            {imageUrl && (
              <img src={imageUrl} alt="Render" style={styles.image} />
            )}
          </div>
        </div>
      </div>
    </div>
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
    width: '100%',
    maxWidth: '900px',
    background: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.35)'
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
    border: 'none',
    background: 'transparent',
    fontSize: '18px',
    cursor: 'pointer'
  },
  body: {
    display: 'flex',
    gap: '16px',
    padding: '16px'
  },
  controls: {
    width: '260px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  label: {
    fontSize: '12px',
    color: '#495057',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#495057'
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #ced4da',
    borderRadius: '6px'
  },
  primary: {
    marginTop: '8px',
    padding: '10px 12px',
    background: '#212529',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  secondary: {
    padding: '8px 10px',
    background: '#f1f3f5',
    color: '#343a40',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  preview: {
    flex: 1,
    minHeight: '360px',
    border: '1px dashed #ced4da',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8f9fa'
  },
  placeholder: {
    color: '#868e96',
    fontSize: '12px'
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'block'
  },
  error: {
    padding: '8px 12px',
    background: '#fff5f5',
    border: '1px solid #ffa8a8',
    color: '#c92a2a',
    borderRadius: '6px'
  }
}
