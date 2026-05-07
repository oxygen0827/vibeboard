# ESP32-S3-Touch-AMOLED-1.43C — Board Reference

> Source: https://docs.waveshare.net/ESP32-S3-Touch-AMOLED-1.43C/
> Extracted: 2026-05-07
> Status: Pin mapping confirmed by user

## Specs

| Item | Value |
|---|---|
| Chip | ESP32-S3-PICO-1-N8R8 |
| Flash | 8MB (叠封) |
| PSRAM | 8MB (叠封) |
| SRAM | 512KB |
| ROM | 384KB |
| Freq | 240MHz |
| Screen | 1.43" AMOLED, 466×466, 16.7M color, 600cd/m², 10000:1 |
| Screen Driver | CO5300, QSPI |
| Touch | CST820, I2C |
| Audio Codec | ES8311 (DAC) + ES7210 (ADC), I2S |
| Mic | 双麦克风阵列 (via ES7210, not PDM) |
| Speaker Amp | 专业音频功率放大芯片 |
| PMIC | ETA6098 |
| Battery | MX1.25 3.7V LiPo |
| USB | Type-C (native USB) |
| SD Card | ❌ None |
| Framework | Arduino IDE / ESP-IDF |

## Pin Mapping

| GPIO | Function | Notes |
|---|---|---|
| GP4 | BAT ADC | ETA6098 battery voltage |
| GP5 | LED | User-controllable indicator |
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
| GP38 | I2S MCLK | Audio master clock |
| GP39 | I2S SCLK | Audio bit clock |
| GP40 | I2S LRCK | Audio frame clock |
| GP41 | I2S DSDIN | I2S data in (to ES8311 DAC) |
| GP42 | I2S DSOUT | I2S data out (from ES7210 ADC) |
| GP45 | Audio CTR | Audio control |
| GP47 | TP SDA / I2C SDA | Touch + external I2C shared |
| GP48 | TP SCL / I2C SCL | Touch + external I2C shared |

## Buttons

- BOOT: hold + PWR to enter download mode
- PWR: short press on, long press off

## I2C Bus

- Shared: Touch (CST820) + external expansion
- SDA=GP47, SCL=GP48
- External I2C breakout available (same bus)

## UART

- No dedicated UART breakout — only native USB (GP19/GP20) via Type-C

## Audio (I2S)

- ES8311: DAC, speaker output
- ES7210: ADC, microphone input
- I2S: MCLK=GP38, SCLK=GP39, LRCK=GP40, DIN=GP41, DOUT=GP42
- Mic: dual analog mics → ES7210 (not PDM)

## Audio

### 在网页中未找到以下信息：

- ES7210 I2C address (typical 0x40 or 0x41, same chip as SZPI?)
- ES8311 I2C address
- ETA6098 I2C address or battery ADC formula
- CO5300 QSPI init sequence
- CST820 I2C address

## Proposed Skill List

- gpio.js — LED(GP5), buttons
- amoled.js — CO5300 QSPI, 466×466
- touch.js — CST820 I2C
- audio.js — ES8311+ES7210 I2S
- battery.js — ETA6098
