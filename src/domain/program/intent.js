export const PROGRAM_INTENT_SCHEMA_VERSION = 1

const SKILL_KEYWORDS = {
  gpio: [
    /boot|按键|按钮|key|button|gpio0|gpio|中断|interrupt/i,
  ],
  lvgl: [
    /触摸|触屏|touch|ui|界面|屏幕|显示|slider|下拉|dropdown|lvgl|lcd/i,
  ],
  audio: [
    /mp3|音乐|播放器|播放|音频|声音|喇叭|扬声器|speaker|audio|codec|es8311|spiffs/i,
  ],
  wifi: [
    /wifi|wi-fi|无线|联网|网络|http|ota|远程|heartbeat|心跳/i,
  ],
  ble: [
    /ble|蓝牙|hid|keyboard|键盘/i,
  ],
  camera: [
    /摄像头|相机|camera|拍照|预览|gc0308/i,
  ],
  imu: [
    /imu|姿态|加速度|陀螺仪|qmi8658|倾角/i,
  ],
  sdcard: [
    /sd\s*卡|micro\s*sd|sdmmc|存储卡|文件系统/i,
  ],
  speech: [
    /语音识别|唤醒词|esp-sr|speech|wakenet|命令词/i,
  ],
  vision: [
    /人脸|目标检测|yolo|face|detect|识别画面/i,
  ],
}

const SKILL_CO_REQUIREMENTS = {
  audio: ['lvgl'],
  wifi: ['lvgl'],
  ble: ['lvgl'],
  speech: ['audio', 'lvgl'],
  vision: ['camera'],
}

const REQUIREMENT_KEYWORDS = {
  display: [
    /触摸|触屏|touch|ui|界面|屏幕|显示|slider|下拉|dropdown|lvgl|lcd/i,
  ],
  audio: [
    /mp3|音乐|播放器|播放|音频|声音|喇叭|扬声器|speaker|audio|codec|es8311/i,
  ],
  network: [
    /wifi|wi-fi|无线|联网|网络|http|ota|远程|heartbeat|心跳/i,
  ],
  camera: [
    /摄像头|相机|camera|拍照|预览|gc0308/i,
  ],
  storage: [
    /sd\s*卡|micro\s*sd|sdmmc|存储卡|文件系统|spiffs/i,
  ],
  ble: [
    /ble|蓝牙|hid|keyboard|键盘/i,
  ],
}

const REQUIREMENT_SKILLS = {
  display: ['lvgl'],
  audio: ['audio', 'speech'],
  network: ['wifi'],
  camera: ['camera', 'vision'],
  storage: ['sdcard'],
  ble: ['ble'],
}

function validSkillSet(board) {
  return new Set((board?.skills || []).map(skill => skill.id).filter(Boolean))
}

function normalizeSkillIds(board, selectedSkills = []) {
  const valid = validSkillSet(board)
  return [...new Set((selectedSkills || [])
    .filter(id => typeof id === 'string')
    .map(id => id.trim())
    .filter(id => id && valid.has(id)))]
}

export function inferSkillsFromRequest(board, userRequest, selectedSkills = []) {
  const valid = validSkillSet(board)
  const inferred = new Set(normalizeSkillIds(board, selectedSkills))
  const text = String(userRequest || '')

  for (const [skillId, patterns] of Object.entries(SKILL_KEYWORDS)) {
    if (!valid.has(skillId)) continue
    if (patterns.some(pattern => pattern.test(text))) inferred.add(skillId)
  }

  let changed = true
  while (changed) {
    changed = false
    for (const [skillId, required] of Object.entries(SKILL_CO_REQUIREMENTS)) {
      if (!inferred.has(skillId)) continue
      for (const requiredSkill of required) {
        if (valid.has(requiredSkill) && !inferred.has(requiredSkill)) {
          inferred.add(requiredSkill)
          changed = true
        }
      }
    }
  }

  return [...inferred]
}

function inferRequirements(board, text, skillIds) {
  const valid = validSkillSet(board)
  const selected = new Set(skillIds)
  const requirements = {}

  for (const [requirement, patterns] of Object.entries(REQUIREMENT_KEYWORDS)) {
    const fromText = patterns.some(pattern => pattern.test(text))
    const fromSkill = (REQUIREMENT_SKILLS[requirement] || [])
      .some(skillId => valid.has(skillId) && selected.has(skillId))
    if (fromText || fromSkill) requirements[requirement] = true
  }

  return requirements
}

function programNameFromText(text) {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return ascii || 'vibe_app'
}

export function createProgramIntent({ board, boardId = board?.id || '', userRequest = '', selectedSkills = [] } = {}) {
  const request = String(userRequest || '').trim()
  const skillIds = inferSkillsFromRequest(board, request, selectedSkills)
  return {
    schemaVersion: PROGRAM_INTENT_SCHEMA_VERSION,
    boardId: boardId || board?.id || '',
    request,
    programNameHint: programNameFromText(request),
    skillIds,
    requires: inferRequirements(board, request, skillIds),
  }
}
