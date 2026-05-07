export const i2cSkill = {
  id: 'i2c',
  label: 'I2C 传感器',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## I2C 外设 (Wire)

### 引脚
- SDA = D4 (P0.04)
- SCL = D5 (P0.05)

### 基础用法
\`\`\`cpp
#include <Wire.h>

void setup() {
  Wire.begin();             // SDA=D4, SCL=D5
  Wire.setClock(400000);    // 400kHz 快速模式
  Serial.begin(115200);

  // 扫描 I2C 设备
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Found I2C: 0x");
      Serial.println(addr, HEX);
    }
  }
}

void loop() {}
\`\`\`

### 板载 I2C 设备
- IMU LSM6DS3TR  @ 0x6A
- 可通过 I2C 连接外部传感器

### Pitfalls
- XIAO 只有一路 I2C 总线（Wire）
- SDA/SCL 板载 4.7kΩ 上拉
- 5V I2C 设备需电平转换
- I2C 引脚同时也是 GPIO 和模拟输入 — 使用 I2C 时不可作其他用途`}
