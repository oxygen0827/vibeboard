// Board adapters — map each existing board world onto the unified contract.
//
// The goal is that App-level code and the generation pipeline see ONE shape
// (BoardContract) regardless of toolchain, instead of branching on
// workspaceMode === 'huangshan'. The toolchain field carries the difference.

import { TOOLCHAINS, normalizeBoardContract } from './boardContract'
import {
  HUANGSHAN_BOARD_ID,
  HUANGSHAN_BOARD_PROFILE,
  listHuangshanCapabilities,
} from '../domain/huangshan/boardProfile'

// Map Huangshan's per-capability list onto the shared capability families.
const HUANGSHAN_CAPABILITY_FAMILY = {
  lvgl_app: 'display',
  sensor: 'sensor',
  ws2812: 'led',
  gpio_key: 'sensor',
  charger: 'power',
  uart: 'network',
  audio: 'audio',
  tf_card: 'storage',
  motor: 'power',
  ble: 'ble',
  low_power: 'power',
  usb_fs: 'storage',
}

/**
 * Adapt an ESP-IDF board (already close to the contract) to the unified shape.
 * The board object passed in is the one produced by context/boards.js with
 * buildSystemPrompt already attached.
 */
export function adaptEspIdfBoard(board) {
  const capabilities = [...new Set(
    (board.skills || [])
      .map(skill => skill.capabilityFamily)
      .filter(Boolean),
  )]
  return normalizeBoardContract({
    ...board,
    toolchain: TOOLCHAINS.ESP_IDF,
    framework: board.framework || `ESP-IDF v${board.idfVersion || '5.4'}`,
    capabilities: capabilities.length > 0 ? capabilities : inferEspIdfCapabilities(board),
  })
}

// Fallback capability inference for ESP-IDF boards whose skills don't yet
// declare a capabilityFamily. Keeps the contract populated without forcing an
// immediate edit to every skill file.
function inferEspIdfCapabilities(board) {
  const ids = new Set((board.skills || []).map(s => s.id))
  const caps = []
  if (ids.has('lvgl')) caps.push('display')
  if (ids.has('audio') || ids.has('speech')) caps.push('audio')
  if (ids.has('wifi')) caps.push('network')
  if (ids.has('ble')) caps.push('ble')
  if (ids.has('camera') || ids.has('vision')) caps.push('camera')
  if (ids.has('imu')) caps.push('sensor')
  if (ids.has('sdcard')) caps.push('storage')
  if (ids.has('gpio')) caps.push('sensor')
  return [...new Set(caps)]
}

/**
 * Adapt the Huangshan profile (SiFli SDK + SCons) to the unified contract.
 * Huangshan has no per-skill prompt registry yet, so buildSystemPrompt returns
 * a profile-derived hardware prompt. Capabilities come from its capability
 * list. This lets Huangshan join the registry without rewriting its builder.
 */
export function adaptHuangshanBoard() {
  const profile = HUANGSHAN_BOARD_PROFILE
  const capabilities = [...new Set(
    listHuangshanCapabilities()
      .map(cap => HUANGSHAN_CAPABILITY_FAMILY[cap.id])
      .filter(Boolean),
  )]
  const basePrompt = buildHuangshanBasePrompt(profile)
  return normalizeBoardContract({
    id: HUANGSHAN_BOARD_ID,
    name: profile.name,
    chip: profile.chip,
    description: `${profile.module}, ${profile.display.panel} ${profile.display.resolution.width}x${profile.display.resolution.height} AMOLED, ${profile.memory.psram} PSRAM`,
    toolchain: TOOLCHAINS.SIFLI_SCONS,
    framework: profile.framework,
    capabilities,
    skills: [],
    driverContracts: [],
    basePrompt,
    buildSystemPrompt: () => basePrompt,
    // Preserve the original profile for the Huangshan-specific builder/backend.
    huangshanProfile: profile,
  })
}

function buildHuangshanBasePrompt(profile) {
  return `You are an expert embedded engineer for the ${profile.name} (${profile.chip}).
Framework: ${profile.framework}. Build with SCons against target ${profile.targetBoard}.
Display: ${profile.display.panel} ${profile.display.controller} ${profile.display.resolution.width}x${profile.display.resolution.height} over ${profile.display.interface}.
Memory: ${profile.memory.sram}, ${profile.memory.psram}, ${profile.memory.flash}.
Generate RT-Thread application code that matches the verified Huangshan workspace conventions.`
}
