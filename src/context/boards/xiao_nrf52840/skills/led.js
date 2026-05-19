export const ledSkill = {
  id: 'led',
  label: 'RGB LED (GPIO)',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## 板载 RGB LED（三路独立 GPIO）

XIAO nRF52840 Sense 使用三个独立的 GPIO 驱动 RGB LED，**不是** WS2812/NeoPixel。

### 引脚
\`\`\`cpp
#define LED_R  P0_26   // 红色
#define LED_G  P0_30   // 绿色
#define LED_B  P0_06   // 蓝色
\`\`\`

### 基础用法（typical active LOW）
\`\`\`cpp
void setup() {
  pinMode(P0_26, OUTPUT);
  pinMode(P0_30, OUTPUT);
  pinMode(P0_06, OUTPUT);
  // 全部熄灭（HIGH = OFF）
  digitalWrite(P0_26, HIGH);
  digitalWrite(P0_30, HIGH);
  digitalWrite(P0_06, HIGH);
}

void loop() {
  digitalWrite(P0_26, LOW); delay(500);  // 红灯亮
  digitalWrite(P0_26, HIGH);             // 红灯灭
  digitalWrite(P0_30, LOW); delay(500);  // 绿灯亮
  digitalWrite(P0_30, HIGH);             // 绿灯灭
  digitalWrite(P0_06, LOW); delay(500);  // 蓝灯亮
  digitalWrite(P0_06, HIGH);             // 蓝灯灭
}
\`\`\`

### 合成颜色（PWM 调光）
\`\`\`cpp
// nRF52 任意 GPIO 都支持 analogWrite
analogWrite(P0_26, 128);  // 50% 亮度红
analogWrite(P0_30, 255);  // 绿灯关
analogWrite(P0_06, 0);    // 蓝灯全亮
\`\`\`

### Pitfalls
- 这是三个独立 GPIO，不是 WS2812！禁用 Adafruit_NeoPixel
- 典型极性：LOW=亮，HIGH=灭（由外置三极管控制）
- P0_06 同时也是 I2C SDA 的复用引脚 — 使用 I2C 时蓝色 LED 可能闪烁
- analogWrite 频率约 488Hz（nRF52 Arduino 默认）`}
