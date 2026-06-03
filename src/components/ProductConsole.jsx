import { useEffect, useMemo, useState } from 'react'
import { formatLastSeen, isDeviceOnline, listRemoteDevices } from '../utils/remoteOta'
import './ProductConsole.css'

const SNAPSHOT_KEY = 'vibeboard-project-snapshots'

const MARKET_PROJECTS = [
  {
    title: '桌面 WiFi 状态屏',
    type: '模板',
    status: '待接入市场',
    assets: ['固件包', '教程', 'BOM'],
  },
  {
    title: '触摸 MP3 播放器',
    type: '套件项目',
    status: '待审核',
    assets: ['源码', '外壳文件', '演示视频'],
  },
  {
    title: '摄像头 LCD 预览器',
    type: '进阶项目',
    status: '缺少商品页',
    assets: ['官方例程', '固件包'],
  },
]

const PLANS = [
  { name: '免费版', quota: '少量 AI 改造 / 基础固件下载', target: '体验用户' },
  { name: '个人版', quota: '更多 AI 调用 / 云编译额度 / 私有项目', target: '创作者' },
  { name: '教育版', quota: '班级管理 / 课程模板 / 统一额度', target: '学校和机构' },
  { name: '企业版', quota: '团队空间 / 私有部署 / 设备管理', target: '企业原型团队' },
]

function loadSnapshots() {
  try {
    const data = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveSnapshots(snapshots) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots))
}

export default function ProductConsole({ board, boardId, selectedSkills = [], projectFiles = {} }) {
  const [snapshots, setSnapshots] = useState(loadSnapshots)
  const [devices, setDevices] = useState([])
  const [deviceError, setDeviceError] = useState('')

  const projectStats = useMemo(() => {
    const files = Object.keys(projectFiles || {})
    return {
      fileCount: files.length,
      sourceCount: files.filter(path => /\.(c|cpp|h|hpp)$/i.test(path)).length,
      skillCount: selectedSkills.length,
    }
  }, [projectFiles, selectedSkills])

  async function refreshDevices() {
    try {
      setDeviceError('')
      setDevices(await listRemoteDevices())
    } catch (err) {
      setDeviceError(err.message || '设备列表加载失败')
      setDevices([])
    }
  }

  useEffect(() => {
    refreshDevices()
    const timer = setInterval(refreshDevices, 10000)
    return () => clearInterval(timer)
  }, [])

  function saveCurrentProject() {
    const snapshot = {
      id: `project-${Date.now()}`,
      name: `${board?.name || boardId} 项目`,
      boardId,
      skillIds: selectedSkills,
      fileCount: Object.keys(projectFiles || {}).length,
      createdAt: Date.now(),
    }
    const next = [snapshot, ...snapshots].slice(0, 12)
    setSnapshots(next)
    saveSnapshots(next)
  }

  return (
    <div className="product-console">
      <section className="pc-section">
        <div className="pc-section-head">
          <div>
            <h3>项目空间</h3>
            <p>普通版先保存本地快照，后续接用户账号和云同步。</p>
          </div>
          <button className="pc-action" onClick={saveCurrentProject}>保存快照</button>
        </div>
        <div className="pc-metrics">
          <div><strong>{projectStats.fileCount}</strong><span>工程文件</span></div>
          <div><strong>{projectStats.sourceCount}</strong><span>源码文件</span></div>
          <div><strong>{projectStats.skillCount}</strong><span>已选技能</span></div>
        </div>
        <div className="pc-list">
          {snapshots.length === 0 ? (
            <div className="pc-empty">暂无项目快照</div>
          ) : snapshots.map(item => (
            <div className="pc-row" key={item.id}>
              <div>
                <b>{item.name}</b>
                <span>{item.fileCount} 文件 · {item.skillIds.length} 技能</span>
              </div>
              <em>{new Date(item.createdAt).toLocaleString()}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="pc-section">
        <div className="pc-section-head">
          <div>
            <h3>项目市场</h3>
            <p>先展示可售项目形态，后续接审核、商品页和分成。</p>
          </div>
        </div>
        <div className="pc-card-grid">
          {MARKET_PROJECTS.map(project => (
            <article className="pc-card" key={project.title}>
              <div className="pc-card-top">
                <b>{project.title}</b>
                <span>{project.type}</span>
              </div>
              <p>{project.assets.join(' / ')}</p>
              <em>{project.status}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="pc-section">
        <div className="pc-section-head">
          <div>
            <h3>订阅方案</h3>
            <p>商业计划中的额度和版本先固化为产品结构。</p>
          </div>
        </div>
        <div className="pc-plan-list">
          {PLANS.map(plan => (
            <div className="pc-plan" key={plan.name}>
              <b>{plan.name}</b>
              <span>{plan.quota}</span>
              <em>{plan.target}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="pc-section">
        <div className="pc-section-head">
          <div>
            <h3>设备后台</h3>
            <p>复用远程 OTA 设备心跳，后续扩展绑定、分组和批量 OTA。</p>
          </div>
          <button className="pc-action subtle" onClick={refreshDevices}>刷新</button>
        </div>
        {deviceError && <div className="pc-error">{deviceError}</div>}
        <div className="pc-list">
          {devices.length === 0 ? (
            <div className="pc-empty">暂无在线设备</div>
          ) : devices.map(device => (
            <div className="pc-row" key={device.deviceId}>
              <div>
                <b>{device.deviceId}</b>
                <span>{device.version || 'unknown'} · {device.ip || 'no ip'}</span>
              </div>
              <em className={isDeviceOnline(device) ? 'online' : ''}>{formatLastSeen(device.lastSeenAt)}</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
