export const imuSkill = {
  id: 'imu',
  label: '6-DOF IMU (LSM6DS3TR)',
  projectConfig: {
    srcs: [],
    arduinoLibraries: ['Seeed Arduino LSM6DS3'],
    buildFlags: [],
  },
  systemPrompt: `## 6-DOF IMU — LSM6DS3TR

### 引脚
- I2C 地址：0x6A（默认）
- IMU 电源：P1.08（需拉高）
- INT1：P0.11（中断输出）

### 初始化
\`\`\`cpp
#include <LSM6DS3.h>
#include <Wire.h>

LSM6DS3 myIMU(I2C_MODE, 0x6A);

void setup() {
  pinMode(P1_08, OUTPUT);
  digitalWrite(P1_08, HIGH);  // IMU 供电
  delay(10);

  Serial.begin(115200);
  if (myIMU.begin() != 0) {
    Serial.println("IMU init failed!");
  } else {
    Serial.println("IMU ready");
  }
}
\`\`\`

### 读取加速度计和陀螺仪
\`\`\`cpp
void loop() {
  float ax = myIMU.readFloatAccelX();
  float ay = myIMU.readFloatAccelY();
  float az = myIMU.readFloatAccelZ();
  float gx = myIMU.readFloatGyroX();
  float gy = myIMU.readFloatGyroY();
  float gz = myIMU.readFloatGyroZ();
  float temp = myIMU.readTempC();

  Serial.print("Acc: ");
  Serial.print(ax); Serial.print(" "); Serial.print(ay); Serial.print(" "); Serial.println(az);
  delay(100);
}
\`\`\`

### Pitfalls
- 必须先 P1.08 HIGH 给 IMU 供电，否则 I2C 通信失败
- I2C 地址 0x6A — 不同于某些 ST 传感器的默认 0x6B
- LSM6DS3TR 最大采样率 6.66kHz（加速度计）/ 6.66kHz（陀螺仪）
- 可用 Arduino 库：Seeed Arduino LSM6DS3 或 Adafruit LSM6DS
- INT1 引脚（P0.11）可用于运动检测中断`}
