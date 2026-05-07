export const neopixelSkill = {
  id: 'neopixel',
  label: 'RGB LED (NeoPixel)',
  projectConfig: {
    srcs: [],
    arduinoLibraries: ['Adafruit NeoPixel'],
    buildFlags: [],
  },
  systemPrompt: `## 板载 WS2812 RGB LED

### 初始化
\`\`\`cpp
#include <Adafruit_NeoPixel.h>
#define LED_PIN    D14    // P0.17
#define NUM_PIXELS 1
Adafruit_NeoPixel pixels(NUM_PIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  pixels.begin();
}
\`\`\`

### 设置颜色
\`\`\`cpp
pixels.setPixelColor(0, pixels.Color(255, 0, 0));  // 红
pixels.show();
\`\`\`

### 常用颜色
\`\`\`cpp
pixels.Color(255, 0, 0)     // 红
pixels.Color(0, 255, 0)     // 绿
pixels.Color(0, 0, 255)     // 蓝
pixels.Color(255, 255, 255) // 白
pixels.Color(0, 0, 0)       // 灭
\`\`\`

### Pitfalls
- DO NOT use pinMode(D14, OUTPUT) — NeoPixel data line is NOT a regular GPIO
- D14 pin needs 3.3V logic; Adafruit_NeoPixel handles this
- For XIAO nRF52840 (non-Sense), this is the ONLY onboard LED`,
}
