export async function listRemoteDevices() {
  const res = await fetch('/api/devices')
  if (!res.ok) throw new Error(`加载远程设备失败: HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.devices) ? data.devices : []
}

export async function listRemoteJobs() {
  const res = await fetch('/api/ota-jobs')
  if (!res.ok) throw new Error(`加载远程 OTA 任务失败: HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.jobs) ? data.jobs : []
}

export async function uploadFirmwareForRemoteOta(firmware) {
  if (!firmware) throw new Error('没有可上传的固件，请先编译成功。')
  const form = new FormData()
  form.append('file', firmware, firmware.firmwareFilename || 'firmware.bin')
  const res = await fetch('/api/firmware', {
    method: 'POST',
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `上传固件失败: HTTP ${res.status}`)
  return data.firmware
}

export async function createRemoteOtaJob({ deviceId, firmwareId }) {
  const res = await fetch('/api/ota-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, firmwareId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `创建远程 OTA 任务失败: HTTP ${res.status}`)
  return data.job
}

export async function getRemoteOtaJob(jobId) {
  const res = await fetch(`/api/ota-jobs/${jobId}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `查询远程 OTA 任务失败: HTTP ${res.status}`)
  return data.job
}

export function isDeviceOnline(device, now = Date.now()) {
  return !!device?.lastSeenAt && now - device.lastSeenAt < 30000
}
