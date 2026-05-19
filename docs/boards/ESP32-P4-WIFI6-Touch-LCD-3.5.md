# ESP32-P4-WIFI6-Touch-LCD-3.5 — Board Reference

> Source: https://docs.waveshare.net/ESP32-P4-WIFI6-Touch-LCD-3.5/
> Extracted: 2026-05-07
> Status: Partial — missing detailed pin map

## ⚠️ Important

**This is NOT an ESP32-S3 board.** ESP32-P4 is a different chip:
- RISC-V architecture (not Xtensa)
- Different toolchain
- Arduino support is limited — ESP-IDF recommended
- Will require **new framework isolation** in the board system

## Specs

| Item | Value |
|---|---|
| Chip | ESP32-P4NRW32 |
| PSRAM | 32MB (叠封) |
| Flash | 16MB NOR (external) |
| Freq | TBD (ESP32-P4 typically 400MHz) |
| Screen | 3.5" IPS, 320×480, 262K color |
| Screen Driver | ST7796, SPI |
| Touch | FT6336, I2C |
| Camera | MIPI-CSI (2-lane, 15PIN 0.5mm) |
| SD Card | micro SD (SDIO 3.0) |
| Speaker | 8Ω 2W (MX1.25) |
| PMIC | AXP2101 |
| Battery | MX1.25 3.7V LiPo |
| USB | 2× Type-C (1 UART + 1 OTG 2.0 HS) |
| Buttons | PWR (6s shutdown) + RST + BOOT |
| LED | PWR/Charge dual-color LED |
| Framework | ⚠️ **ESP-IDF recommended** (Arduino limited) |

## Pin Mapping

⚠️ **No detailed pin table on documentation page.**

Known from text:
- LCD: SPI (ST7796), I2C touch (FT6336)
- Camera: MIPI-CSI 2-lane
- SD: SDIO 3.0
- I2C breakout available
- UART breakout available
- USB OTG: separate Type-C port
- PWR/Charge dual LED: red=charging/full, green=battery present

## ⚠️ Missing Info (all need user to provide)

1. **Full GPIO pin map** — SPI LCD pins, I2C pins, camera pins, SDIO pins
2. **Stepping motor/encoder** — mentioned encoder in description?
3. **WiFi6 details** — chip supports WiFi6?

## Proposed Skill List

- gpio.js — buttons, breakout GPIOs
- lcd.js — ST7796 SPI, 320×480
- touch.js — FT6336 I2C
- camera.js — MIPI-CSI
- sdcard.js — SDIO 3.0
- battery.js — AXP2101 PMIC

## Framework Note

Will need a new `framework: 'esp-idf'` with custom `idfTarget: 'esp32p4'`.
The existing ESP-IDF builder may need adjustment (different toolchain, different sdkconfig).
