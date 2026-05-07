export const bleSkill = {
  id: 'ble',
  label: 'BLE (nRF52 SoftDevice)',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## BLE（nRF52 原生蓝牙）

nRF52840 使用 SoftDevice 提供 BLE 功能。推荐使用 ArduinoBLE 库（>=1.3.0）。

### BLE LED 控制服务示例
\`\`\`cpp
#include <ArduinoBLE.h>

BLEService ledService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEByteCharacteristic switchChar("19B10001-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLEWrite);

void setup() {
  Serial.begin(115200);
  pinMode(P0_26, OUTPUT);  // Red LED

  if (!BLE.begin()) {
    Serial.println("BLE init failed!");
    while (1);
  }

  BLE.setLocalName("XIAO Sense BLE");
  BLE.setAdvertisedService(ledService);
  ledService.addCharacteristic(switchChar);
  BLE.addService(ledService);
  switchChar.writeValue(0);
  BLE.advertise();
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    while (central.connected()) {
      if (switchChar.written()) {
        digitalWrite(P0_26, switchChar.value() ? LOW : HIGH);
      }
    }
  }
}
\`\`\`

### Pitfalls
- nRF52840 支持 20 个 BLE 连接（同时）
- ArduinoBLE 库版本 1.3.0+ 推荐
- SoftDevice 与 FreeRTOS 不完全兼容
- nRF52840 BLE 发射功率可调：-40 至 +8 dBm
- 最大吞吐量约 1.3 Mbps（BLE 5 Long Range 可达 2 Mbps）`}
