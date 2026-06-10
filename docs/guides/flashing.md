# USB Flashing

VibeBoard supports browser USB flashing through Web Serial and `esptool-js`.
The page must run in a secure browser context.

Valid contexts:

- `http://localhost:5173` during local development.
- HTTPS deployment URLs.

Invalid for USB flashing:

- Plain public HTTP FRP URLs.

## Full Flash

When the compiler result includes a flash manifest, the browser writes all
required images:

```text
bootloader        0x0
partition-table   0x8000
ota-data          0xD000
app               0x10000
```

Use this path for OTA receiver firmware and for any firmware that depends on a
specific partition table.

## App-Only Flash

When the compiler result only contains an app binary, USB flashing falls back
to:

```text
app               0x10000
```

This is useful for simple generated apps, but it does not install or repair the
OTA partition table.

## First-Time OTA Receiver Flash

If you want to use WiFi OTA later, first flash the OTA receiver firmware:

1. Open the compile/flash panel.
2. Select OTA receiver firmware.
3. Fill WiFi SSID and password.
4. Compile.
5. Use USB Web Serial flashing.

The full flash manifest is required. If only the app image is written, OTA can
fail with:

```text
no ota partition
```

## HTTPS Deployment

Deployment details for Web Serial are maintained in
[deploy/HTTPS_USB_FLASH.md](../../deploy/HTTPS_USB_FLASH.md).
