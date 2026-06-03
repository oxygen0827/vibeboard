export const DEFAULT_LVGL_DESIGN_PROFILE_ID = 'compact_control_panel'

export const SZPI_LVGL_DESIGN_PROFILES = [
  {
    id: 'compact_control_panel',
    label: 'Compact Control Panel',
    bestFor: ['GPIO controls', 'BLE HID buttons', 'simple status screens'],
    layout: 'Top status row, two or three primary touch controls, compact bottom telemetry.',
    widgets: ['button', 'label', 'status', 'slider'],
    constraints: [
      'Use 44px or larger touch targets.',
      'Keep controls visible without scrolling.',
      'Use explicit root background and simple high-contrast grouping.',
    ],
  },
  {
    id: 'setup_wizard',
    label: 'Setup Wizard',
    bestFor: ['WiFi scan/connect', 'credential entry', 'step-by-step setup'],
    layout: 'Small title/status header, central list or input region, bottom action row.',
    widgets: ['list', 'textarea', 'button', 'label', 'status'],
    constraints: [
      'Fit password/input controls into 320x240 without keyboard assumptions.',
      'Use clear back/ok/delete controls.',
      'Reserve space for connection state feedback.',
    ],
  },
  {
    id: 'media_console',
    label: 'Media Console',
    bestFor: ['MP3 player', 'speaker playback', 'audio recorder monitor'],
    layout: 'Track or mode title at top, large centered transport controls, bottom volume/status strip.',
    widgets: ['button', 'slider', 'dropdown', 'label', 'status'],
    constraints: [
      'Use stable circular or square transport buttons.',
      'Keep volume control reachable at the bottom.',
      'Show current file/state even when playback is idle.',
    ],
  },
  {
    id: 'sensor_dashboard',
    label: 'Sensor Dashboard',
    bestFor: ['IMU angles', 'microphone levels', 'system telemetry'],
    layout: 'Dense dashboard with metric tiles, trend bars, and a compact footer state.',
    widgets: ['label', 'slider', 'status'],
    constraints: [
      'Use no more than four metric groups on one screen.',
      'Prefer numbers and short labels over paragraphs.',
      'Avoid tiny text below the default 20px font unless purely decorative.',
    ],
  },
  {
    id: 'camera_overlay',
    label: 'Camera Overlay',
    bestFor: ['camera preview controls', 'vision status overlays'],
    layout: 'Full-screen preview placeholder with thin top/bottom overlay controls.',
    widgets: ['image', 'button', 'label', 'status'],
    constraints: [
      'Treat the camera image as a placeholder in LVGL draft mode.',
      'Do not block the central preview area with large controls.',
      'Use compact overlay labels for FPS, mode, or detection state.',
    ],
  },
]

export function getLvglDesignProfileById(id) {
  return SZPI_LVGL_DESIGN_PROFILES.find(profile => profile.id === id) || null
}

export function normalizeLvglDesignProfileId(id) {
  return getLvglDesignProfileById(id)?.id || DEFAULT_LVGL_DESIGN_PROFILE_ID
}

export function formatLvglDesignProfilesForPrompt() {
  return SZPI_LVGL_DESIGN_PROFILES.map(profile => [
    `- ${profile.id}: ${profile.label}`,
    `  bestFor: ${profile.bestFor.join(', ')}`,
    `  layout: ${profile.layout}`,
    `  widgets: ${profile.widgets.join(', ')}`,
    `  constraints: ${profile.constraints.join('; ')}`,
  ].join('\n')).join('\n')
}
