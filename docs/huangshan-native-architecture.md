# Huangshan Pi Native Architecture

VibeBoard's Huangshan Pi flow must follow the SiFli SDK model instead of copying
the ESP-IDF project model. ESP-IDF projects are usually assembled around
`main/`, CMake, components, sdkconfig, and partition files. Huangshan Pi uses the
SiFli SDK, RT-Thread, SCons, board-selected BSPs, and launcher-mounted
applications. The correct abstraction is therefore not a generic compile package
but a board-app capsule.

## Core Model

```text
SiFli SDK
  -> chip HAL, RT-Thread, middleware, board BSP, peripherals

Huangshan app workspace
  -> project/SConstruct and project/proj.conf
  -> src/gui_apps/<AppName>/main.c
  -> src/gui_apps/<AppName>/SConscript
  -> src/resource/*

Generated app capsule
  -> one launcher app slot
  -> optional proj.conf capability delta
  -> evidence expectations
```

The target board remains selected by SCons:

```text
scons --board=sf32lb52-lchspi-ulp
```

This means VibeBoard should treat the board as stable infrastructure and generate
only application-layer code that consumes board capabilities.

## Ownership Boundaries

VibeBoard may generate:

```text
src/gui_apps/<AppName>/main.c
src/gui_apps/<AppName>/SConscript
project/proj.conf capability delta
```

VibeBoard may inspect but must not rewrite by default:

```text
project/SConstruct
project/SConscript
src/gui_apps/SConscript
src/resource/*
```

VibeBoard must not edit from the web flow:

```text
sifli-sdk/
customer/boards/*
customer/peripherals/*
drivers/
middleware/
rtos/
```

If an issue requires SDK or BSP changes, it should be reported as board bring-up
evidence, not repaired by app generation.

## Huangshan App Capsule

The native unit of generation should be a Huangshan App Capsule:

```json
{
  "schemaVersion": 1,
  "kind": "huangshan-app-capsule",
  "app": {
    "displayName": "Example Sensor Hub",
    "appId": "ex_sensor",
    "slot": "src/gui_apps/Example_Sensor_Hub",
    "launcher": "BUILTIN_APP_EXPORT"
  },
  "board": {
    "target": "sf32lb52-lchspi-ulp",
    "display": "CO5300",
    "touch": "FT6146"
  },
  "capabilities": [
    "ambient_light",
    "imu",
    "magnetometer",
    "battery",
    "adc_gpio",
    "key",
    "led"
  ],
  "projConfDelta": [
    "CONFIG_BSP_USING_I2C3=y",
    "CONFIG_SENSOR_USING_ASL=y"
  ],
  "exampleReferences": [
    "RT-Device/sensor",
    "adc/src/main.c",
    "gpio/src/main.c",
    "ws2812/src/main.c"
  ],
  "acceptanceEvidence": [
    "SCons build succeeds",
    "main.bin generated",
    "serial log contains display on",
    "serial log contains app start"
  ]
}
```

This capsule is similar in purpose to the ESP-IDF Program Manifest, but it is not
the same shape. It describes an app mounted into an existing SiFli board
workspace, not a whole firmware project assembled from scratch.

## Capability Binding

Capabilities should be bound to verified Huangshan facts:

| Capability | Verified binding |
| --- | --- |
| `ambient_light` | LTR303 on I2C3, PA39 SDA, PA40 SCL, device `li_ltr303` |
| `imu` | LSM6DSL on I2C3, device `acce_lsm` |
| `magnetometer` | MMC56X3 on I2C3, device `mag_mmc56x3` |
| `battery` | ADC device `bat1`, VBAT channel `7` |
| `adc_gpio` | PA34 ADC channel `6` |
| `key` | KEY2 on GPIO43 / PA43 |
| `gpio_output` | example output pin GPIO20 |
| `led` | WS2812 device `rgbled`, PA32 / GPTIM2_CH1 |
| `uart2` | external UART2, RX PA18, TX PA19 |

The AI should not invent pin numbers or device names. If the request asks for an
unknown hardware function, the flow should ask for clarification or mark the
capability as unsupported until an example or board document is added.

## Build Evidence

Huangshan build evidence should be interpreted through SiFli/SCons concepts:

```text
SDK/environment failures
board bring-up failures
proj.conf capability failures
SConscript/include failures
generated app source failures
artifact failures
```

Only generated app source failures are automatically repairable by AI. SDK,
board, display, touch, and downloader failures must be surfaced as environment
or bring-up issues.

## Device Evidence

A successful build is necessary but not sufficient for hardware behavior. Device
evidence should parse the debug serial log for:

```text
SFBL
Found lcd co5300 id
touch screen found driver
display on
[<AppName>] registered
[<AppName>] start
light:
acce:
mag:
VBAT read value:
PA34 ADC read value:
```

The exact evidence required should come from the capsule's selected
capabilities.

## Architecture Direction

The next implementation step is to introduce `HuangshanAppCapsule` as the core
domain object and make Builder JSON compile into that capsule before generating
files. That gives Huangshan its own architecture while preserving the good parts
of the ESP-IDF workflow: explicit intent, strict write surfaces, build evidence,
and repair boundaries.
