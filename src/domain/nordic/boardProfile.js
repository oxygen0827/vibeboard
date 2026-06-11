export const NORDIC_BOARD_ID = 'nrf52840dk_nrf52840'

export const NORDIC_BOARD_PROFILE = {
  id: NORDIC_BOARD_ID,
  name: 'Nordic nRF52840 DK',
  chip: 'nRF52840',
  module: 'PCA10056 development kit',
  boardTarget: 'nrf52840dk/nrf52840',
  framework: 'nRF Connect SDK + Zephyr',
  buildTool: 'west',
  description: 'Bluetooth LE, Thread, USB, GPIO, UART, I2C, SPI and PWM on nRF Connect SDK',
  officialStack: {
    sdk: 'nRF Connect SDK',
    rtos: 'Zephyr RTOS',
    ide: 'nRF Connect for VS Code',
    build: 'west build',
    flash: 'west flash',
  },
  capabilities: [
    {
      id: 'ble_peripheral',
      family: 'ble',
      label: 'BLE Peripheral',
      zephyrSymbols: ['CONFIG_BT', 'CONFIG_BT_PERIPHERAL'],
      sample: 'samples/bluetooth/peripheral',
    },
    {
      id: 'gpio_led_button',
      family: 'led',
      label: 'GPIO LED/Button',
      zephyrSymbols: ['CONFIG_GPIO'],
      sample: 'samples/basic/blinky',
    },
    {
      id: 'uart_console',
      family: 'network',
      label: 'UART Console',
      zephyrSymbols: ['CONFIG_SERIAL', 'CONFIG_CONSOLE'],
      sample: 'samples/subsys/console/getline',
    },
    {
      id: 'i2c_sensor',
      family: 'sensor',
      label: 'I2C Sensor',
      zephyrSymbols: ['CONFIG_I2C', 'CONFIG_SENSOR'],
      sample: 'samples/sensor',
    },
  ],
}

export function listNordicCapabilities() {
  return NORDIC_BOARD_PROFILE.capabilities.map(capability => ({ ...capability }))
}
