# OTA Workflows

VibeBoard currently has three OTA-style delivery paths:

- WiFi LAN OTA push from the browser to the device.
- Remote OTA pull where the device contacts the VibeBoard server.
- BLE OTA to the BLE OTA receiver firmware.

## WiFi LAN OTA

LAN OTA requires the browser and ESP32-S3 board to be reachable on the same
network.

```text
browser -> http://<device-ip>:3232/ota
```

Workflow:

1. Flash the OTA receiver firmware by USB full flash.
2. Read the device IP from serial logs or the router DHCP list.
3. Build a generated app or official example.
4. Enter the device IP in the compile/flash panel.
5. Start WiFi OTA push.

The OTA receiver exposes:

```text
http://<device-ip>:3232/ping
http://<device-ip>:3232/info
http://<device-ip>:3232/ota
```

Most official examples do not include the OTA service. After flashing one by
OTA, the board may need USB flashing again before the next OTA workflow.

## Remote OTA Pull

Remote OTA is for devices that can reach the VibeBoard server but are not on
the same LAN as the browser.

```text
device agent
  -> POST /api/devices/heartbeat
  -> GET /api/devices/<deviceId>/ota-job
  -> download firmware.bin
  -> write OTA partition and reboot
```

Workflow:

1. Build OTA receiver firmware with WiFi credentials, server URL, device ID,
   and device token.
2. USB full flash that receiver firmware.
3. Wait for the device heartbeat to appear in the server device list.
4. Build the target firmware.
5. Create a remote OTA job for the selected device.
6. The device downloads and applies the firmware.

Current remote OTA state is stored by the compiler service under:

```text
/tmp/vibeboard-remote-ota
```

Production deployment should persist this path or move the state into database
and object storage.

## BLE OTA

BLE OTA uses the BLE OTA receiver firmware. The receiver advertises as:

```text
ESP32-Vibe-OTA
```

Use BLE OTA when WiFi is unavailable or when testing a local wireless update
path. Keep BLE failure states visible in the UI because browser BLE support and
device pairing behavior vary by operating system and browser.
