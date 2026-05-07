/**
 * Board-specific skills for 立创实战派ESP32-S3
 *
 * Each skill provides:
 *   - id:             unique identifier
 *   - label:          human-readable name
 *   - projectConfig:  sdkconfig, idfComponents, partitions, srcs
 *   - systemPrompt:   AI context injected when skill is active
 */

import { lvglSkill } from './lvgl'
import { audioSkill } from './audio'
import { cameraSkill } from './camera'
import { imuSkill } from './imu'
import { wifiSkill } from './wifi'
import { bleSkill } from './ble'
import { sdcardSkill } from './sdcard'
import { gpioSkill } from './gpio'
import { speechSkill } from './speech'
import { visionSkill } from './vision'
import { handheldSkill } from './handheld'

export const szpi_esp32s3Skills = [
  lvglSkill,
  audioSkill,
  cameraSkill,
  imuSkill,
  wifiSkill,
  bleSkill,
  sdcardSkill,
  gpioSkill,
  speechSkill,
  visionSkill,
  handheldSkill,
]
