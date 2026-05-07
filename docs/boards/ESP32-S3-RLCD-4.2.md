# ESP32-S3-RLCD-4.2 — Board Reference

> Source: https://docs.waveshare.net/ESP32-S3-RLCD-4.2/
> Extracted: 2026-05-07
> Status: Partial — missing screen interface and pin details

## Specs

| Item | Value |
|---|---|
| Chip | ESP32-S3-WROOM-1-N16R8 |
| Flash | 16MB (叠封) |
| PSRAM | 8MB (叠封) |
| SRAM | 512KB |
| ROM | 384KB |
| Freq | 240MHz |
| Screen | 4.2" 全反光屏 (RLCD), 300×400, no backlight |
| Screen Driver | TBD |
| SD Card | micro SD (FAT32) |
| Battery | 18650 battery holder |
| RTC Battery | Independent PH1.0 rechargeable RTC battery |
| Buttons | BOOT + PWR + KEY |
| LED | CHG (charging indicator) + WRN (reverse polarity warning) |
| USB | Type-C |
| Framework | Arduino IDE / ESP-IDF |
| Connector | 2×8PIN 2.54mm header |

## Pin Mapping

⚠️ **No detailed pin table on documentation page.**

Known from text:
- BOOT: hold + repower → download mode
- PWR: long press off, short press on
- KEY: user-defined function
- CHG LED: off when battery full
- WRN LED: on when battery reverse-connected
- 18650 battery + RTC backup battery

## ⚠️ Missing Info (all need user to provide)

1. **Screen interface type** — RGB? MCU 8080? SPI?
2. **Screen driver IC** — what chip drives the RLCD?
3. **Full GPIO pin map** — data/control pins
4. **SD Card SPI pins**
5. **I2C/UART breakout** — any on the header?
6. **Battery ADC** — which GPIO for voltage monitoring?
7. **PWR button** — is it connected to a PMIC or GPIO?

## Proposed Skill List

- gpio.js — buttons, breakout
- rlcd.js — RLCD display (TBD interface)
- sdcard.js — micro SD (TBD pins)
- battery.js — 18650 + charging
