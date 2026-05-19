// IMU skill — QMI8658 for 立创实战派ESP32-S3
// Enriched from 02-attitude official example
export const imuSkill = {
  id: 'imu',
  label: 'IMU (QMI8658)',
  projectConfig: {
    srcs: [],
    sdkconfig: [],
    idfComponents: [],
    partitions: null,
    spiffs: false,
  },
  systemPrompt: `## IMU — QMI8658

### I2C Address: 0x6A (NOT 0x6B)

### Init
\`\`\`c
bsp_i2c_init();
qmi8658_init();
\`\`\`

### qmi8658_init() register sequence
\`\`\`c
// WHO_AM_I must return 0x05
qmi8658_register_write_byte(QMI8658_RESET, 0xb0);
vTaskDelay(10 / portTICK_PERIOD_MS);
qmi8658_register_write_byte(QMI8658_CTRL1, 0x40); // auto-increment
qmi8658_register_write_byte(QMI8658_CTRL7, 0x03); // enable ACC+GYR
qmi8658_register_write_byte(QMI8658_CTRL2, 0x95); // ACC 4g 250Hz
qmi8658_register_write_byte(QMI8658_CTRL3, 0xd5); // GYR 512dps 250Hz
\`\`\`

### Read angles
\`\`\`c
t_sQMI8658 qmi;
qmi8658_fetch_angleFromAcc(&qmi); // AngleX/Y/Z in degrees
\`\`\`

### Pitfalls
- Address 0x6A NOT 0x6B — wrong addr = silent failure
- WHO_AM_I must return 0x05 before configuring
- Reset needs 10ms delay before next write
- CTRL1=0x40 required for multi-byte reads`,
}
