export const HUANGSHAN_BOARD_ID = 'huangshan_pi_sf32lb52'

export const HUANGSHAN_SOURCE_PATHS = {
  workspace: '/Users/wq/huangshan-pi-workspace/huangshan-pi-sf32-dev',
  sdk: '/Users/wq/huangshan-pi-workspace/sifli-sdk',
  examples: '/Users/wq/huangshan-pi-workspace/lckfb-hspi-ulp_example',
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

export function listHuangshanCapabilities() {
  return CAPABILITIES.map(item => ({ ...item, referencePaths: [...item.referencePaths] }))
}

export function getHuangshanCapability(id) {
  const capability = CAPABILITIES.find(item => item.id === id)
  return capability ? { ...capability, referencePaths: [...capability.referencePaths] } : null
}
