export const uartSkill = {
  id: 'uart',
  label: 'UART 串口',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## UART 串口

### 引脚
- Serial1 TX = D6 (P1.11)
- Serial1 RX = D7 (P1.12)
- Serial（原生 USB CDC）= USB-C

### 基础用法
\`\`\`cpp
void setup() {
  Serial.begin(115200);    // USB-C 虚拟串口
  Serial1.begin(115200);   // D6(TX) / D7(RX) 硬件串口
}

void loop() {
  Serial.println("Hello over USB!");
  Serial1.println("Hello over UART!");
  delay(1000);
}
\`\`\`

### 串口通信
\`\`\`cpp
if (Serial1.available()) {
  char c = Serial1.read();
  Serial1.write(c);  // echo back
}
\`\`\`

### Pitfalls
- Serial 是原生 USB，不是硬件 UART — 波特率不影响 USB
- Serial1 使用 P1.11/P1.12，不是 P0.26/P0.27
- nRF52 的 UART 支持自动波特率检测`}
