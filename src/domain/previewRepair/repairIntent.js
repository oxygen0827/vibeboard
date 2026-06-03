import { DIGITAL_TWIN_MANIFEST_KEY } from '../digitalTwin/uiManifest'

const DEFAULT_PLACEHOLDER_PATTERNS = [
  /Place your ESP-IDF code here/i,
  /Hello from ESP32-Vibe-Coder/i,
]

const SURFACE_PATTERNS = [
  /preview/i,
  /screen/i,
  /\bui\b/i,
  /layout/i,
  /button/i,
  /slider/i,
  /tap/i,
  /touch/i,
  /text/i,
  /label/i,
  /color/i,
  /size/i,
  /position/i,
  /align/i,
  /overlap/i,
  /blocked/i,
  /clear/i,
  /预览/,
  /界面/,
  /屏幕/,
  /画面/,
  /按钮/,
  /滑块/,
  /文案/,
  /文字/,
  /布局/,
  /位置/,
  /颜色/,
  /大小/,
  /对齐/,
  /点击/,
  /触摸/,
]

const ISSUE_PATTERNS = [
  /fix/i,
  /repair/i,
  /adjust/i,
  /change/i,
  /move/i,
  /resize/i,
  /unclear/i,
  /not clear/i,
  /too small/i,
  /too large/i,
  /wrong/i,
  /not working/i,
  /does not work/i,
  /no response/i,
  /overlap/i,
  /blocked/i,
  /看不清/,
  /不清楚/,
  /挡住/,
  /遮挡/,
  /太小/,
  /太大/,
  /不对/,
  /错位/,
  /偏了/,
  /重叠/,
  /没反应/,
  /无反应/,
  /没有反应/,
  /不显示/,
  /不好看/,
  /难看/,
  /修复/,
  /调整/,
  /修改/,
  /改成/,
  /挪/,
  /移动/,
  /放大/,
  /缩小/,
]

function editableEntries(projectFiles = {}) {
  return Object.entries(projectFiles || {}).filter(([path, content]) =>
    !String(path).startsWith('__') && typeof content === 'string'
  )
}

function sourceText(projectFiles = {}) {
  return editableEntries(projectFiles)
    .filter(([path]) => /\.(c|cc|cpp|cxx|h|hpp)$/i.test(path))
    .map(([, content]) => content)
    .join('\n')
}

function hasAnyPattern(text, patterns) {
  return patterns.some(pattern => pattern.test(text))
}

export function hasEditableProject(projectFiles = {}, manifest = null) {
  const entries = editableEntries(projectFiles)
  if (entries.length === 0) return false

  const onlyDefaultMain = entries.length === 1 &&
    entries[0][0] === 'main/main.c' &&
    hasAnyPattern(entries[0][1], DEFAULT_PLACEHOLDER_PATTERNS)
  if (onlyDefaultMain) return false

  if (manifest?.files?.length) return true
  if (projectFiles[DIGITAL_TWIN_MANIFEST_KEY]) return true
  if (entries.length > 1) return true

  return /\b(app_ui_create|app_ui_start|bsp_lvgl_start|lv_\w+|lcd_draw_|esp_wifi_|audio_player_|bsp_camera_init)\b/i
    .test(sourceText(projectFiles))
}

export function isLikelyPreviewRepairRequest({
  text,
  projectFiles = {},
  manifest = null,
  previewContext = null,
} = {}) {
  const prompt = String(text || '').trim()
  if (!prompt || !hasEditableProject(projectFiles, manifest)) return false

  const mentionsSurface = hasAnyPattern(prompt, SURFACE_PATTERNS)
  const mentionsIssue = hasAnyPattern(prompt, ISSUE_PATTERNS)
  const hasPreviewableContext = Boolean(
    previewContext?.hasSource ||
    previewContext?.uiManifest ||
    manifest?.preview ||
    projectFiles[DIGITAL_TWIN_MANIFEST_KEY],
  )

  return mentionsIssue && (mentionsSurface || hasPreviewableContext)
}

export function classifyPreviewFeedback(text = '') {
  const prompt = String(text)
  if (/没反应|无反应|没有反应|not working|does not work|no response|tap|touch|点击|触摸/i.test(prompt)) {
    return 'interaction'
  }
  if (/挡住|遮挡|overlap|blocked|错位|位置|move|position|align|布局/i.test(prompt)) {
    return 'layout'
  }
  if (/看不清|不清楚|unclear|clear|颜色|color|文字|文案|text|label/i.test(prompt)) {
    return 'legibility'
  }
  if (/太小|太大|size|resize|放大|缩小/i.test(prompt)) {
    return 'sizing'
  }
  return 'preview-feedback'
}

export function buildPreviewFeedbackEvidence({
  userFeedback,
  projectFiles = {},
  previewContext = null,
  activeFile = '',
} = {}) {
  return {
    category: 'user-preview-feedback',
    feedbackType: classifyPreviewFeedback(userFeedback),
    userFeedback: String(userFeedback || '').trim(),
    activeFile,
    editablePaths: editableEntries(projectFiles).map(([path]) => path),
    currentPreview: previewContext || null,
  }
}
