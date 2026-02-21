/**
 * BroadcastChannel pro synchronizaci stavu mezi okny
 * Hlavni okno posila zmeny, nahledove okno prijima
 */

const CHANNEL_NAME = 'oresi-kitchen-sync'

// Vytvor channel
let channel = null

export function getChannel() {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
  }
  return channel
}

/**
 * Odesle aktualni stav do vsech ostatnich oken
 */
export function broadcastState(state) {
  const ch = getChannel()
  ch.postMessage({
    type: 'SCENE_UPDATE',
    timestamp: Date.now(),
    data: {
      placedCabinets: state.placedCabinets,
      selectedCabinet: state.selectedCabinet?.instanceId || null,
      room: {
        width: state.roomWidth,
        depth: state.roomDepth,
        height: state.roomHeight
      }
    }
  })
}

/**
 * Odesle info o zmene vyberu
 */
export function broadcastSelection(instanceId) {
  const ch = getChannel()
  ch.postMessage({
    type: 'SELECTION_CHANGE',
    timestamp: Date.now(),
    data: { selectedInstanceId: instanceId }
  })
}

/**
 * Odesle pozadavek na focus na skrinku (pro klikani v nahledovem okne)
 */
export function broadcastFocusRequest(instanceId) {
  const ch = getChannel()
  ch.postMessage({
    type: 'FOCUS_REQUEST',
    timestamp: Date.now(),
    data: { instanceId }
  })
}

/**
 * Nastavi listener pro prijimani zprav
 */
export function onMessage(callback) {
  const ch = getChannel()
  ch.onmessage = (event) => {
    callback(event.data)
  }
}

/**
 * Uzavre channel
 */
export function closeChannel() {
  if (channel) {
    channel.close()
    channel = null
  }
}
