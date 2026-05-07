export const nfcSkill = {
  id: 'nfc',
  label: 'NFC 天线',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## NFC 天线

### 引脚
- NFC1：P0.09
- NFC2：P0.10

### 说明
XIAO nRF52840 Sense 板载 NFC 天线引脚（PCB 边缘焊盘），需要外接 NFC 天线。

nRF52840 内置 NFC-A 标签：
- 兼容 ISO 14443A
- 可用作 NDEF 标签
- 唤醒功能：NFC 场可唤醒处于睡眠模式的设备

### 基础用法
\`\`\`cpp
// nRF52 NFC 需使用 Nordic 的 NFC 库
// 通常 nfc_configure() 在 bootloader 阶段已配置
// 应用层通过 NFC 唤醒功能实现低功耗交互
\`\`\`

### Pitfalls
- 需要外接 NFC 天线（13.56MHz）
- NFC 功能与 GPIO 冲突 — 使用 NFC 时 P0.09/P0.10 不可作 GPIO
- Arduino 中 NFC 支持有限，复杂 NFC 应用建议使用 nRF5 SDK`}
