import assert from 'node:assert/strict'
import { createNordicAppFiles, normalizeNordicAppName } from '../src/domain/nordic/appTemplate.js'
import { NORDIC_BOARD_PROFILE, listNordicCapabilities } from '../src/domain/nordic/boardProfile.js'

assert.equal(NORDIC_BOARD_PROFILE.boardTarget, 'nrf52840dk/nrf52840')
assert.ok(listNordicCapabilities().some(cap => cap.id === 'ble_peripheral'))

assert.equal(normalizeNordicAppName('BLE GPIO Demo!'), 'ble_gpio_demo')

const files = createNordicAppFiles({
  displayName: 'BLE GPIO Demo',
  description: 'Use BLE, LED and UART logs',
  capabilities: ['ble_peripheral', 'gpio_led_button', 'uart_console'],
})

assert.ok(files['CMakeLists.txt'].includes('find_package(Zephyr REQUIRED'))
assert.ok(files['CMakeLists.txt'].includes('target_sources(app PRIVATE src/main.c)'))
assert.ok(files['prj.conf'].includes('CONFIG_BT=y'))
assert.ok(files['prj.conf'].includes('CONFIG_GPIO=y'))
assert.ok(files['prj.conf'].includes('CONFIG_UART_CONSOLE=y'))
assert.ok(files['src/main.c'].includes('#include <zephyr/bluetooth/bluetooth.h>'))
assert.ok(files['src/main.c'].includes('GPIO_DT_SPEC_GET_OR(LED0_NODE'))
assert.ok(files['src/main.c'].includes('bt_le_adv_start'))
assert.ok(files['README.md'].includes('west build -b nrf52840dk/nrf52840 .'))

console.log('nordic app template tests passed')
