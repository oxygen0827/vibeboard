export const bleSkill = {
  id: 'ble',
  label: 'BLE (nRF52 SoftDevice)',
  projectConfig: {
    srcs: [],
    arduinoLibraries: [],
    buildFlags: [],
  },
  systemPrompt: `## BLE (nRF52 原生蓝牙)

nRF52840 使用 SoftDevice 提供 BLE 功能。推荐使用 Arduino BLE 库 (>=1.3.0)。

### BLE LED 控制服务示例
\`\`\`cpp
#include <ArduinoBLE.h>

BLEService ledService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEByteCharacteristic switchChar("19B10001-E8F2-537E-4F6C-D104768A1214", 
  BLERead | BLEWrite);

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  
  if (!BLE.begin()) {
    Serial.println("BLE init failed!");
    while (1);
  }
  
  BLE.setLocalName("XIAO BLE");
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
        digitalWrite(LED_BUILTIN, switchChar.value());
      }
    }
  }
}
\`\`\`

### BLE UART (NUS) 透传
\`\`\`cpp
#include <ArduinoBLE.h>
const char* uartService = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const char* uartTxChar   = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const char* uartRxChar   = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
// ... standard BLE UART implementation
\`\`\`

### Pitfalls
- BLE.begin() must be called ONCE, not in loop
- nRF52 SoftDevice shares radio with BLE — no concurrent WiFi (nRF52 has no WiFi anyway)
- Maximum BLE connections: 8 peripheral + 1 central (nRF52840)
- ArduinoBLE library version 1.3.0+ recommended for nRF52
- Serial over BLE UART has ~10ms latency — not for real-time control`,
}
