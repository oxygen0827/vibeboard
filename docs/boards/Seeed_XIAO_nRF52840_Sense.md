# Seeed XIAO nRF52840 Sense — Board Reference

> Source: https://wiki.seeedstudio.com/cn/XIAO_BLE/
> Extracted: 2026-05-07
> Status: ✅ Complete (user-provided pin table)

## Specs

| Item | Value |
|---|---|
| Chip | nRF52840 (ARM Cortex-M4F @ 64MHz) |
| Flash | 1MB |
| RAM | 256KB |
| USB | USB-C, native USB (no bridge) |
| LED | RGB three separate GPIOs (NOT NeoPixel) |
| IMU | LSM6DS3TR (6-DOF, I2C 0x6A) |
| Mic | PDM microphone |
| NFC | NFC antenna (external) |
| Charger | BQ25101 |
| Framework | Arduino (Seeeduino nRF52) |
| FQBN | `Seeeduino:nrf52:XIAO_nRF52840` |

## Pin Mapping

| Pin | Function | Nordic Pin | Notes |
|---|---|---|---|
| D0 | AIN0 | P0.02 | Analog input |
| D1 | AIN1 | P0.03 | Analog input |
| D2 | AIN4 | P0.28 | Analog input |
| D3 | AIN5 | P0.29 | Analog input |
| D4 | SDA, AIN2 | P0.04 | I2C data |
| D5 | SCL, AIN3 | P0.05 | I2C clock |
| D6 | TX | P1.11 | UART transmit |
| D7 | RX | P1.12 | UART receive |
| D8 | SCK | P1.13 | SPI clock |
| D9 | MISO | P1.14 | SPI data in |
| D10 | MOSI | P1.15 | SPI data out |
| — | LED_R | P0.26 | Red channel (active LOW) |
| — | LED_G | P0.30 | Green channel (active LOW) |
| — | LED_B | P0.06 | Blue channel (active LOW) |
| — | CHARGE_LED | P0.17 | BQ25101 charge indicator |
| — | ADC_BAT | P0.14 | Battery voltage sense |
| — | CHG_SEL | P0.13 | Charge current select (50/100mA) |
| — | IMU_PWR | P1.08 | IMU power enable (HIGH=on) |
| — | IMU_INT1 | P0.11 | IMU interrupt |
| — | PDM_DATA | P0.16 | PDM mic data |
| — | PDM_CLK | P1.00 | PDM mic clock |
| — | NFC1 | P0.09 | NFC antenna |
| — | NFC2 | P0.10 | NFC antenna |
| — | RF_SEL | P2.05 | RF switch select |
| — | RF_PWR | P2.03 | RF switch power |
| — | RESET | P0.18 | Reset button |

## I2C Bus (D4/D5 = P0.04/P0.05)

- LSM6DS3TR IMU @ 0x6A
- External I2C devices

## Buttons

- Single-click: Reset
- Double-click: Bootloader mode
- No separate BOOT button

## Critical Pitfalls

1. RGB LED = three separate GPIOs (NOT NeoPixel) — DO NOT use Adafruit_NeoPixel
2. IMU needs P1.08 HIGH before I2C access
3. P0.14 = ADC_BAT, not regular GPIO
4. P0.17 = CHARGE_LED, controlled by charger IC
5. Serial = native USB, NOT hardware UART; Serial1 = D6/D7

## Skill List (10)

- gpio.js — D0-D10, buttons
- led.js — RGB separate GPIOs
- uart.js — Serial1 D6/D7
- spi.js — D8-D10
- i2c.js — D4/D5 bus
- ble.js — nRF52 SoftDevice
- battery.js — BQ25101, ADC_BAT
- imu.js — LSM6DS3TR
- pdm_mic.js — PDM mic
- nfc.js — NFC antenna
