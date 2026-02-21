import * as THREE from 'three'

/**
 * TextureManager - Singleton pro spravovani textur a materialu
 * Textury se vytvori jednou pri startu a pote se pouzivaji z cache
 */
class TextureManager {
  constructor() {
    this.textures = new Map()
    this.materials = new Map()
    this.decorTextures = new Map()  // Cache pro textury dekoru
    this.decorMaterials = new Map()  // Cache pro materialy dekoru
    this.initialized = false
    this.textureLoader = new THREE.TextureLoader()
    this.textureLoader.setCrossOrigin('anonymous')
    this.loadingDecors = new Map()  // Promise cache pro paralelni loading
  }

  /**
   * Inicializuje vsechny textury - volat jednou pri startu aplikace
   */
  async initialize() {
    if (this.initialized) return

    // Vytvor vsechny textury
    this.createWoodTexture('lightOak', '#d4c4a8', '#a89070', 2)
    this.createWoodTexture('walnut', '#5c4033', '#3d2817', 1.5)
    this.createWoodTexture('darkOak', '#4a3728', '#2d1f15', 2)

    // Vytvor vsechny materialy
    this.createMaterials()

    this.initialized = true
    console.log('TextureManager: Initialized with', this.textures.size, 'textures and', this.materials.size, 'materials')
  }

  /**
   * Vytvori drevenou texturu na canvas
   */
  createWoodTexture(name, baseColor, grainColor, scale = 1) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    // Zakladni barva
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, 512, 512)

    // Drevena vlakna - optimalizovano na 100 iteraci misto 200
    ctx.strokeStyle = grainColor
    ctx.lineWidth = 1

    for (let i = 0; i < 100; i++) {
      const y = Math.random() * 512
      const length = 100 + Math.random() * 400
      const startX = Math.random() * 512
      ctx.globalAlpha = 0.1 + Math.random() * 0.15

      ctx.beginPath()
      ctx.moveTo(startX, y)

      // Vlnita cara - zjednoduseno
      for (let x = startX; x < startX + length; x += 15) {
        const wave = Math.sin(x * 0.02) * 3
        ctx.lineTo(x, y + wave)
      }
      ctx.stroke()
    }

    // Suky - pouze 2
    ctx.globalAlpha = 0.08
    for (let i = 0; i < 2; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = 5 + Math.random() * 15

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, grainColor)
      gradient.addColorStop(1, 'transparent')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(scale, scale)

    this.textures.set(name, texture)
    return texture
  }

  /**
   * Vytvori vsechny materialy
   */
  createMaterials() {
    // Drevene korpusy - svetly dub
    this.materials.set('lightOak', new THREE.MeshStandardMaterial({
      map: this.textures.get('lightOak'),
      roughness: 0.75,
      metalness: 0.0,
      bumpScale: 0.002
    }))

    // Bila leskla dvirka
    this.materials.set('whiteFront', new THREE.MeshStandardMaterial({
      color: '#fafafa',
      roughness: 0.15,
      metalness: 0.02,
      envMapIntensity: 0.5
    }))

    // Antracitova dvirka
    this.materials.set('anthraciteFront', new THREE.MeshStandardMaterial({
      color: '#3a3a3a',
      roughness: 0.2,
      metalness: 0.05,
      envMapIntensity: 0.6
    }))

    // Drevena dvirka - tmavy orech
    this.materials.set('walnutFront', new THREE.MeshStandardMaterial({
      map: this.textures.get('walnut'),
      roughness: 0.35,
      metalness: 0.02
    }))

    // Nerezove madlo
    this.materials.set('stainlessHandle', new THREE.MeshStandardMaterial({
      color: '#c0c0c0',
      roughness: 0.15,
      metalness: 0.9,
      envMapIntensity: 1.0
    }))

    // Cerne madlo
    this.materials.set('blackHandle', new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      roughness: 0.3,
      metalness: 0.7
    }))

    // Sokl (cerna)
    this.materials.set('plinth', new THREE.MeshStandardMaterial({
      color: '#2a2a2a',
      roughness: 0.8,
      metalness: 0.1
    }))

    // ABS hranovani - svetle seda (pro hrany dvirek)
    this.materials.set('edgeBanding', new THREE.MeshStandardMaterial({
      color: '#e8e8e8',
      roughness: 0.4,
      metalness: 0.02
    }))

    // ABS hranovani - tmave (pro tmave dekory)
    this.materials.set('edgeBandingDark', new THREE.MeshStandardMaterial({
      color: '#4a4a4a',
      roughness: 0.4,
      metalness: 0.02
    }))
  }

  /**
   * Ziska material podle jmena
   */
  getMaterial(name) {
    if (!this.initialized) {
      console.warn('TextureManager: Not initialized yet!')
    }
    return this.materials.get(name)
  }

  /**
   * Ziska texturu podle jmena
   */
  getTexture(name) {
    return this.textures.get(name)
  }

  /**
   * Vytvori NOVY material pro vybranou/tazenou skrinku
   * Tyto materialy se nevkladaji do cache protoze jsou docasne
   */
  createHighlightMaterial(type) {
    switch(type) {
      case 'selected':
        return new THREE.MeshStandardMaterial({
          color: '#4a90d9',
          roughness: 0.5,
          metalness: 0.1,
          emissive: '#1a4a80',
          emissiveIntensity: 0.1
        })
      case 'dragging':
        return new THREE.MeshStandardMaterial({
          color: '#6ab0f3',
          roughness: 0.4,
          metalness: 0.1,
          emissive: '#2a6ab0',
          emissiveIntensity: 0.15,
          transparent: true,
          opacity: 0.9
        })
      default:
        return this.getMaterial('lightOak')
    }
  }

  /**
   * Nacte texturu dekoru z URL (s cachovanim)
   * @param {string} decorId - ID dekoru
   * @param {string} imageUrl - URL obrazku
   * @returns {Promise<THREE.Texture>}
   */
  async loadDecorTexture(decorId, imageUrl) {
    // Vrat z cache pokud existuje
    if (this.decorTextures.has(decorId)) {
      return this.decorTextures.get(decorId)
    }

    // Pokud se prave nacita, vrat stejnou promise
    if (this.loadingDecors.has(decorId)) {
      return this.loadingDecors.get(decorId)
    }

    // Nacti texturu
    const loadPromise = new Promise((resolve, reject) => {
      this.textureLoader.load(
        imageUrl,
        (texture) => {
          texture.wrapS = THREE.ClampToEdgeWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          texture.repeat.set(1, 1)
          texture.colorSpace = THREE.SRGBColorSpace

          this.decorTextures.set(decorId, texture)
          this.loadingDecors.delete(decorId)
          resolve(texture)
        },
        undefined,
        (error) => {
          console.warn(`TextureManager: Failed to load decor ${decorId}:`, error)
          this.loadingDecors.delete(decorId)
          // Vytvor fallback texturu
          const fallback = this.createFallbackTexture(decorId)
          this.decorTextures.set(decorId, fallback)
          resolve(fallback)
        }
      )
    })

    this.loadingDecors.set(decorId, loadPromise)
    return loadPromise
  }

  /**
   * Vytvori fallback texturu pokud se nepodari nacist z URL
   */
  createFallbackTexture(decorId) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // Generuj barvu z decorId hashe
    let hash = 0
    for (let i = 0; i < decorId.length; i++) {
      hash = decorId.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash % 360)

    ctx.fillStyle = `hsl(${hue}, 30%, 70%)`
    ctx.fillRect(0, 0, 256, 256)

    // Pridej jemny vzor
    ctx.fillStyle = `hsl(${hue}, 25%, 65%)`
    for (let i = 0; i < 20; i++) {
      const x = (hash * (i + 1)) % 256
      const y = (hash * (i + 7)) % 256
      ctx.fillRect(x, y, 30, 3)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.repeat.set(1, 1)
    return texture
  }

  /**
   * Ziska material dekoru (s lazy loadingem textury)
   * @param {string} decorId - ID dekoru
   * @param {object} decorData - Data dekoru (name, imageUrl, type)
   * @param {string} usage - 'front', 'body', nebo 'countertop'
   * @returns {THREE.Material}
   */
  getDecorMaterial(decorId, decorData, usage = 'front') {
    const cacheKey = `${decorId}_${usage}`

    // Vrat z cache
    if (this.decorMaterials.has(cacheKey)) {
      return this.decorMaterials.get(cacheKey)
    }

    // Vytvor material s placeholder barvou
    const material = new THREE.MeshStandardMaterial({
      color: '#cccccc',
      roughness: usage === 'front' ? 0.2 : 0.6,
      metalness: decorData?.type === 'metal' ? 0.8 : 0.02,
      envMapIntensity: usage === 'front' ? 0.5 : 0.3
    })

    // Cache material
    this.decorMaterials.set(cacheKey, material)

    // Nacti texturu asynchronne a aktualizuj material
    if (decorData?.imageUrl) {
      this.loadDecorTexture(decorId, decorData.imageUrl).then(texture => {
        material.map = texture
        material.needsUpdate = true
      })
    }

    return material
  }

  /**
   * Prednacte dekory pro rychlejsi zobrazeni
   * @param {Array} decors - Pole dekor objektu s imageUrl
   */
  async preloadDecors(decors) {
    const promises = decors.map(decor =>
      this.loadDecorTexture(decor.id, decor.imageUrl)
    )
    await Promise.all(promises)
    console.log(`TextureManager: Preloaded ${decors.length} decor textures`)
  }

  /**
   * Vycisti cache dekoru (pro uvolneni pameti)
   */
  clearDecorCache() {
    this.decorTextures.forEach(texture => texture.dispose())
    this.decorMaterials.forEach(material => material.dispose())
    this.decorTextures.clear()
    this.decorMaterials.clear()
    this.loadingDecors.clear()
  }
}

// Singleton instance
export const textureManager = new TextureManager()
