/**
 * Board-specific skills for STM32F103C8T6 Blue Pill
 *
 * STM32Cube HAL framework — uses stm32HalModules[] to declare
 * which HAL driver source files are needed for compilation.
 */

import { gpioSkill } from './gpio'
import { uartSkill } from './uart'
import { i2cSkill } from './i2c'
import { spiSkill } from './spi'

export const stm32f103c8Skills = [
  gpioSkill,
  uartSkill,
  i2cSkill,
  spiSkill,
]
