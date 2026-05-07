#pragma once

/**
 * BLE OTA Service
 *
 * Service UUID:  4FAFC201-1FB5-459E-8FCC-C5C9C331914B
 *
 * Characteristics:
 *   CTRL  (write)           — control commands (start / commit / abort)
 *   DATA  (write-no-rsp)    — firmware chunks, max (MTU-3) bytes each
 *   STATUS (notify)         — progress / success / error
 *
 * Protocol:
 *   1. Browser → CTRL: [0x01, size_lo, size_hi, size_hh, size_hhh]  (start OTA)
 *   2. ESP32  → STATUS: [0x00]                                        (ready)
 *   3. Browser → DATA: chunk0, chunk1, … (512 bytes each)
 *      ESP32  → STATUS: [0x01, rcvd_3, rcvd_2, rcvd_1, rcvd_0]      (every 64KB)
 *   4. Browser → CTRL: [0x02]                                         (commit)
 *   5. ESP32  → STATUS: [0x02]   success  /  [0x03, msg…]  error
 *   6. ESP32 reboots
 */

void ble_ota_start(void);
