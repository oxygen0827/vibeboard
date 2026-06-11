export const HUANGSHAN_BOARD_ID = 'huangshan_pi_sf32lb52'

const DEFAULT_WORKSPACE = typeof process !== 'undefined' && process.env?.HUANGSHAN_WORKSPACE
  ? process.env.HUANGSHAN_WORKSPACE
  : '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev'
const DEFAULT_SDK = typeof process !== 'undefined' && process.env?.SIFLI_SDK_PATH
  ? process.env.SIFLI_SDK_PATH
  : '/Users/wq/huangshan-pi-workspace/sifli-sdk'
const DEFAULT_EXAMPLES = typeof process !== 'undefined' && process.env?.HUANGSHAN_EXAMPLES_PATH
  ? process.env.HUANGSHAN_EXAMPLES_PATH
  : '/Users/wq/huangshan-pi-workspace/lckfb-hspi-ulp_example'

export const HUANGSHAN_SOURCE_PATHS = {
  workspace: DEFAULT_WORKSPACE,
  sdk: DEFAULT_SDK,
  examples: DEFAULT_EXAMPLES,
}

export const HUANGSHAN_BOARD_PROFILE = {
  id: HUANGSHAN_BOARD_ID,
  name: 'LCKFB Huangshan Pi / 立创黄山派',
  module: 'SF32LB52x-MOD-1-N16R8',
  chip: 'SF32LB525UC6',
  targetBoard: 'sf32lb52-lchspi-ulp',
  framework: 'SiFli SDK release/v2.4 + RT-Thread + SCons',
  memory: {
    sram: '576KB SRAM',
    psram: '8MB OPI PSRAM',
    flash: '16MB QSPI NOR Flash',
  },
  display: {
    panel: '1.85 inch AMOLED',
    controller: 'CO5300AF-01',
    interface: 'Quad SPI',
    resolution: { width: 390, height: 450 },
  },
  touch: {
    controller: 'FT6146-M00',
  },
  debug: {
    transport: 'CH340N USB UART',
    defaultSerialPort: '/dev/cu.usbserial-110',
    logBaud: 1000000,
  },
  hardware: {
    imu: 'LSM6DS3TR-C',
    magnetometer: 'MMC5603NJ',
    ambientLight: 'LTR-303ALS-01',
    microphone: 'MEMS MIC',
    speakerPa: 'Class-D PA',
    tfCard: 'SPI TF card slot',
    rgbLed: 'WS2812B-2020',
    motor: 'board motor driver pads',
    charger: 'AW32001ECSR',
    usbFs: 'USB 2.0 FS through expansion connector',
  },
  bringUp: {
    requiredCo5300Patch: true,
    acceptedCo5300Ids: ['0x331100', '0x1fff', '0x3fff'],
    lcdcSyncMode: 'HAL_LCDC_SYNC_DISABLE',
    powerJumpersRequired: true,
  },
}

const CAPABILITIES = [
  {
    id: 'lvgl_app',
    priority: 'first',
    label: 'LVGL watch-launcher app',
    referencePaths: ['lvgl/watch', 'lvgl/lvgl_v8_demos', 'lvgl/lvgl_v9_demos'],
  },
  {
    id: 'sensor',
    priority: 'second',
    label: 'IMU, magnetometer, ambient light',
    referencePaths: ['RT-Device/sensor'],
  },
  {
    id: 'ws2812',
    priority: 'second',
    label: 'WS2812B RGB LED',
    referencePaths: ['ws2812'],
  },
  {
    id: 'gpio_key',
    priority: 'second',
    label: 'GPIO and function key',
    referencePaths: ['gpio', 'example/rt_device/gpio'],
  },
  {
    id: 'charger',
    priority: 'second',
    label: 'charger and power status',
    referencePaths: ['I2C/charger', 'customer/peripherals/charger'],
  },
  {
    id: 'uart',
    priority: 'second',
    label: 'UART debug and external serial',
    referencePaths: ['uart', 'example/rt_device/uart'],
  },
  {
    id: 'audio',
    priority: 'later',
    label: 'microphone and speaker output',
    referencePaths: ['example/rt_device/pdm', 'example/rt_device/i2s', 'example/rt_device/audprc'],
  },
  {
    id: 'tf_card',
    priority: 'later',
    label: 'SPI TF card storage',
    referencePaths: ['example/rt_device/spi_tf'],
  },
  {
    id: 'motor',
    priority: 'later',
    label: 'motor driver pads',
    referencePaths: [],
  },
  {
    id: 'ble',
    priority: 'later',
    label: 'BLE workflows',
    referencePaths: ['example/ble/peripheral', 'example/ble/peripheral_with_ota'],
  },
  {
    id: 'low_power',
    priority: 'later',
    label: 'low-power workflows',
    referencePaths: ['example/pm'],
  },
  {
    id: 'usb_fs',
    priority: 'later',
    label: 'USB 2.0 FS expansion connector',
    referencePaths: ['example/rt_device/usb'],
  },
]

const EXAMPLE_RECIPES = [
  {
    id: 'gpio_key2_pa43_pin20',
    title: 'GPIO KEY2 and output pin',
    sourcePath: 'gpio/src/main.c',
    capabilities: ['key', 'gpio_output'],
    facts: ['KEY2 is PA43/GPIO43', 'example output pin is GPIO20', 'KEY2 uses rising/falling IRQ'],
  },
  {
    id: 'adc_vbat_pa34',
    title: 'ADC VBAT and PA34',
    sourcePath: 'adc/src/main.c',
    capabilities: ['battery', 'adc_gpio'],
    facts: ['ADC device is bat1', 'VBAT channel is 7', 'PA34 ADC channel is 6'],
  },
  {
    id: 'ws2812_pa32_rgbled',
    title: 'WS2812 RGB LED',
    sourcePath: 'ws2812/src/main.c',
    capabilities: ['led'],
    facts: ['RGB LED device is rgbled', 'PA32 maps to GPTIM2_CH1', 'enable peripheral LDO3 3V3 before use'],
  },
  {
    id: 'uart2_pa18_pa19',
    title: 'UART2 external serial',
    sourcePath: 'uart/src/main.c',
    capabilities: ['uart2'],
    facts: ['UART2 RX is PA18', 'UART2 TX is PA19', 'UART2 is separate from the debug console'],
  },
  {
    id: 'i2c3_sensors',
    title: 'I2C3 onboard sensors',
    sourcePath: 'RT-Device/sensor/README.md',
    capabilities: ['ambient_light', 'imu', 'magnetometer'],
    facts: ['I2C3 SCL is PA40', 'I2C3 SDA is PA39', 'devices include LTR303, LSM6DSL, and MMC56X3'],
  },
]

export function listHuangshanCapabilities() {
  return CAPABILITIES.map(item => ({ ...item, referencePaths: [...item.referencePaths] }))
}

export function getHuangshanCapability(id) {
  const capability = CAPABILITIES.find(item => item.id === id)
  return capability ? { ...capability, referencePaths: [...capability.referencePaths] } : null
}

export function listHuangshanExampleRecipes() {
  return EXAMPLE_RECIPES.map(item => ({
    ...item,
    capabilities: [...item.capabilities],
    facts: [...item.facts],
  }))
}
