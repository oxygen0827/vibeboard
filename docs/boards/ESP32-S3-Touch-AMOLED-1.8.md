# ESP32-S3-Touch-AMOLED-1.8 — Board Reference

> Source: https://docs.waveshare.net/ESP32-S3-Touch-AMOLED-1.8/
> Extracted: 2026-05-07
> Status: Partial — missing SD card, IMU, RTC pin details

## Specs

| Item | Value |
|---|---|
| Chip | ESP32-S3R8 |
| Flash | 16MB NOR (external SPI) |
| PSRAM | 8MB (叠封) |
| SRAM | 512KB |
| ROM | 384KB |
| Freq | 240MHz |
| Screen | 1.8" AMOLED, 368×448, 16.7M color |
| Screen Driver | SH8601, QSPI |
| Touch | FT3168, I2C |
| Audio | Codec (I2S) |
| Mic | Yes |
| Speaker | Yes |
| IMU | 6-axis (accel+gyro), I2C |
| RTC | PCF85063, I2C (backup battery pad) |
| SD Card | micro SD card slot (SPI) |
| PMIC | AXP2101 |
| Battery | MX1.25 3.7V LiPo |
| USB | Type-C (native USB) |
| Framework | Arduino IDE / ESP-IDF |
| GPIO breakout | 7 GPIOs + 1×I2C + 1×UART + 1×USB |

## Pin Mapping

| GPIO | Function | Notes |
|---|---|---|
| GP0 | IO Expander? | See note |
| GP1 | IO Expander? | See note |
| GP2 | IO Expander? | See note |
| GP3 | IO Expander? | See note |
| GP4 | BAT ADC | AXP2101 |
| GP5 | LED | Power/charge indicator |
| GP6 | STAT | AXP2101 status |
| GP7 | LCD TE | AMOLED tearing effect |
| GP8 | LCD D0 | QSPI data 0 |
| GP9 | LCD D1 | QSPI data 1 |
| GP10 | LCD D2 | QSPI data 2 |
| GP11 | LCD D3 | QSPI data 3 |
| GP12 | LCD RESET | AMOLED reset |
| GP13 | LCD CLK | QSPI clock |
| GP14 | LCD CS | QSPI chip select |
| GP15 | TP RESET | Touch reset |
| GP17 | TP INT | Touch interrupt |
| GP18 | Codec EN | Audio codec enable |
| GP19 | USB D- | Native USB |
| GP20 | USB D+ | Native USB |
| GP21 | Free | Breakout |
| GP38 | I2S MCLK | Audio master clock |
| GP39 | I2S SCLK | Audio bit clock |
| GP40 | I2S LRCK | Audio frame clock |
| GP41 | I2S DSDIN | I2S data in |
| GP42 | I2S DSOUT | I2S data out |
| GP43 | Free | Breakout |
| GP44 | Free | Breakout |
| GP45 | Audio CTR | Audio control |
| GP47 | TP SDA / Audio SDA / I2C SDA | Shared I2C bus |
| GP48 | TP SCL / Audio SCL / I2C SCL | Shared I2C bus |

## I2C Bus (GP47/48)

Shared by: FT3168 (touch), Audio Codec, PCF85063 (RTC), IMU (6-axis)

## Buttons

- BOOT: hold on power-up → download mode / user-defined function
- PWR: short press on, long press off (AXP2101 controlled)

## ⚠️ Missing Info (need user to provide)

1. **SD Card SPI pins** — which GPIOs for SCK/MISO/MOSI/CS?
2. **IMU model** — "6-axis" but which chip? (I2C address?)
3. **RTC PCF85063** — I2C address?
4. **Audio codec model** — which I2S codec chip?
5. **GP0-GP3** — are these IO expander outputs or something else?

## Proposed Skill List

- gpio.js — breakout GPIOs, buttons
- amoled.js — SH8601 QSPI, 368×448
- touch.js — FT3168 I2C
- audio.js — I2S codec
- imu.js — 6-axis (TBD model)
- rtc.js — PCF85063
- sdcard.js — micro SD (SPI, TBD pins)
- battery.js — AXP2101 PMIC
