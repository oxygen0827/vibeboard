import { writeFileSync } from 'node:fs'
import { createHuangshanAppFilesFromBuilder } from '../src/domain/huangshan/appBuilder.js'

const files = createHuangshanAppFilesFromBuilder({
  displayName: 'Example Sensor Hub',
  description: 'LCKFB examples: sensors, ADC, key, LED.',
  components: [
    { type: 'status', label: 'Status', value: 'Examples ready' },
    { type: 'metric', capability: 'ambient_light', label: 'Light', value: 'I2C3 LTR303' },
    { type: 'metric', capability: 'imu', label: 'Motion', value: 'I2C3 LSM6DSL' },
    { type: 'metric', capability: 'magnetometer', label: 'Compass', value: 'I2C3 MMC56X3' },
    { type: 'battery', capability: 'battery', label: 'VBAT', value: 'ADC ch7' },
    { type: 'metric', capability: 'adc_gpio', label: 'PA34', value: 'ADC ch6' },
    { type: 'action', capability: 'key', label: 'KEY2', value: 'KEY2 pressed' },
    { type: 'action', capability: 'led', label: 'LED', value: 'LED hook' },
  ],
})

writeFileSync(1, JSON.stringify({ files }, null, 2))
