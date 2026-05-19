export const spiSkill = {
  id: 'spi',
  label: 'SPI 外设',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## SPI

### 引脚
- SCK  = D8  (P1.13)
- MISO = D9  (P1.14)
- MOSI = D10 (P1.15)

### 基础用法
\`\`\`cpp
#include <SPI.h>

void setup() {
  SPI.begin();           // 默认 SCK/MISO/MOSI
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
  digitalWrite(D2, LOW); // CS 选通（用任意空闲 GPIO）
  SPI.transfer(0xAA);
  digitalWrite(D2, HIGH);
  SPI.endTransaction();
}
\`\`\`

### Pitfalls
- CS 用任意空闲 GPIO 控制，SPI 库不管理 CS
- 最大 SPI 速度约 32MHz（nRF52840）
- D8-D10 为 SPI 专用，不可同时用作其他功能`}
