export const pdmMicSkill = {
  id: 'pdm_mic',
  label: 'PDM 麦克风',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## PDM 麦克风

### 引脚
- PDM_DATA：P0.16
- PDM_CLK：P1.00

### 基础用法（使用 PDM 库）
\`\`\`cpp
#include <PDM.h>

static const char channels = 1;
static const int frequency = 16000;
static short sampleBuffer[512];
static volatile int samplesRead;

void onPDMdata() {
  int bytesAvailable = PDM.available();
  PDM.read(sampleBuffer, bytesAvailable);
  samplesRead = bytesAvailable / 2;
}

void setup() {
  Serial.begin(115200);
  PDM.onReceive(onPDMdata);
  if (!PDM.begin(channels, frequency)) {
    Serial.println("PDM init failed!");
    while (1);
  }
}

void loop() {
  if (samplesRead) {
    for (int i = 0; i < samplesRead; i++) {
      Serial.println(sampleBuffer[i]);
    }
    samplesRead = 0;
  }
}
\`\`\`

### Pitfalls
- PDM 麦克风输出数字信号（不是模拟），需用 PDM 库解码
- 典型采样率 16kHz 或 32kHz
- 板载单颗 PDM 麦克风（无立体声）
- 使用 PDM 时 P0.16/P1.00 不可作 GPIO`}
