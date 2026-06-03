import { ESPLoader, Transport } from 'esptool-js'

export const USB_FLASH_APP_OFFSET = 0x10000
export const USB_LOG_RELEASE_REQUEST_EVENT = 'vibeboard:usb-log-release-request'
export const USB_LOG_RELEASED_EVENT = 'vibeboard:usb-log-released'
export const USB_FLASH_FINISHED_EVENT = 'vibeboard:usb-flash-finished'

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial && window.isSecureContext
}

export function webSerialUnavailableReason() {
  if (typeof navigator === 'undefined' || !navigator.serial) {
    return '当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge 桌面版。'
  }
  if (!window.isSecureContext) {
    return 'USB 直刷需要 HTTPS 或 localhost 安全上下文。'
  }
  return ''
}

export async function releaseUsbLogPortForFlash({ timeoutMs = 1800, onLog } = {}) {
  if (typeof window === 'undefined') return false

  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return new Promise(resolve => {
    let settled = false
    const finish = released => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.removeEventListener(USB_LOG_RELEASED_EVENT, handleReleased)
      if (released) onLog?.('已临时断开 USB 串口日志，释放端口给烧录器')
      resolve(released)
    }
    const handleReleased = event => {
      if (event?.detail?.requestId !== requestId) return
      finish(Boolean(event.detail.released))
    }
    const timer = window.setTimeout(() => finish(false), timeoutMs)

    window.addEventListener(USB_LOG_RELEASED_EVENT, handleReleased)
    window.dispatchEvent(new CustomEvent(USB_LOG_RELEASE_REQUEST_EVENT, {
      detail: { requestId },
    }))
  })
}

export function notifyUsbFlashFinished() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(USB_FLASH_FINISHED_EVENT))
}

export function waitForUsbPortSettle(ms = 250) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function flashAppOnlyOverUsb({ firmware, onLog, onProgress }) {
  if (!isWebSerialSupported()) {
    throw new Error(webSerialUnavailableReason())
  }
  if (!firmware) throw new Error('没有可烧录的固件，请先编译成功。')

  const port = await navigator.serial.requestPort({
    filters: [
      { usbVendorId: 0x303a },
      { usbVendorId: 0x10c4 },
      { usbVendorId: 0x1a86 },
    ],
  })

  const terminal = {
    clean() {},
    writeLine(data) { if (data) onLog?.(String(data)) },
    write(data) { if (data) onLog?.(String(data)) },
  }

  const transport = new Transport(port, false)
  const loader = new ESPLoader({
    transport,
    baudrate: 460800,
    terminal,
    debugLogging: false,
  })

  try {
    onLog?.('连接 ESP32 ROM bootloader...')
    const chipName = await loader.main('default_reset')
    onLog?.(`已连接：${chipName}`)

    const flashFiles = await resolveFlashFiles(firmware)
    const totalBytes = flashFiles.reduce((sum, file) => sum + file.data.byteLength, 0)
    let completedBytes = 0

    onLog?.(`准备烧录 ${flashFiles.length} 个镜像，总大小 ${totalBytes} bytes`)
    flashFiles.forEach(file => {
      onLog?.(`- ${file.name} -> 0x${file.address.toString(16)} (${file.data.byteLength} bytes)`)
    })

    await loader.writeFlash({
      fileArray: flashFiles.map(file => ({ data: file.data, address: file.address })),
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: '16MB',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const previousBytes = flashFiles
          .slice(0, fileIndex)
          .reduce((sum, file) => sum + file.data.byteLength, 0)
        completedBytes = Math.max(completedBytes, previousBytes + written)
        const percent = totalBytes ? Math.round((completedBytes / totalBytes) * 100) : Math.round((written / total) * 100)
        onProgress?.(Math.min(100, percent))
      },
    })

    onLog?.('烧录完成，正在复位设备...')
    await loader.after('hard_reset')
  } finally {
    try { await transport.disconnect() } catch {}
  }
}

async function resolveFlashFiles(firmware) {
  if (Array.isArray(firmware.flashFiles) && firmware.flashFiles.length > 0) {
    const files = []
    for (const file of firmware.flashFiles) {
      files.push({
        name: file.name || file.path || `0x${Number(file.offset).toString(16)}`,
        address: Number(file.offset),
        data: new Uint8Array(await file.blob.arrayBuffer()),
      })
    }
    return files
      .filter(file => Number.isFinite(file.address) && file.data.byteLength > 0)
      .sort((a, b) => a.address - b.address)
  }

  const data = new Uint8Array(await firmware.arrayBuffer())
  return [{
    name: 'app',
    address: USB_FLASH_APP_OFFSET,
    data,
  }]
}
