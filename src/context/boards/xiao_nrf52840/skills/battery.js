export const batterySkill = {
  id: 'battery',
  label: '电池 / 充电',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## 电池管理 (BQ25101)

Seeed XIAO nRF52840 Sense 板载 BQ25101 充电芯片。

### ADC_BAT
\`\`\`cpp
// P0.14 连接到电池电压分压电路
int raw = analogRead(P0_14);  // nRF52 ADC 12-bit, 0-4095
float voltage = raw * (3.6 / 4095.0) * 2;  // 估算电池电压（分压比约 1:2）
\`\`\`

### 充电电流选择
\`\`\`cpp
// P0.13 控制充电电流
pinMode(P0_13, OUTPUT);

// 50mA 充电（默认）
digitalWrite(P0_13, HIGH);  // 输入模式 + 高电平

// 100mA 充电
digitalWrite(P0_13, LOW);   // 输出模式 + 低电平
\`\`\`

### CHARGE_LED (P0.17)
- LOW = 正在充电
- HIGH = 未充电或充满

### Pitfalls
- 无内置电量计，只能通过电压估算
- LiPo 充满 4.2V，保护板切断约 3.0V
- 建议低电压报警 < 3.3V
- P0.13 默认是 ADC 功能引脚，需注意配置
- ADC_BAT 分压电路在 XIAO Sense 上有已知的 errata，P0.14 为高电平时可能损坏 P0.31`}
