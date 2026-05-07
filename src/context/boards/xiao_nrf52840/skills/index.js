/**
 * Board-specific skills for Seeed XIAO nRF52840
 *
 * Arduino framework — uses arduinoLibraries[] instead of idfComponents[],
 * and buildFlags[] instead of sdkconfig[].
 */

import { gpioSkill } from './gpio'
import { neopixelSkill } from './neopixel'
import { bleSkill } from './ble'
import { i2cSkill } from './i2c'
import { batterySkill } from './battery'

export const xiaoNrf52840Skills = [
  gpioSkill,
  neopixelSkill,
  bleSkill,
  i2cSkill,
  batterySkill,
]
