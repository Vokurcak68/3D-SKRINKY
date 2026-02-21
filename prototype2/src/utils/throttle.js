/**
 * Throttle funkce - omezi volani na max jednou za `limit` ms
 */
export function throttle(func, limit) {
  let inThrottle = false
  let lastArgs = null

  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
        if (lastArgs) {
          func.apply(this, lastArgs)
          lastArgs = null
        }
      }, limit)
    } else {
      lastArgs = args
    }
  }
}

/**
 * RequestAnimationFrame throttle - synchronizuje s renderovacim cyklem
 */
export function rafThrottle(func) {
  let rafId = null
  let lastArgs = null

  return function(...args) {
    lastArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs)
        rafId = null
      })
    }
  }
}
