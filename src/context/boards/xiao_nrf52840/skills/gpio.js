export const gpioSkill = {
  id: 'gpio',
  label: 'GPIO / 按键',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## GPIO & 按键 (Arduino)

### 数字输出
\`\`\`cpp
pinMode(D10, OUTPUT);
digitalWrite(D10, HIGH);
\`\`\`

### 数字输入（带内部上拉）
\`\`\`cpp
pinMode(D0, INPUT_PULLUP);
int val = digitalRead(D0);
\`\`\`

### 模拟输入（ADC）
\`\`\`cpp
pinMode(A0, INPUT);
int val = analogRead(A0);  // 0-1023, 0-3.3V
\`\`\`

### PWM 输出（仅 D0-D3, D10-D13）
\`\`\`cpp
analogWrite(D10, 128);  // 0-255
\`\`\`

### Pitfalls
- PWM only works on D0-D3, D10-D13
- BOOT button is not broken out on XIAO — use external button
- analogWrite() frequency is ~488Hz on nRF52 Arduino core`,
}
