import { useMemo, useState } from 'react'
import { DIGITAL_TWIN_SCENES, detectDigitalTwinScene } from '../domain/digitalTwin/detectScene'
import { DIGITAL_TWIN_MANIFEST_KEY } from '../domain/digitalTwin/uiManifest'
import './DigitalTwinPreview.css'

const SCENE_LABELS = {
  [DIGITAL_TWIN_SCENES.EMPTY]: '等待工程',
  [DIGITAL_TWIN_SCENES.GPIO]: 'BOOT 按键',
  [DIGITAL_TWIN_SCENES.IMU]: 'QMI8658 姿态',
  [DIGITAL_TWIN_SCENES.STORAGE]: 'SD / SPIFFS',
  [DIGITAL_TWIN_SCENES.AUDIO_INPUT]: 'ES7210 录音',
  [DIGITAL_TWIN_SCENES.AUDIO_OUTPUT]: 'ES8311 播放',
  [DIGITAL_TWIN_SCENES.LCD_BITMAP]: 'LCD 图片',
  [DIGITAL_TWIN_SCENES.CAMERA_LCD]: 'Camera -> LCD',
  [DIGITAL_TWIN_SCENES.LVGL_DEMO]: 'LVGL Demo',
  [DIGITAL_TWIN_SCENES.WIFI_CONNECT]: 'WiFi 连接 UI',
  [DIGITAL_TWIN_SCENES.BLE_HID]: 'BLE HID',
  [DIGITAL_TWIN_SCENES.MP3_PLAYER]: 'MP3 Player',
  [DIGITAL_TWIN_SCENES.SPEECH_RECOGNITION]: '语音识别',
}

const MOCK_SSIDS = ['VibeBoard-Lab', 'SZPI-Office', 'Maker-2G', 'ESP32-Test']
const MOCK_TRACKS = ['Canon.mp3', 'For_Elise.mp3', 'new_epic.mp3']

function capabilityItems(capabilities) {
  return [
    ['display', 'LCD'],
    ['touch', 'Touch'],
    ['wifi', 'WiFi'],
    ['ble', 'BLE'],
    ['audio', 'Audio'],
    ['camera', 'Camera'],
    ['imu', 'IMU'],
    ['storage', 'Storage'],
    ['speech', 'Speech'],
    ['gpio', 'GPIO'],
  ].map(([key, label]) => ({ key, label, active: Boolean(capabilities[key]) }))
}

function addLog(logs, line) {
  return [`${new Date().toLocaleTimeString()} ${line}`, ...logs].slice(0, 5)
}

function WifiScreen({ wifiState, setWifiState, setLogs }) {
  function connect(ssid) {
    setWifiState({ page: 'connecting', ssid, password: '******' })
    setLogs(logs => addLog(logs, `WiFi account queued: ${ssid}`))
    window.setTimeout(() => {
      setWifiState({ page: 'connected', ssid, ip: '192.168.1.53' })
      setLogs(logs => addLog(logs, `Got IP: 192.168.1.53`))
    }, 700)
  }

  if (wifiState.page === 'connecting') {
    return (
      <div className="dt-screen-page dt-center">
        <div className="dt-wifi-icon">WLAN</div>
        <div className="dt-title">WLAN连接中...</div>
        <div className="dt-subtitle">{wifiState.ssid}</div>
      </div>
    )
  }

  if (wifiState.page === 'connected') {
    return (
      <div className="dt-screen-page dt-center">
        <div className="dt-ok-ring">OK</div>
        <div className="dt-title">WLAN已连接</div>
        <div className="dt-subtitle">{wifiState.ssid}</div>
        <div className="dt-ip">{wifiState.ip}</div>
      </div>
    )
  }

  return (
    <div className="dt-screen-page">
      <div className="dt-screen-header">WLAN扫描</div>
      <div className="dt-wifi-list">
        {MOCK_SSIDS.map(ssid => (
          <button key={ssid} className="dt-wifi-row" onClick={() => connect(ssid)}>
            <span>{ssid}</span>
            <span>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Mp3Screen({ mp3State, setMp3State, setLogs }) {
  const track = MOCK_TRACKS[mp3State.trackIndex]
  function setTrack(delta) {
    const next = (mp3State.trackIndex + delta + MOCK_TRACKS.length) % MOCK_TRACKS.length
    setMp3State(state => ({ ...state, trackIndex: next }))
    setLogs(logs => addLog(logs, `switching index to ${next}`))
  }
  function togglePlay() {
    setMp3State(state => ({ ...state, playing: !state.playing }))
    setLogs(logs => addLog(logs, mp3State.playing ? 'AUDIO_PLAYER_REQUEST_PAUSE' : `Playing ${track}`))
  }
  return (
    <div className="dt-screen-page dt-mp3">
      <div className="dt-album-art">
        <div className="dt-disc" />
      </div>
      <div className="dt-track-title">{track}</div>
      <select
        className="dt-select"
        value={mp3State.trackIndex}
        onChange={e => setMp3State(state => ({ ...state, trackIndex: Number(e.target.value) }))}
      >
        {MOCK_TRACKS.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </select>
      <div className="dt-player-controls">
        <button onClick={() => setTrack(-1)}>‹</button>
        <button className="dt-play" onClick={togglePlay}>{mp3State.playing ? 'Ⅱ' : '▶'}</button>
        <button onClick={() => setTrack(1)}>›</button>
      </div>
      <div className="dt-volume-row">
        <span>VOL</span>
        <input
          type="range"
          min="0"
          max="100"
          value={mp3State.volume}
          onChange={e => {
            setMp3State(state => ({ ...state, volume: Number(e.target.value) }))
            setLogs(logs => addLog(logs, `volume ${e.target.value}`))
          }}
        />
      </div>
    </div>
  )
}

function CameraScreen() {
  return (
    <div className="dt-camera-feed">
      <div className="dt-camera-grid" />
      <div className="dt-camera-subject" />
      <div className="dt-camera-label">GC0308 Preview</div>
    </div>
  )
}

function LcdScreen({ scene }) {
  if (scene === DIGITAL_TWIN_SCENES.CAMERA_LCD) return <CameraScreen />
  if (scene === DIGITAL_TWIN_SCENES.LCD_BITMAP) {
    return (
      <div className="dt-bitmap">
        <div className="dt-bitmap-sun" />
        <div className="dt-bitmap-hill a" />
        <div className="dt-bitmap-hill b" />
        <span>320x240 RGB565</span>
      </div>
    )
  }
  return (
    <div className="dt-lvgl-demo">
      <div className="dt-widget-card">
        <div className="dt-widget-title">LVGL Widgets</div>
        <div className="dt-widget-slider"><span /></div>
        <div className="dt-widget-buttons"><button>OK</button><button>SET</button></div>
      </div>
    </div>
  )
}

function GenericScreen({ scene, setLogs }) {
  if (scene === DIGITAL_TWIN_SCENES.GPIO) {
    return (
      <div className="dt-screen-page dt-center">
        <button className="dt-boot-btn" onClick={() => setLogs(logs => addLog(logs, 'BOOT button interrupt'))}>BOOT</button>
        <div className="dt-subtitle">GPIO0 active low</div>
      </div>
    )
  }
  if (scene === DIGITAL_TWIN_SCENES.IMU) {
    return (
      <div className="dt-screen-page dt-center">
        <div className="dt-imu-cube" />
        <div className="dt-subtitle">Pitch 12° / Roll -4°</div>
      </div>
    )
  }
  if (scene === DIGITAL_TWIN_SCENES.SPEECH_RECOGNITION) {
    return (
      <div className="dt-screen-page dt-center">
        <div className="dt-mic-pulse">SR</div>
        <div className="dt-title">等待命令词</div>
        <button className="dt-small-action" onClick={() => setLogs(logs => addLog(logs, 'command detected: play music'))}>触发语音</button>
      </div>
    )
  }
  return (
    <div className="dt-screen-page dt-center">
      <div className="dt-title">数字孪生待机</div>
      <div className="dt-subtitle">生成 LVGL / LCD / 外设代码后显示预览</div>
    </div>
  )
}

function ManifestWidget({ widget, setLogs }) {
  const style = {
    left: `${(widget.x / 320) * 100}%`,
    top: `${(widget.y / 240) * 100}%`,
    width: `${(widget.w / 320) * 100}%`,
    height: `${(widget.h / 240) * 100}%`,
    color: widget.color || undefined,
  }
  const text = widget.text || widget.id

  if (widget.type === 'button') {
    return <button className="dt-manifest-widget dt-manifest-button" style={style} onClick={() => setLogs(logs => addLog(logs, widget.action || `${widget.id} clicked`))}>{text}</button>
  }
  if (widget.type === 'slider') {
    return (
      <div className="dt-manifest-widget dt-manifest-slider" style={style}>
        <span style={{ width: `${widget.value || 50}%` }} />
      </div>
    )
  }
  if (widget.type === 'dropdown') {
    return (
      <select className="dt-manifest-widget dt-manifest-select" style={style} defaultValue={widget.options[0] || ''}>
        {(widget.options.length ? widget.options : [text]).map(option => <option key={option}>{option}</option>)}
      </select>
    )
  }
  if (widget.type === 'textarea') {
    return <input className="dt-manifest-widget dt-manifest-input" style={style} placeholder={text} />
  }
  if (widget.type === 'list') {
    const items = widget.options.length ? widget.options : [text]
    return (
      <div className="dt-manifest-widget dt-manifest-list" style={style}>
        {items.map(item => <button key={item} onClick={() => setLogs(logs => addLog(logs, `${widget.id}: ${item}`))}>{item}</button>)}
      </div>
    )
  }
  if (widget.type === 'image') {
    return (
      <div className="dt-manifest-widget dt-manifest-image" style={style}>
        <span>{text || 'IMG'}</span>
      </div>
    )
  }
  if (widget.type === 'status') {
    return <div className="dt-manifest-widget dt-manifest-status" style={style}>{text}</div>
  }
  return <div className="dt-manifest-widget dt-manifest-label" style={style}>{text}</div>
}

function ManifestScreen({ manifest, setLogs }) {
  return (
    <div className="dt-manifest-screen" style={{ background: manifest.screen.background }}>
      {manifest.widgets.map(widget => (
        <ManifestWidget key={widget.id} widget={widget} setLogs={setLogs} />
      ))}
    </div>
  )
}

export default function DigitalTwinPreview({ files, selectedSkills = [], board }) {
  const uiManifest = files?.[DIGITAL_TWIN_MANIFEST_KEY]
  const analysis = useMemo(() => detectDigitalTwinScene(files, selectedSkills), [files, selectedSkills])
  const [wifiState, setWifiState] = useState({ page: 'scan' })
  const [mp3State, setMp3State] = useState({ trackIndex: 0, playing: false, volume: 72 })
  const [logs, setLogs] = useState(['digital twin ready'])
  const capabilities = capabilityItems(analysis.capabilities)

  return (
    <section className="digital-twin">
      <div className="dt-topbar">
        <div>
          <div className="dt-kicker">Digital Twin · {uiManifest ? 'Semantic Preview' : 'Scene Mock'}</div>
          <div className="dt-title-row">{uiManifest?.title || SCENE_LABELS[analysis.scene] || '未知场景'}</div>
        </div>
        <div className="dt-board-chip">{board?.chip || 'ESP32-S3'} · 320x240</div>
      </div>
      <div className="dt-body">
        <div className="dt-device">
          <div className="dt-product">
            <div className="dt-enclosure">
              <div className="dt-top-face">
                <div className="dt-control-pad">
                  {Array.from({ length: 8 }).map((_, index) => <span key={index} />)}
                </div>
                <div className="dt-led-dot" />
              </div>
              <div className="dt-screen-bezel">
                <div className="dt-screen">
                  {uiManifest ? (
                    <ManifestScreen manifest={uiManifest} setLogs={setLogs} />
                  ) : analysis.scene === DIGITAL_TWIN_SCENES.WIFI_CONNECT ? (
                    <WifiScreen wifiState={wifiState} setWifiState={setWifiState} setLogs={setLogs} />
                  ) : analysis.scene === DIGITAL_TWIN_SCENES.MP3_PLAYER ? (
                    <Mp3Screen mp3State={mp3State} setMp3State={setMp3State} setLogs={setLogs} />
                  ) : [
                    DIGITAL_TWIN_SCENES.LCD_BITMAP,
                    DIGITAL_TWIN_SCENES.CAMERA_LCD,
                    DIGITAL_TWIN_SCENES.LVGL_DEMO,
                  ].includes(analysis.scene) ? (
                    <LcdScreen scene={analysis.scene} />
                  ) : (
                    <GenericScreen scene={analysis.scene} setLogs={setLogs} />
                  )}
                </div>
              </div>
              <div className="dt-side-face">
                <div className="dt-port large" />
                <div className="dt-port small" />
              </div>
              <div className="dt-front-face">
                <div className="dt-usb-c" />
                <div className="dt-pin-hole" />
              </div>
            </div>
          </div>
        </div>
        <div className="dt-side">
          <div className="dt-capabilities">
            {capabilities.map(item => (
              <span key={item.key} className={`dt-cap ${item.active ? 'active' : ''}`}>{item.label}</span>
            ))}
          </div>
          <div className="dt-log">
            {logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
          </div>
        </div>
      </div>
    </section>
  )
}
