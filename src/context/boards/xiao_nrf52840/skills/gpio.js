export const gpioSkill = {
  id: 'gpio',
  label: 'GPIO / 按键',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## GPIO & 按键 (Arduino)

### 可用 GPIO（引脚头 D0-D10）
\`\`\`cpp
D0 = P0.02  — 模拟输入 AIN0
D1 = P0.03  — 模拟输入 AIN1
D2 = P0.28  — 模拟输入 AIN4
D3 = P0.29  — 模拟输入 AIN5
D4 = P0.04  — I2C SDA（默认给 I2C 用）
D5 = P0.05  — I2C SCL（默认给 I2C 用）
D6 = P1.11  — UART TX
D7 = P1.12  — UART RX
D8 = P1.13  — SPI SCK
D9 = P1.14  — SPI MISO
D10 = P1.15 — SPI MOSI
\`\`\`

### 数字输出
\`\`\`cpp
pinMode(D0, OUTPUT);
digitalWrite(D0, HIGH);
\`\`\`

### 数字输入（带内部上拉）
\`\`\`cpp
pinMode(D3, INPUT_PULLUP);
int val = digitalRead(D3);
\`\`\`

### 模拟输入（nRF52 ADC 12-bit）
\`\`\`cpp
int val = analogRead(D0);  // 0-4095, 0-3.3V
\`\`\`

### PWM（nRF52 任意 GPIO 均支持）
\`\`\`cpp
analogWrite(D0, 128);  // 0-255, 约 488Hz
\`\`\`

### Pitfalls
- nRF52840 为 3.3V 逻辑，不可接 5V
- P0.14 为 ADC_BAT（电池电压），不可作为 GPIO
- P0.17 为 CHARGE_LED，由充电 IC 控制
- P0.09/P0.10 为 NFC 天线引脚`}
