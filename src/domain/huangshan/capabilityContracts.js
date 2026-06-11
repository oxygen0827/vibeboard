export const HUANGSHAN_CAPABILITY_CONTRACTS = {
  status: {
    id: 'status',
    label: 'Status UI',
    exampleReferences: ['lvgl/watch'],
    evidencePatterns: [],
  },
  ambient_light: {
    id: 'ambient_light',
    label: 'LTR303 ambient light',
    exampleReferences: ['RT-Device/sensor'],
    includePaths: [
      "os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/sensors')",
      "os.path.join(rtconfig.SIFLI_SDK, 'customer/peripherals/sensor/LTR303')",
    ],
    projConf: ['CONFIG_BSP_USING_I2C3=y', 'CONFIG_SENSOR_USING_ASL=y', 'CONFIG_ASL_USING_LTR303=y'],
    evidencePatterns: ['light:'],
  },
  imu: {
    id: 'imu',
    label: 'LSM6DSL IMU',
    exampleReferences: ['RT-Device/sensor'],
    includePaths: [
      "os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/sensors')",
      "os.path.join(rtconfig.SIFLI_SDK, 'customer/peripherals/sensor/LSM6DSL')",
    ],
    projConf: ['CONFIG_BSP_USING_I2C3=y', 'CONFIG_SENSOR_USING_6D=y', 'CONFIG_ACC_USING_LSM6DSL=y'],
    evidencePatterns: ['acce:'],
  },
  magnetometer: {
    id: 'magnetometer',
    label: 'MMC56X3 magnetometer',
    exampleReferences: ['RT-Device/sensor'],
    includePaths: [
      "os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/sensors')",
      "os.path.join(rtconfig.SIFLI_SDK, 'customer/peripherals/sensor/MMC56x3')",
    ],
    projConf: ['CONFIG_BSP_USING_I2C3=y', 'CONFIG_SENSOR_USING_MAG=y', 'CONFIG_MAG_USING_MMC56X3=y'],
    evidencePatterns: ['mag:'],
  },
  battery: {
    id: 'battery',
    label: 'VBAT ADC',
    exampleReferences: ['adc/src/main.c'],
    projConf: ['CONFIG_BSP_USING_ADC1=y'],
    evidencePatterns: ['VBAT read value:'],
  },
  adc_gpio: {
    id: 'adc_gpio',
    label: 'PA34 ADC',
    exampleReferences: ['adc/src/main.c'],
    projConf: ['CONFIG_BSP_USING_ADC1=y'],
    evidencePatterns: ['ADC read value:'],
  },
  bluetooth: {
    id: 'bluetooth',
    label: 'BLE placeholder',
    exampleReferences: ['example/ble/peripheral'],
    evidencePatterns: [],
  },
  key: {
    id: 'key',
    label: 'KEY2 GPIO43',
    exampleReferences: ['gpio/src/main.c'],
    evidencePatterns: ['KEY2'],
  },
  gpio_output: {
    id: 'gpio_output',
    label: 'GPIO20 output',
    exampleReferences: ['gpio/src/main.c'],
    evidencePatterns: ['GPIO'],
  },
  led: {
    id: 'led',
    label: 'WS2812 RGB LED',
    exampleReferences: ['ws2812/src/main.c'],
    includePaths: ["os.path.join(rtconfig.SIFLI_SDK, 'drivers/Include')"],
    projConf: [
      'CONFIG_BSP_PWM3_CC1_USING_DMA=y',
      'CONFIG_RGB_SK6812MINI_HS_ENABLE=y',
      'CONFIG_RGB_USING_SK6812MINI_HS_DEV_NAME=y',
      'CONFIG_RGB_USING_SK6812MINI_HS_PWM_DEV_NAME="pwm3"',
      'CONFIG_BSP_USING_RGBLED_CH=1',
    ],
    evidencePatterns: ['RGB LED example started!', '-> green'],
  },
  motor: {
    id: 'motor',
    label: 'Motor placeholder',
    exampleReferences: [],
    evidencePatterns: ['motor'],
  },
  uart2: {
    id: 'uart2',
    label: 'UART2 external serial',
    exampleReferences: ['uart/src/main.c'],
    includePaths: ["os.path.join(rtconfig.SIFLI_SDK, 'rtos/rtthread/components/drivers/serial')"],
    projConf: ['CONFIG_BSP_USING_UART2=y'],
    evidencePatterns: ['send:', 'rev:', 'uart_rec:'],
  },
}

export const HUANGSHAN_CAPABILITY_IDS = Object.freeze(Object.keys(HUANGSHAN_CAPABILITY_CONTRACTS))

export function getHuangshanCapabilityContract(id) {
  const contract = HUANGSHAN_CAPABILITY_CONTRACTS[id]
  return contract ? cloneContract(contract) : null
}

export function listHuangshanCapabilityContracts() {
  return HUANGSHAN_CAPABILITY_IDS.map(id => cloneContract(HUANGSHAN_CAPABILITY_CONTRACTS[id]))
}

export function collectHuangshanContractValues(capabilityIds = [], key) {
  const values = []
  const seen = new Set()
  for (const id of capabilityIds) {
    const contract = HUANGSHAN_CAPABILITY_CONTRACTS[id]
    for (const value of contract?.[key] || []) {
      if (seen.has(value)) continue
      seen.add(value)
      values.push(value)
    }
  }
  return values
}

function cloneContract(contract) {
  return {
    ...contract,
    exampleReferences: [...(contract.exampleReferences || [])],
    includePaths: [...(contract.includePaths || [])],
    projConf: [...(contract.projConf || [])],
    evidencePatterns: [...(contract.evidencePatterns || [])],
  }
}
