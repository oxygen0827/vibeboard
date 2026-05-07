export const batterySkill = {
  id: 'battery',
  label: '电池 / 充电',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## 电池管理 (BQ25101)

Seeed XIAO nRF52840 板载 BQ25101 充电芯片，支持 LiPo 电池。

### 电压测量
\`\`\`cpp
float readBatteryVoltage() {
  int raw = analogRead(A0);     // 0-1023
  float mv = raw * (3300.0 / 1023.0);
  // 分压比取决于具体电路，通常约 1:2
  return mv * 2.0 / 1000.0;     // 转为伏特
}
\`\`\`

### Pitfalls
- 没有内置电量计 — 只能通过电压估算电量
- LiPo 最低放电电压 3.3V（保护板切断）
- 充满电压 4.2V，3.7V 标称
- 建议加低电压报警（<3.5V）`,
}
