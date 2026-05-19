/**
 * Board-specific skills for Seeed XIAO nRF52840 Sense
 *
 * Sense variant: RGB LED (GPIO), 6-DOF IMU, PDM mic, NFC.
 * All use arduinoLibraries[] for dependency declaration.
 */

import { gpioSkill } from './gpio'
import { ledSkill } from './led'
import { uartSkill } from './uart'
import { spiSkill } from './spi'
import { i2cSkill } from './i2c'
import { bleSkill } from './ble'
import { batterySkill } from './battery'
import { imuSkill } from './imu'
import { pdmMicSkill } from './pdm_mic'
import { nfcSkill } from './nfc'

export const xiaoNrf52840Skills = [
  gpioSkill,
  ledSkill,
  uartSkill,
  spiSkill,
  i2cSkill,
  bleSkill,
  batterySkill,
  imuSkill,
  pdmMicSkill,
  nfcSkill,
]
