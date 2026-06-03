/**
 * Log stream manager
 * Supports two backends:
 *   - WiFi WebSocket  → ws://<ip>:3232/log
 *   - WebSerial       → USB serial port (115200 baud)
 */

/* ── WiFi WebSocket ────────────────────────────────────────── */
export function createWsLogStream(ip, onLine, onStatus) {
  let ws = null
  let stopped = false

  function connect() {
    onStatus('connecting')
    ws = new WebSocket(`ws://${ip}:3232/log`)

    ws.onopen  = () => onStatus('connected')
    ws.onclose = () => {
      onStatus('disconnected')
      if (!stopped) setTimeout(connect, 3000) // auto-reconnect
    }
    ws.onerror = () => onStatus('error')
    ws.onmessage = (e) => onLine(e.data, 'wifi')
  }

  connect()

  return {
    stop() {
      stopped = true
      ws?.close()
    },
  }
}

/* ── WebSerial ─────────────────────────────────────────────── */
export const SERIAL_DEBUG_FILTERS = [
  { usbVendorId: 0x303a }, // Espressif USB JTAG/serial debug unit
  { usbVendorId: 0x10c4 }, // Silicon Labs USB-UART bridges
  { usbVendorId: 0x1a86 }, // CH34x USB-UART bridges
]

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' &&
    typeof window !== 'undefined' &&
    'serial' in navigator &&
    window.isSecureContext
}

export function isLikelySerialDebugPort(port) {
  const info = port?.getInfo?.() || {}
  return SERIAL_DEBUG_FILTERS.some(filter => filter.usbVendorId === info.usbVendorId)
}

export async function getPairedSerialDebugPorts() {
  if (!('serial' in navigator)) {
    return []
  }
  const ports = await navigator.serial.getPorts()
  return ports.filter(isLikelySerialDebugPort)
}

export function describeSerialPort(port) {
  const info = port?.getInfo?.() || {}
  const vendor = info.usbVendorId ? `0x${info.usbVendorId.toString(16).padStart(4, '0')}` : 'unknown'
  const product = info.usbProductId ? `0x${info.usbProductId.toString(16).padStart(4, '0')}` : 'unknown'
  if (info.usbVendorId === 0x303a) return `USB JTAG/serial debug unit (${vendor}:${product})`
  return `USB serial (${vendor}:${product})`
}

export async function createSerialLogStream(onLine, onStatus, options = {}) {
  if (!isWebSerialSupported()) {
    throw new Error('浏览器不支持 WebSerial（请用 Chrome/Edge，并使用 HTTPS 或 localhost）')
  }

  const port = options.port || await navigator.serial.requestPort({ filters: SERIAL_DEBUG_FILTERS })

  await port.open({ baudRate: 115200 })
  onStatus('connected')

  const decoder = new TextDecoderStream()
  const reader  = decoder.readable.getReader()
  const readableClosed = port.readable.pipeTo(decoder.writable).catch(() => {})

  let buffer = ''
  let stopped = false

  // Read loop in background
  ;(async () => {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop()           // keep incomplete line
        for (const line of lines) {
          if (line.trim()) onLine(line, 'serial')
        }
      }
    } catch {
      /* port closed */
    } finally {
      try { reader.releaseLock() } catch {}
      if (!stopped) onStatus('disconnected')
    }
  })()

  return {
    async stop() {
      stopped = true
      try { await reader.cancel() } catch {}
      try { await readableClosed } catch {}
      try { await port.close() } catch {}
    },
    port,
  }
}

/* ── Log line parser ───────────────────────────────────────── */
// ESP-IDF log format: I (1234) tag: message
const LOG_RE = /^([IWEDV])\s+\((\d+)\)\s+([\w\-]+):\s+(.*)$/

export function parseLine(raw) {
  const m = raw.match(LOG_RE)
  if (!m) return { level: 'raw', ms: null, tag: null, text: raw }
  return {
    level: m[1],   // I W E D V
    ms:    parseInt(m[2]),
    tag:   m[3],
    text:  m[4],
    raw,
  }
}

export const LEVEL_COLOR = {
  E: 'var(--red)',
  W: 'var(--orange)',
  I: 'var(--text-primary)',
  D: 'var(--text-secondary)',
  V: 'var(--text-muted)',
  raw: 'var(--text-muted)',
}
