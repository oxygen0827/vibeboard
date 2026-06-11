import { HUANGSHAN_BOARD_PROFILE } from './boardProfile.js'
import { normalizeHuangshanBuilderConfig } from './appBuilder.js'

const COMPONENT_TYPES = ['status', 'metric', 'battery', 'bluetooth', 'action']
const CAPABILITY_TYPES = ['status', 'ambient_light', 'imu', 'magnetometer', 'battery', 'adc_gpio', 'bluetooth', 'key', 'gpio_output', 'led', 'motor', 'uart2']

function trimText(value) {
  return String(value || '').trim()
}

export function createHuangshanAiBuilderMessages({
  userPrompt,
  displayName = 'Board Diagnostics',
  description = 'Show display, touch, and timer status.',
} = {}) {
  return [
    {
      role: 'system',
      content: [
        'You generate Huangshan Pi SF32LB52 watch UI builder JSON.',
        'Return ONLY one JSON object. Do not include markdown or prose.',
        'Allowed component types: status, metric, battery, bluetooth, action.',
        'Allowed capability values: status, ambient_light, imu, magnetometer, battery, adc_gpio, bluetooth, key, gpio_output, led, motor, uart2.',
        'The output schema is: {"displayName": string, "description": string, "components": [{"type": string, "capability": string, "label": string, "value": string, "enabled": boolean}]}',
        'Use concise labels and values that fit a 390x450 round-corner AMOLED watch screen.',
        'Do not return C code, JavaScript, HTML, CSS, shell commands, paths, or unsupported component types.',
        'Use verified Huangshan examples: KEY2=PA43, GPIO output=GPIO20, VBAT ADC=bat1 channel 7, PA34 ADC channel 6, WS2812 rgbled=PA32/GPTIM2_CH1, UART2 RX/TX=PA18/PA19, sensors on I2C3 PA39/PA40.',
        'Never invent unavailable hardware readings. The board contract does not include heart-rate, step-count, GPS, weather, microphone, speaker, WiFi, or cloud data.',
        'If the user asks for sports/health data, map it to available Huangshan hardware: IMU motion, VBAT battery, KEY2 start/stop, LED feedback, and BLE status placeholder. Use labels like Motion, Accel, VBAT, KEY2, LED instead of Heart or Steps.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Board: ${HUANGSHAN_BOARD_PROFILE.name}`,
        `Chip: ${HUANGSHAN_BOARD_PROFILE.chip}`,
        `Framework: ${HUANGSHAN_BOARD_PROFILE.framework}`,
        `Display: ${HUANGSHAN_BOARD_PROFILE.display.resolution.width}x${HUANGSHAN_BOARD_PROFILE.display.resolution.height} AMOLED`,
        `Current app name: ${trimText(displayName) || 'Board Diagnostics'}`,
        `Current description: ${trimText(description) || 'Generated Huangshan watch UI.'}`,
        '',
        `User request: ${trimText(userPrompt) || 'Create a practical diagnostics watch screen.'}`,
        '',
        'Capability mapping hints: environment light -> ambient_light, IMU/motion/activity -> imu, compass/magnetic -> magnetometer, power/VBAT -> battery, PA34 analog -> adc_gpio, BLE -> bluetooth, physical key -> key, GPIO output -> gpio_output, RGB LED -> led, vibration -> motor, external serial -> uart2.',
        'Prefer 4 to 6 components. Use at most one action component.',
      ].join('\n'),
    },
  ]
}

function sanitizeUnsupportedMetric(component) {
  const label = trimText(component.label)
  const value = trimText(component.value)
  const text = `${label} ${value}`
  if (/(heart|hr|bpm|心率|心跳)/i.test(text)) {
    return { ...component, capability: 'imu', label: 'Motion', value: 'LSM6DSL' }
  }
  if (/(step|steps|步数|计步)/i.test(text)) {
    return { ...component, capability: 'imu', label: 'Accel', value: 'x/y/z' }
  }
  if (/(weather|temperature|humidity|gps|audio|mic|speaker|wifi|天气|温度|湿度|定位|音频|麦克风|喇叭)/i.test(text)) {
    return { ...component, capability: 'status', label: label || 'Status', value: 'Unsupported on board' }
  }
  return component
}

function extractJsonText(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) return raw.slice(start, end + 1)
  return raw
}

export function extractHuangshanBuilderConfigFromAiText(text, fallback = {}) {
  let parsed
  try {
    parsed = JSON.parse(extractJsonText(text))
  } catch {
    throw new Error('AI did not return a JSON object for Huangshan Builder.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI did not return a JSON object for Huangshan Builder.')
  }

  const normalized = normalizeHuangshanBuilderConfig({
    displayName: parsed.displayName || fallback.displayName,
    description: parsed.description || fallback.description,
    components: Array.isArray(parsed.components)
      ? parsed.components
        .filter(component => COMPONENT_TYPES.includes(component?.type))
        .map(component => sanitizeUnsupportedMetric({
          ...component,
          capability: CAPABILITY_TYPES.includes(component?.capability) ? component.capability : undefined,
        }))
      : undefined,
  })

  return normalized
}
