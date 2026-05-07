# ESP32-S3-ePaper-1.54 — Board Reference

> Source: https://docs.waveshare.net/ESP32-S3-ePaper-1.54/?variant=ESP32-S3-Touch-ePaper-1.54
> Extracted: 2026-05-07
> Status: Partial — missing ePaper driver IC and SPI pin details

## Specs

| Item | Value |
|---|---|
| Chip (V2) | ESP32-S3-PICO-1-N8R8 |
| Chip (V1) | ESP32-S3FH4R2 (4MB Flash, 2MB PSRAM) |
| Flash (V2) | 8MB (叠封) |
| PSRAM (V2) | 8MB (叠封) |
| Screen | 1.54" ePaper, 200×200 |
| Screen Driver | TBD (SPI) |
| SD Card | micro SD slot (FAT32) |
| Battery | MX1.25 3.7V LiPo |
| Buttons | BOOT + PWR |
| USB | Type-C |
| Framework | Arduino IDE / ESP-IDF |

## Pin Mapping

⚠️ **No pin table found on the documentation page.**

Known from text:
- BOOT button: hold + power-up → download mode
- PWR button: power control for battery operation
- SD card: FAT32 format
- Battery: MX1.25 2PIN connector

## ⚠️ Missing Info (all need user to provide)

1. **ePaper driver IC** — what chip drives the 1.54" 200x200 ePaper?
2. **SPI pins** — SCK/MISO/MOSI/CS/DC/BUSY for ePaper
3. **SD Card SPI pins** — are they on same SPI bus or separate?
4. **I2C bus** — any I2C devices? Pins?
5. **UART** — breakout or not?
6. **Battery ADC** — which GPIO?
7. **LED** — any user LED?

## Proposed Skill List

- gpio.js — buttons
- epaper.js — ePaper display driver (TBD IC)
- sdcard.js — micro SD (TBD pins)
- battery.js — power management
