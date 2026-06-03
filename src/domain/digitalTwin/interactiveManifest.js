export function createManifestInteractionState() {
  return {
    tapCount: 0,
    sliderValue: 50,
  }
}

export function isTapCountAction(widget = {}) {
  const action = String(widget.action || '').toLowerCase()
  const text = String(widget.text || '').toLowerCase()
  return (
    action === 'increment_tap_count' ||
    /increment.*tap.*count/.test(action) ||
    /tap.*count/.test(action) ||
    text.includes('tap me')
  )
}

export function applyManifestWidgetAction(state, widget = {}) {
  if (isTapCountAction(widget)) {
    return { ...state, tapCount: Number(state.tapCount || 0) + 1 }
  }
  return state
}

export function updateManifestSliderValue(state, value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return state
  return { ...state, sliderValue: Math.max(0, Math.min(100, number)) }
}

export function resolveManifestWidgetText(widget = {}, state = createManifestInteractionState()) {
  const text = String(widget.text || widget.id || '')
  if (/^tap\s*count\s*:/i.test(text)) {
    return `Tap count: ${Number(state.tapCount || 0)}`
  }
  if (/^slider\s*:/i.test(text)) {
    return `Slider: ${Number(state.sliderValue ?? widget.value ?? 50)}`
  }
  return text
}

export function resolveManifestWidgetValue(widget = {}, state = createManifestInteractionState()) {
  if (widget.type === 'slider') return Number(state.sliderValue ?? widget.value ?? 50)
  return Number(widget.value || 0)
}
