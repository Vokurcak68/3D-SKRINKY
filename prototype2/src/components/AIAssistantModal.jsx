import { useState, useRef, useEffect } from 'react'
import { ClaudeKitchenAssistant, getApiKey as getClaudeApiKey, clearApiKey as clearClaudeApiKey } from '../ai/ClaudeKitchenAssistant.js'
import { OpenAIKitchenAssistant, getApiKey as getOpenAIApiKey, clearApiKey as clearOpenAIApiKey } from '../ai/OpenAIKitchenAssistant.js'
import { SequenceLayoutGenerator } from '../ai/SequenceLayoutGenerator.js'
import { PositionBasedLayoutGenerator } from '../ai/PositionBasedLayoutGenerator.js'
import { useStore } from '../store'

/**
 * AIAssistantModal - Chat interface pro AI Kitchen Designer
 */
export function AIAssistantModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [assistant, setAssistant] = useState(null)
  const [generatedDesign, setGeneratedDesign] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 })
  const [isDraggingModal, setIsDraggingModal] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // AI Provider selection: 'openai' (default) | 'claude'
  const [aiProvider, setAiProvider] = useState('openai')

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Store
  const catalog = useStore(s => s.catalog)
  const roomWidth = useStore(s => s.roomWidth)
  const roomDepth = useStore(s => s.roomDepth)
  const roomHeight = useStore(s => s.roomHeight)
  const clearAllCabinets = useStore(s => s.clearAllCabinets)
  const addCabinetAtPosition = useStore(s => s.addCabinetAtPosition)
  const applyCabinetLayoutExact = useStore(s => s.applyCabinetLayoutExact)

  // Inicializace asistenta při otevření nebo změně providera
  useEffect(() => {
    if (isOpen && !assistant) {
      initializeAssistant()
    }
  }, [isOpen, aiProvider])

  // Auto-scroll na poslední zprávu
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input po zaslání zprávy
  useEffect(() => {
    if (!isLoading && isOpen) {
      inputRef.current?.focus()
    }
  }, [isLoading, isOpen])

  useEffect(() => {
    if (isOpen) {
      setModalPos({ x: 0, y: 0 })
    }
  }, [isOpen])

  useEffect(() => {
    if (!isDraggingModal) return

    const handleMove = (e) => {
      setModalPos({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      })
    }

    const handleUp = () => {
      setIsDraggingModal(false)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDraggingModal])

  /**
   * Inicializace AI asistenta
   */
  const initializeAssistant = async () => {
    try {
      let apiKey
      let ass

      if (aiProvider === 'openai') {
        apiKey = getOpenAIApiKey()
        ass = new OpenAIKitchenAssistant(apiKey, catalog)
      } else {
        apiKey = getClaudeApiKey()
        ass = new ClaudeKitchenAssistant(apiKey, catalog)
      }

      setIsLoading(true)
      const initialMessage = await ass.startConversation({
        width: roomWidth,
        depth: roomDepth,
        height: roomHeight
      })

      setAssistant(ass)
      setMessages([
        {
          role: 'assistant',
          content: initialMessage,
          timestamp: Date.now()
        }
      ])
    } catch (error) {
      console.error('Failed to initialize assistant:', error)
      const providerUrl = aiProvider === 'openai'
        ? 'https://platform.openai.com/api-keys'
        : 'https://console.anthropic.com/'
      setMessages([
        {
          role: 'system',
          content: `Chyba při inicializaci AI asistenta (${aiProvider}): ${error.message}\n\nPokud nemáš API klíč, získej ho na: ${providerUrl}`,
          timestamp: Date.now()
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Odeslání zprávy od uživatele
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !assistant) return

    const userMessage = inputValue.trim()
    setInputValue('')

    // Přidej user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }])

    setIsLoading(true)

    try {
      const response = await assistant.sendMessage(userMessage)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      }])
    } catch (error) {
      console.error('Message error:', error)
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Chyba: ${error.message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Quick Test - přeskočí dialog a rovnou použije předpřipravený návrh
   * Používá REÁLNÝ výstup z OpenAI (z console logu) pro rychlé testování
   */
  const handleQuickTest = async () => {
    setMessages([
      { role: 'system', content: '⚡ Quick Test Mode - načítám předpřipravený návrh...', timestamp: Date.now() }
    ])

    // MOCK design - reálný výstup z OpenAI (zkopírováno z console logu)
    const mockDesign = {
      "summary": "Moderní L-kuchyně s dřevodekor dvířky a dřevěnou pracovní deskou, vybavená kvalitními spotřebiči a LED osvětlením, optimalizovaná pro čtyřčlennou domácnost.",
      "shape": "L",
      "totalPrice": 185000,
      "roomDimensions": {
        "width": 4000,
        "depth": 3000,
        "height": 2600
      },
      "walls": {
        "back": {
          "wallName": "Zadní stěna",
          "wallLength": 4000,
          "base_sequence": ["storage-600", "dishwasher-600", "sink-800", "cooktop-600", "storage-600"],
          "base_details": [
            {
              "module": "storage-600",
              "type": "storage",
              "width": 600,
              "purpose": "Úložná skříňka pro nádobí a potraviny",
              "position": "Levý začátek linky",
              "absolutePosition": {
                "fromLeft": 0,
                "fromRight": 3400,
                "wall": "back",
                "order": 1
              },
              "features": ["3x zásuvka", "tichý dojezd"],
              "estimatedPrice": 12000
            },
            {
              "module": "dishwasher-600",
              "type": "dishwasher",
              "width": 600,
              "purpose": "Prostor pro vestavnou myčku nádobí (60cm)",
              "position": "Vedle úložné skříňky, vlevo od dřezu",
              "absolutePosition": {
                "fromLeft": 600,
                "fromRight": 2800,
                "wall": "back",
                "order": 2
              },
              "features": ["prostor pro myčku", "připojení na vodu"],
              "estimatedPrice": 8000
            },
            {
              "module": "sink-800",
              "type": "sink",
              "width": 800,
              "purpose": "Dřezová skříňka se dřezem a baterií",
              "position": "Střed zadní stěny - hlavní pracovní bod",
              "absolutePosition": {
                "fromLeft": 1200,
                "fromRight": 2000,
                "wall": "back",
                "order": 3
              },
              "features": ["nerezový dřez", "páková baterie", "sifon"],
              "estimatedPrice": 15000,
              "notes": "Umístěno u rozvodů vody"
            },
            {
              "module": "cooktop-600",
              "type": "cooktop",
              "width": 600,
              "purpose": "Skříňka pod varnou desku (indukce 4 zóny)",
              "position": "Vpravo od dřezu - 80cm od dřezu (optimální)",
              "absolutePosition": {
                "fromLeft": 2000,
                "fromRight": 1400,
                "wall": "back",
                "order": 4
              },
              "features": ["varná deska 60cm", "pod deskou úložný prostor"],
              "estimatedPrice": 10000,
              "notes": "1.2m od myčky, 80cm od dřezu (ergonomie)"
            },
            {
              "module": "storage-600",
              "type": "storage",
              "width": 600,
              "purpose": "Úložná skříňka pro hrnce a pánve",
              "position": "Pravý konec linky",
              "absolutePosition": {
                "fromLeft": 2600,
                "fromRight": 800,
                "wall": "back",
                "order": 5
              },
              "features": ["3x zásuvka", "pro těžké nádobí"],
              "estimatedPrice": 12000
            }
          ],
          "wall_sequence": ["wall_storage-600", "skip-900", "wall_storage-600"],
          "wall_details": [
            {
              "module": "wall_storage-600",
              "type": "wall_storage",
              "width": 600,
              "purpose": "Horní skříňka pro talíře a sklenice",
              "position": "Nad první spodní skříňkou",
              "absolutePosition": {
                "fromLeft": 0,
                "fromRight": 3400,
                "wall": "back",
                "height": 1400,
                "order": 1
              },
              "features": ["2x polička", "soft close"],
              "estimatedPrice": 8000
            },
            {
              "module": "skip-900",
              "type": "skip",
              "width": 900,
              "purpose": "Volný prostor nad digestoří",
              "position": "Nad varnou deskou a částí dřezu",
              "absolutePosition": {
                "fromLeft": 600,
                "fromRight": 2500,
                "wall": "back",
                "height": 1400,
                "order": 2
              },
              "notes": "Digestoř zde - nelze skříňku"
            },
            {
              "module": "wall_storage-600",
              "type": "wall_storage",
              "width": 600,
              "purpose": "Horní skříňka pro potraviny",
              "position": "Nad poslední spodní skříňkou",
              "absolutePosition": {
                "fromLeft": 2600,
                "fromRight": 800,
                "wall": "back",
                "height": 1400,
                "order": 3
              },
              "features": ["2x polička", "soft close"],
              "estimatedPrice": 8000
            }
          ],
          "totalUsed": 3200,
          "totalAvailable": 4000,
          "remainingSpace": 800
        },
        "right": {
          "wallName": "Pravá boční stěna",
          "wallLength": 3000,
          "tall_sequence": ["fridge-600", "oven_tower-600"],
          "tall_details": [
            {
              "module": "fridge-600",
              "type": "fridge",
              "width": 600,
              "purpose": "Vysoká skříňka pro vestavnou lednici",
              "position": "Začátek pravé stěny - u rohu s hlavní stěnou",
              "absolutePosition": {
                "fromLeft": 0,
                "fromRight": 2400,
                "wall": "right",
                "order": 1
              },
              "features": ["vestavná lednice/mraznička", "200cm výška"],
              "estimatedPrice": 18000,
              "notes": "Ideální pozice - u vstupu do kuchyně"
            },
            {
              "module": "oven_tower-600",
              "type": "oven_tower",
              "width": 600,
              "purpose": "Vestavná trouba a mikrovlnka ve výšce",
              "position": "Vedle lednice",
              "absolutePosition": {
                "fromLeft": 600,
                "fromRight": 1800,
                "wall": "right",
                "order": 2
              },
              "features": ["trouba ve výšce 90-120cm", "mikrovlnka 140-160cm"],
              "estimatedPrice": 16000,
              "notes": "Ergonomické - bez ohýbání"
            }
          ],
          "base_sequence": ["storage-600", "storage-600"],
          "base_details": [
            {
              "module": "storage-600",
              "type": "storage",
              "width": 600,
              "purpose": "Úložná skříňka",
              "position": "Za vysokými skříňkami",
              "absolutePosition": {
                "fromLeft": 1200,
                "fromRight": 1200,
                "wall": "right",
                "order": 1
              },
              "features": ["3x zásuvka"],
              "estimatedPrice": 12000
            },
            {
              "module": "storage-600",
              "type": "storage",
              "width": 600,
              "purpose": "Úložná skříňka",
              "position": "Konec pravé stěny",
              "absolutePosition": {
                "fromLeft": 1800,
                "fromRight": 600,
                "wall": "right",
                "order": 2
              },
              "features": ["3x zásuvka"],
              "estimatedPrice": 12000
            }
          ],
          "wall_sequence": ["skip-1200", "wall_storage-600"],
          "wall_details": [
            {
              "module": "skip-1200",
              "type": "skip",
              "width": 1200,
              "purpose": "Volný prostor nad vysokými skříňkami",
              "position": "Nad lednicí a troubou",
              "absolutePosition": {
                "fromLeft": 0,
                "fromRight": 1800,
                "wall": "right",
                "height": 2000,
                "order": 1
              },
              "notes": "Vysoké skříňky až ke stropu"
            },
            {
              "module": "wall_storage-600",
              "type": "wall_storage",
              "width": 600,
              "purpose": "Horní skříňka",
              "position": "Nad první spodní skříňkou",
              "absolutePosition": {
                "fromLeft": 1200,
                "fromRight": 1200,
                "wall": "right",
                "height": 1400,
                "order": 2
              },
              "features": ["2x polička"],
              "estimatedPrice": 8000
            }
          ],
          "totalUsed": 2400,
          "totalAvailable": 3000,
          "remainingSpace": 600
        }
      },
      "appliances": [
        {
          "name": "Indukční varná deska",
          "type": "cooktop",
          "size": "60cm (4 zóny)",
          "location": "Zadní stěna, 2.0-2.6m od levého okraje, nad storage modulem",
          "estimatedPrice": 12000,
          "notes": "Indukční varná deska 4 zóny, touch ovládání"
        },
        {
          "name": "Vestavná trouba",
          "type": "oven",
          "size": "60cm šířka",
          "location": "Pravá stěna, oven_tower modul (0.6-1.2m), výška 90-120cm",
          "estimatedPrice": 15000,
          "notes": "Vestavná elektrická trouba ve výšce - ergonomické umístění"
        },
        {
          "name": "Mikrovlnná trouba",
          "type": "microwave",
          "size": "60cm šířka",
          "location": "Pravá stěna, oven_tower modul (0.6-1.2m), výška 140-160cm",
          "estimatedPrice": 8000,
          "notes": "Nad troubou - pohodlné dosažení"
        },
        {
          "name": "Vestavná lednice/mraznička",
          "type": "fridge",
          "size": "60cm šířka, 200cm výška",
          "location": "Pravá stěna, fridge modul (0-0.6m), celá výška",
          "estimatedPrice": 25000,
          "notes": "Vestavná kombinovaná lednice - u rohu při vstupu"
        },
        {
          "name": "Myčka nádobí",
          "type": "dishwasher",
          "size": "60cm šířka",
          "location": "Zadní stěna, 0.6-1.2m, vedle dřezu",
          "estimatedPrice": 18000,
          "notes": "Plně vestavná 60cm myčka - ideální pozice vedle dřezu"
        },
        {
          "name": "Digestoř",
          "type": "hood",
          "size": "60cm šířka",
          "location": "Zadní stěna, nad varnou deskou (2.0-2.6m)",
          "estimatedPrice": 10000,
          "notes": "Odsavač par - digestoř s odvodem/cirkulací"
        }
      ],
      "materials": {
        "cabinetFronts": "Dřevodekor (např. dub, ořech, buk) - klasický styl s úchytkami nebo lištami",
        "cabinetBody": "Dřevotříska DTD 18mm, vnitřní bílý melamin",
        "countertop": "Masivní dřevo (dub, buk, jasan) ošetřené olejem pro ochranu proti vodě a teplotě, tloušťka 38-40mm",
        "handles": "Klasické úchytky nebo integrované lišty v barvě matný nerez nebo černá"
      },
      "features": [
        "LED osvětlení pod horními skříňkami pro lepší osvětlení pracovních ploch",
        "Tichý dojezd (soft close) na všech zásuvkách a dvířkách",
        "Klasické úchytky nebo integrované lišty - na výběr podle vašich preferencí",
        "Masivní dřevěná pracovní deska s ochranou proti vodě a teplotě",
        "Ergonomické rozmístění spotřebičů - trouba a mikrovlnka ve výšce pro pohodlnou obsluhu"
      ],
      "designPrinciples": {
        "style": "Klasický design s dřevěnými prvky",
        "colorScheme": "Teplé dřevěné tóny v kombinaci s bílou nebo krémovou barvou těla skříněk",
        "ergonomics": "Důraz na ergonomické rozmístění - trouba ve výšce, pracovní trojúhelník optimalizovaný",
        "storage": "Maximální využití prostoru - kombinace zásuvek a dvířek, vysoké skříňky až ke stropu"
      },
      "ergonomics": {
        "workTriangle": {
          "sink": { "wall": "back", "x": 1600 },
          "cooktop": { "wall": "back", "x": 2300 },
          "fridge": { "wall": "right", "z": 300 }
        },
        "workTriangleDistance": 2500,
        "workTriangleOptimal": true,
        "counterSpace": {
          "leftOfSink": 600,
          "rightOfSink": 800,
          "leftOfCooktop": 800,
          "rightOfCooktop": 600,
          "total": 2800
        },
        "notes": "Pracovní trojúhelník je optimální (2.5m). Dostačující pracovní plochy u dřezu (1400mm celkem) a u varné desky (1400mm celkem). Trouba a mikrovlnka ve výšce pro ergonomickou obsluhu."
      }
    }

    console.log('⚡ QUICK TEST - Using mock design:', mockDesign)

    // Detekuj zda design obsahuje _details pole (OpenAI) nebo jen _sequence (Claude)
    const hasDetails = mockDesign.walls && Object.values(mockDesign.walls).some(wall =>
      (wall.base_details && wall.base_details.length > 0) ||
      (wall.tall_details && wall.tall_details.length > 0) ||
      (wall.wall_details && wall.wall_details.length > 0)
    )

    console.log('🔍 QUICK TEST - Design type:', hasDetails ? 'POSITION-BASED (with _details)' : 'SEQUENCE-BASED (only _sequence)')

    // Vyber správný generátor
    const generator = hasDetails
      ? new PositionBasedLayoutGenerator({
          width: roomWidth,
          depth: roomDepth,
          height: roomHeight
        })
      : new SequenceLayoutGenerator({
          width: roomWidth,
          depth: roomDepth,
          height: roomHeight
        })

    console.log('🏭 QUICK TEST - Using generator:', generator.constructor.name)

    // Validace
    const validation = generator.constructor.validateDesign(mockDesign)
    if (!validation.valid) {
      setMessages([{
        role: 'system',
        content: `❌ Chyba v mock designu: ${validation.errors.join(', ')}`,
        timestamp: Date.now()
      }])
      return
    }

    // Generuj preview
    const preview = generator.generatePreview(mockDesign, catalog)

    console.log('⚡ QUICK TEST - Generated preview:', preview)

    setGeneratedDesign(preview)
    setShowPreview(true)

    setMessages([{
      role: 'system',
      content: `✅ Quick Test návrh vygenerován!\n\nCelkem: ${preview.stats.totalCabinets} skříněk\nCena: ${mockDesign.totalPrice?.toLocaleString('cs-CZ')} Kč\n\nProhlédni si návrh a klikni "Použít návrh".`,
      timestamp: Date.now()
    }])
  }

  /**
   * Generování layoutu
   */
  const handleGenerateLayout = async () => {
    if (!assistant) return

    setIsLoading(true)

    try {
      const design = await assistant.generateLayout()

      console.log('🤖 AI GENERATED DESIGN:', design)
      console.log('📐 Room dimensions:', { width: roomWidth, depth: roomDepth, height: roomHeight })

      // Detekuj zda design obsahuje _details pole (OpenAI) nebo jen _sequence (Claude)
      const hasDetails = design.walls && Object.values(design.walls).some(wall =>
        (wall.base_details && wall.base_details.length > 0) ||
        (wall.tall_details && wall.tall_details.length > 0) ||
        (wall.wall_details && wall.wall_details.length > 0)
      )

      console.log('🔍 Design type detected:', hasDetails ? 'POSITION-BASED (with _details)' : 'SEQUENCE-BASED (only _sequence)')

      // Vyber správný generátor
      const generator = hasDetails
        ? new PositionBasedLayoutGenerator({
            width: roomWidth,
            depth: roomDepth,
            height: roomHeight
          })
        : new SequenceLayoutGenerator({
            width: roomWidth,
            depth: roomDepth,
            height: roomHeight
          })

      console.log('🏭 Using generator:', generator.constructor.name)

      // Validace
      const validation = generator.constructor.validateDesign(design)
      if (!validation.valid) {
        throw new Error(`Nevalidní návrh: ${validation.errors.join(', ')}`)
      }

      // Generuj preview
      const preview = generator.generatePreview(design, catalog)

      console.log('🔄 GENERATOR OUTPUT (preview):', preview)
      console.log('📦 Cabinets count:', preview.cabinets?.length)
      console.log('📋 First 3 cabinets:', preview.cabinets?.slice(0, 3))

      setGeneratedDesign(preview)
      setShowPreview(true)

      setMessages(prev => [...prev, {
        role: 'system',
        content: `✅ Návrh vygenerován!\n\nCelkem: ${preview.stats.totalCabinets} skříněk\nCena: ${design.totalPrice?.toLocaleString('cs-CZ')} Kč\n\nProhlédni si návrh a pokud ti vyhovuje, klikni na "Použít návrh".`,
        timestamp: Date.now()
      }])
    } catch (error) {
      console.error('Layout generation error:', error)
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Chyba při generování návrhu: ${error.message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Aplikování návrhu do návrháře
   */
  const handleApplyDesign = () => {
    if (!generatedDesign) return

    console.log('🎨 APPLYING DESIGN TO 3D SCENE:')
    console.log('📊 generatedDesign:', generatedDesign)
    console.log('📦 Total cabinets to apply:', generatedDesign.cabinets?.length)
    console.log('📋 Cabinet list:', generatedDesign.cabinets)

    // Vyčisti současný návrh
    if (window.confirm('Vymazat současný návrh a nahradit ho AI návrhem?')) {
      clearAllCabinets()

      if (applyCabinetLayoutExact) {
        applyCabinetLayoutExact(generatedDesign.cabinets)
      } else {
        // Fallback - staré vkládání po jedné skříňce
        generatedDesign.cabinets.forEach((cab, index) => {
          console.log(`  ➡️ Adding cabinet ${index + 1}/${generatedDesign.cabinets.length}:`, {
            name: cab.name,
            type: cab.type,
            width: cab.width,
            position: cab.position,
            rotation: cab.rotation,
            aiPurpose: cab.aiPurpose
          })
          addCabinetAtPosition(cab, cab.position, cab.rotation || 0)
        })
      }

      // Zavři modal
      setMessages(prev => [...prev, {
        role: 'system',
        content: '✅ Návrh byl úspěšně aplikován! Můžeš ho teď upravovat v návrháři.',
        timestamp: Date.now()
      }])

      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }

  /**
   * Reset konverzace
   */
  const handleReset = () => {
    if (window.confirm('Začít konverzaci od začátku?')) {
      setMessages([])
      setGeneratedDesign(null)
      setShowPreview(false)
      setAssistant(null)
      initializeAssistant()
    }
  }

  /**
   * Změna API klíče
   */
  const handleChangeApiKey = () => {
    if (aiProvider === 'openai') {
      clearOpenAIApiKey()
    } else {
      clearClaudeApiKey()
    }
    setAssistant(null)
    setMessages([])
    initializeAssistant()
  }

  /**
   * Změna AI providera
   */
  const handleChangeProvider = (newProvider) => {
    if (newProvider === aiProvider) return

    if (window.confirm(`Přepnout na ${newProvider === 'openai' ? 'OpenAI (GPT-4)' : 'Claude'}?\n\nAktuální konverzace bude ztracena.`)) {
      setAiProvider(newProvider)
      setAssistant(null)
      setMessages([])
      setGeneratedDesign(null)
      setShowPreview(false)
      // Inicializace proběhne automaticky díky useEffect
    }
  }

  if (!isOpen) return null

  const modalStyle = {
    ...styles.modal,
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${modalPos.x}px), calc(-50% + ${modalPos.y}px))`
  }

  const handleHeaderMouseDown = (e) => {
    const target = e.target
    if (target.closest('button, select, input')) return
    setIsDraggingModal(true)
    dragOffsetRef.current = {
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={modalStyle}>
        {/* Header */}
        <div
          style={{
            ...styles.header,
            cursor: 'move',
            userSelect: 'none'
          }}
          onMouseDown={handleHeaderMouseDown}
        >
          <div style={styles.headerLeft}>
            <span style={styles.icon}>🤖</span>
            <div>
              <h2 style={styles.title}>AI Kitchen Designer</h2>
              <p style={styles.subtitle}>
                Expertní poradce pro návrh kuchyní • {aiProvider === 'openai' ? 'OpenAI GPT-4' : 'Claude Haiku'}
              </p>
            </div>
          </div>
          <div style={styles.headerRight}>
            {/* AI Provider Selector */}
            <select
              value={aiProvider}
              onChange={(e) => handleChangeProvider(e.target.value)}
              style={styles.providerSelect}
              title="Vyberte AI model"
            >
              <option value="openai">OpenAI (GPT-4)</option>
              <option value="claude">Claude (Haiku)</option>
            </select>
            <button onClick={handleReset} style={styles.iconButton} title="Restart konverzace">
              🔄
            </button>
            <button onClick={handleChangeApiKey} style={styles.iconButton} title="Změnit API klíč">
              🔑
            </button>
            <button onClick={onClose} style={styles.closeButton}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div style={styles.messages}>
          {messages.map((msg, i) => (
            <Message key={i} message={msg} />
          ))}

          {isLoading && (
            <div style={styles.loadingMessage}>
              <div style={styles.typingIndicator}>
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span style={styles.loadingText}>AI přemýšlí...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Preview (pokud je vygenerován návrh) */}
        {showPreview && generatedDesign && (
          <DesignPreview design={generatedDesign} onApply={handleApplyDesign} />
        )}

        {/* Input */}
        <div style={styles.inputArea}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Napiš svou odpověď..."
            style={styles.input}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            style={{ ...styles.sendButton, opacity: isLoading ? 0.5 : 1 }}
            disabled={isLoading}
          >
            Odeslat
          </button>
          <button
            onClick={handleQuickTest}
            style={{ ...styles.generateButton, background: '#f59e0b' }}
            disabled={isLoading}
            title="Quick Test - okamžitě vygeneruje testovací návrh"
          >
            ⚡ Quick Test
          </button>
          <button
            onClick={handleGenerateLayout}
            style={styles.generateButton}
            disabled={isLoading || !assistant}
            title="Vygeneruj návrh na základě konverzace"
          >
            ✨ Vygeneruj návrh
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Komponenta pro jednu zprávu
 */
function Message({ message }) {
  const { role, content, timestamp } = message

  const isUser = role === 'user'
  const isSystem = role === 'system'

  return (
    <div style={{
      ...styles.message,
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      background: isSystem ? '#fff3cd' : isUser ? '#e3f2fd' : '#f5f5f5',
      borderLeft: isSystem ? '4px solid #ff9800' : isUser ? '4px solid #2196f3' : '4px solid #4caf50'
    }}>
      <div style={styles.messageHeader}>
        <strong style={styles.messageSender}>
          {isSystem ? '⚠️ Systém' : isUser ? 'Ty' : '🤖 AI Asistent'}
        </strong>
        <span style={styles.messageTime}>
          {new Date(timestamp).toLocaleTimeString('cs-CZ', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
      <div style={styles.messageContent}>
        {content.split('\n').map((line, i) => (
          <p key={i} style={{ margin: '4px 0' }}>{line}</p>
        ))}
      </div>
    </div>
  )
}

/**
 * Preview vygenerovaného návrhu
 */
function DesignPreview({ design, onApply }) {
  // Zkontroluj jestli je k dispozici rozšířený formát s detaily
  const hasExtendedDetails = design.summary && typeof design.summary === 'string'

  // Spočítej celkovou cenu z appliances pokud je k dispozici
  const totalAppliancesPrice = design.appliances?.reduce((sum, app) => sum + (app.estimatedPrice || 0), 0) || 0

  return (
    <div style={styles.preview}>
      <div style={styles.previewHeader}>
        <h3 style={styles.previewTitle}>📋 Vygenerovaný návrh</h3>
      </div>

      <div style={styles.previewContent}>
        {/* Shrnutí */}
        <div style={styles.previewSummary}>
          <p><strong>Shrnutí:</strong> {design.summary}</p>
          <p><strong>Celková cena skříněk:</strong> {design.totalPrice?.toLocaleString('cs-CZ')} Kč</p>
          {totalAppliancesPrice > 0 && (
            <p><strong>Cena spotřebičů:</strong> {totalAppliancesPrice.toLocaleString('cs-CZ')} Kč</p>
          )}
          {design.shape && <p><strong>Tvar kuchyně:</strong> {design.shape}</p>}
        </div>

        {/* Stats */}
        <div style={styles.previewStats}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{design.stats.totalCabinets}</span>
            <span style={styles.statLabel}>Celkem skříněk</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{design.stats.baseCabinets}</span>
            <span style={styles.statLabel}>Spodních</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{design.stats.wallCabinets}</span>
            <span style={styles.statLabel}>Horních</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>{design.stats.tallCabinets}</span>
            <span style={styles.statLabel}>Vysokých</span>
          </div>
        </div>

        {/* Ergonomika (pokud je k dispozici) */}
        {design.ergonomics && (
          <div style={styles.previewSection}>
            <p style={styles.sectionTitle}>⚡ Ergonomie</p>
            <p style={styles.smallText}>
              {design.ergonomics.workTriangleOptimal ? '✅' : '⚠️'} Pracovní trojúhelník: {(design.ergonomics.workTriangleDistance / 1000).toFixed(1)}m
            </p>
            {design.ergonomics.notes && (
              <p style={styles.smallText}>{design.ergonomics.notes}</p>
            )}
          </div>
        )}

        {/* Spotřebiče (pokud jsou k dispozici) */}
        {design.appliances && design.appliances.length > 0 && (
          <div style={styles.previewSection}>
            <p style={styles.sectionTitle}>🔌 Spotřebiče ({design.appliances.length})</p>
            {design.appliances.slice(0, 3).map((app, i) => (
              <p key={i} style={styles.smallText}>
                • {app.name} ({app.size}) - {app.estimatedPrice?.toLocaleString('cs-CZ')} Kč
              </p>
            ))}
            {design.appliances.length > 3 && (
              <p style={styles.smallText}>... a další {design.appliances.length - 3} spotřebičů</p>
            )}
          </div>
        )}

        {/* Features (pokud jsou k dispozici) */}
        {design.features && design.features.length > 0 && (
          <div style={styles.previewSection}>
            <p style={styles.sectionTitle}>✨ Vlastnosti</p>
            {design.features.slice(0, 3).map((feature, i) => (
              <p key={i} style={styles.smallText}>• {feature}</p>
            ))}
          </div>
        )}

        <button onClick={onApply} style={styles.applyButton}>
          ✅ Použít tento návrh
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
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
    maxWidth: '800px',
    height: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '12px 12px 0 0'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  headerRight: {
    display: 'flex',
    gap: '8px'
  },
  icon: {
    fontSize: '32px'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    opacity: 0.9
  },
  providerSelect: {
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '6px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'white',
    fontWeight: '600',
    outline: 'none',
    transition: 'all 0.2s'
  },
  iconButton: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '16px',
    color: 'white',
    transition: 'all 0.2s'
  },
  closeButton: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  message: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px'
  },
  messageSender: {
    fontSize: '13px',
    color: '#666'
  },
  messageTime: {
    fontSize: '11px',
    color: '#999'
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#333'
  },
  loadingMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    alignSelf: 'flex-start'
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px'
  },
  loadingText: {
    fontSize: '13px',
    color: '#999',
    fontStyle: 'italic'
  },
  preview: {
    borderTop: '2px solid #e0e0e0',
    background: '#f9f9f9',
    padding: '16px'
  },
  previewHeader: {
    marginBottom: '12px'
  },
  previewTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600
  },
  previewContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  previewSummary: {
    fontSize: '13px',
    lineHeight: '1.6',
    marginBottom: '8px'
  },
  previewSection: {
    background: 'white',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '12px'
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: '13px',
    marginBottom: '6px',
    color: '#333'
  },
  smallText: {
    fontSize: '12px',
    color: '#666',
    margin: '2px 0',
    lineHeight: '1.4'
  },
  previewStats: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'space-around',
    padding: '12px',
    background: 'white',
    borderRadius: '8px'
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#667eea'
  },
  statLabel: {
    fontSize: '11px',
    color: '#999',
    textTransform: 'uppercase'
  },
  applyButton: {
    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  inputArea: {
    padding: '16px',
    borderTop: '1px solid #e0e0e0',
    display: 'flex',
    gap: '8px'
  },
  input: {
    flex: 1,
    padding: '10px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  sendButton: {
    background: '#2196f3',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  generateButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  }
}

// CSS pro typing indicator animaci
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
    30% { transform: translateY(-10px); opacity: 1; }
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: #999;
    border-radius: 50%;
    display: inline-block;
    animation: typing 1.4s infinite;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }
`
document.head.appendChild(styleSheet)
