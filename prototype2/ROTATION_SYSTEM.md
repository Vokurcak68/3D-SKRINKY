# 🔄 Systém Rotace Skříněk

**Datum:** 2026-02-06
**Verze:** 1.0
**Status:** ✅ Implementováno

## Přehled

Implementován **inteligentní systém rotace** jednotlivých skříněk s automatickou validací a korekcí pozice.

## Features

### ✅ Inteligentní Rotace
- **Rotace o 90°** ve směru nebo proti směru hodinových ručiček
- **Pivot point** - rotace kolem středu skříňky (ne kolem rohu)
- **Automatická korekce pozice** - skříňka zůstane v místnosti po rotaci
- **Collision detection** - rotace se neprovede při kolizi s jinými skříňkami
- **Boundary validation** - respektuje hranice místnosti

### 🎮 UI Ovládání

#### PropertiesPanel
- **Tlačítko ↶ 90°** - otočí skříňku doleva (CCW)
- **Tlačítko ↷ 90°** - otočí skříňku doprava (CW)
- **Display** - zobrazuje aktuální rotaci (0°, 90°, -90°, 180°)

#### Klávesové zkratky
- **R** - otočí vybranou skříňku doleva (CCW +90°)
- **Shift+R** - otočí vybranou skříňku doprava (CW -90°)
- **Delete/Backspace** - smaže vybranou skříňku

## Implementace

### 1. Store.js - Akce `rotateCabinet()`

```javascript
rotateCabinet: (instanceId, direction = 1) => {
  // direction: +1 = CCW (doleva), -1 = CW (doprava)

  // 1. Vypočítej novou rotaci (±90°)
  // 2. Normalizuj do rozsahu [-π, π]
  // 3. Vypočítej nový pivot point (střed zůstane na místě)
  // 4. Boundary check - clamp do místnosti
  // 5. Collision check - validuj že nedojde ke kolizi
  // 6. Aplikuj rotaci + novou pozici
}
```

**Klíčové vlastnosti:**
- Používá `_spatialGrid.checkCollisions()` pro rychlý collision check
- Používá `_collision.canPlace()` pro boundary validation
- Update spatial grid automaticky
- Logování rotace do konzole

### 2. PropertiesPanel.jsx - UI Komponenty

```jsx
<div style={styles.rotationControls}>
  <button onClick={() => rotateCabinet(id, 1)}>↶ 90°</button>
  <input value={rotation + '°'} readOnly />
  <button onClick={() => rotateCabinet(id, -1)}>↷ 90°</button>
</div>
```

### 3. App.jsx - Klávesové zkratky

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'r' && selectedCabinet) {
      const direction = e.shiftKey ? -1 : 1
      rotateCabinet(selectedCabinet.instanceId, direction)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
}, [selectedCabinet, rotateCabinet])
```

## Rotace podle stěn

### Zadní stěna (rotation = 0°)
- Skříňka směřuje do místnosti (+Z směr)
- Šířka = X rozměr, Hloubka = Z rozměr

### Levá stěna (rotation = +90° = π/2)
- Skříňka otočena doleva (CCW)
- Záda u levé stěny, dvířka doprava
- Šířka ↔ Hloubka prohozené

### Pravá stěna (rotation = -90° = -π/2)
- Skříňka otočena doprava (CW)
- Záda u pravé stěny, dvířka doleva
- Šířka ↔ Hloubka prohozené

## Matematika Rotace

### Pivot Point Calculation
```javascript
// Před rotací
const oldCenterX = x + oldEffectiveW / 2
const oldCenterZ = z + oldEffectiveD / 2

// Po rotaci - střed zůstane na místě
x = oldCenterX - newEffectiveW / 2
z = oldCenterZ - newEffectiveD / 2
```

### Boundary Clamp podle rotace
```javascript
if (rotation === -90°) {
  // Pravá stěna: rozšíření směrem -X a +Z
  x = clamp(x, -roomW/2 + effectiveW, roomW/2)
  z = clamp(z, -roomD/2, roomD/2 - effectiveD)
}
else if (rotation === +90°) {
  // Levá stěna: rozšíření směrem +X a -Z
  x = clamp(x, -roomW/2, roomW/2 - effectiveW)
  z = clamp(z, -roomD/2 + effectiveD, roomD/2)
}
else {
  // Zadní stěna: standardní clamp
  x = clamp(x, -roomW/2, roomW/2 - effectiveW)
  z = clamp(z, -roomD/2, roomD/2 - effectiveD)
}
```

## Validace

### 1. Collision Detection
- **Spatial Grid** - O(1) vyhledání sousedů
- **Y-axis overlap** - kontrola výškového překryvu
- **Rotace respektována** - AABB collision s rotací

### 2. Boundary Check
- **Room boundaries** - skříňka musí být v místnosti
- **Auto-correction** - `CollisionDetector.findNearestValidPosition()`

### 3. Fail-Safe
Pokud rotace není možná:
- Vypíše warning do konzole
- Skříňka zůstane v původní rotaci
- UI nezmrazne

## Výhody implementace

✅ **Uživatelsky přívětivé** - jednoduché tlačítka + klávesy
✅ **Bezpečné** - nemůže dojít k chybným stavům
✅ **Rychlé** - spatial grid optimalizace
✅ **Prediktabilní** - vždy rotace o 90°
✅ **Debugovatelné** - logování do konzole

## Budoucí možnosti

- [ ] Libovolná rotace (např. 45°) - jen pro dekorativní prvky
- [ ] Animace rotace (smooth transition)
- [ ] Undo/Redo support
- [ ] Multi-select rotace (otočit více skříněk najednou)

## Soubory změněny

1. **src/store.js** - nová akce `rotateCabinet()`
2. **src/components/PropertiesPanel.jsx** - UI tlačítka + styly
3. **src/App.jsx** - klávesové zkratky + instrukce
4. **ROTATION_SYSTEM.md** - dokumentace (tento soubor)

## Testování

```bash
cd prototype2
npm run dev
```

**Test scenario:**
1. Umísti skříňku pomocí drag & drop
2. Klikni na ni (vyber)
3. Zmáčkni **R** - měla by se otočit o 90° doleva
4. Zmáčkni **Shift+R** - měla by se otočit o 90° doprava
5. Zkus otočit skříňku u okraje místnosti - měla by zůstat v границах
6. Zkus otočit skříňku blízko jiné - pokud kolize, rotace se neprovede

## Integrace s existujícím systémem

✅ **Placement System** - respektuje rotaci při umístění
✅ **Snap System** - automatická rotace při snap k stěně
✅ **Collision Detector** - validuje rotaci
✅ **Spatial Grid** - update po rotaci
✅ **Cabinet3D** - render respektuje rotaci
✅ **Drag & Drop** - zachovává rotaci během tažení

---

**Autor:** Claude Sonnet 4.5
**Projekt:** 3D Kitchen Designer - Oresi
**Technologie:** React + Three.js + Zustand
