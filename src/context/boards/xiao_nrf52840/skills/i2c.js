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
- SDA = D2 (P0.04)
- SCL = D3 (P0.05)

### 基础用法
\`\`\`cpp
#include <Wire.h>
void setup() {
  Wire.begin();  // SDA=D2, SCL=D3 (default)
  Wire.setClock(400000);  // 400kHz fast mode
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
\`\`\`

### 读取传感器（示例：BMP280）
\`\`\`cpp
#include <Wire.h>
#include <Adafruit_BMP280.h>
Adafruit_BMP280 bmp;
void setup() {
  Wire.begin(); Serial.begin(115200);
  if (bmp.begin(0x76)) {
    Serial.print("Temp: "); Serial.print(bmp.readTemperature());
    Serial.print(" Press: "); Serial.println(bmp.readPressure());
  }
}
\`\`\`

### Pitfalls
- XIAO has only ONE I2C bus (Wire) — cannot have two simultaneous I2C buses
- SDA/SCL pull-ups are on board (4.7kΩ) — no external resistors needed
- 5V I2C devices need level shifting — nRF52 is 3.3V only
- Wire.setClock() must be called AFTER Wire.begin()`,
}
