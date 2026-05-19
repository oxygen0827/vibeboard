/**
 * BLE OTA Service — NimBLE implementation
 * 立创实战派ESP32-S3 / ESP-IDF v5.4
 */

#include <string.h>
#include "ota_ble.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

static const char *TAG = "ble-ota";

/* ── UUIDs ────────────────────────────────────────────────── */
/* 128-bit: stored little-endian in NimBLE */
static const ble_uuid128_t SVC_UUID = BLE_UUID128_INIT(
    0x4b, 0x91, 0x31, 0xC3, 0xC9, 0xC5, 0xCC, 0x8F,
    0x9E, 0x45, 0xB5, 0x1F, 0x01, 0xC2, 0xAF, 0x4F);

static const ble_uuid128_t CTRL_UUID = BLE_UUID128_INIT(
    0xA8, 0x26, 0x1B, 0x36, 0x07, 0xEA, 0xF5, 0xB7,
    0x88, 0x46, 0xE1, 0x36, 0x3E, 0x48, 0xB5, 0xBE);

static const ble_uuid128_t DATA_UUID = BLE_UUID128_INIT(
    0x4B, 0x91, 0x31, 0xC3, 0xC9, 0xC5, 0xCC, 0x8F,
    0x9E, 0x45, 0xB5, 0x1F, 0xCD, 0xAB, 0x34, 0x12);

static const ble_uuid128_t STATUS_UUID = BLE_UUID128_INIT(
    0x4B, 0x91, 0x31, 0xC3, 0xC9, 0xC5, 0xCC, 0x8F,
    0x9E, 0x45, 0xB5, 0x1F, 0x34, 0x12, 0xCD, 0xAB);

/* ── State ────────────────────────────────────────────────── */
static uint16_t s_conn_handle   = BLE_HS_CONN_HANDLE_NONE;
static uint16_t s_status_handle = 0;

typedef enum { OTA_IDLE, OTA_RECV, OTA_DONE } ota_state_t;
static ota_state_t      s_state       = OTA_IDLE;
static esp_ota_handle_t s_ota_handle  = 0;
static uint32_t         s_total       = 0;
static uint32_t         s_received    = 0;
static const esp_partition_t *s_part  = NULL;

/* ── Status notify helper ─────────────────────────────────── */
static void notify_status(uint8_t *buf, size_t len)
{
    if (s_conn_handle == BLE_HS_CONN_HANDLE_NONE || !s_status_handle) return;
    struct os_mbuf *om = ble_hs_mbuf_from_flat(buf, len);
    if (!om) return;
    ble_gatts_notify_custom(s_conn_handle, s_status_handle, om);
}

static void notify_ready(void)   { uint8_t b = 0x00; notify_status(&b, 1); }
static void notify_success(void) { uint8_t b = 0x02; notify_status(&b, 1); }
static void notify_error(const char *msg)
{
    uint8_t buf[64]; buf[0] = 0x03;
    size_t n = strlen(msg);
    if (n > 62) n = 62;
    memcpy(buf+1, msg, n);
    notify_status(buf, n+1);
}
static void notify_progress(void)
{
    uint8_t buf[5] = { 0x01,
        (s_received >> 24) & 0xFF,
        (s_received >> 16) & 0xFF,
        (s_received >>  8) & 0xFF,
         s_received        & 0xFF };
    notify_status(buf, 5);
}

/* ── CTRL characteristic handler ─────────────────────────── */
static int ctrl_write_cb(uint16_t conn_hdl, uint16_t attr_hdl,
                         struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_hdl; (void)attr_hdl; (void)arg;
    uint8_t cmd;
    uint16_t om_len = OS_MBUF_PKTLEN(ctxt->om);
    if (om_len < 1) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    ble_hs_mbuf_to_flat(ctxt->om, &cmd, 1, NULL);

    if (cmd == 0x01 && om_len == 5) {
        /* Start OTA */
        if (s_state != OTA_IDLE) {
            notify_error("already in progress");
            return 0;
        }
        uint8_t size_buf[4];
        os_mbuf_copydata(ctxt->om, 1, 4, size_buf);
        s_total    = ((uint32_t)size_buf[0] << 24) | ((uint32_t)size_buf[1] << 16) |
                     ((uint32_t)size_buf[2] <<  8) |  (uint32_t)size_buf[3];
        s_received = 0;
        s_part     = esp_ota_get_next_update_partition(NULL);
        if (!s_part) { notify_error("no OTA partition"); return 0; }

        if (esp_ota_begin(s_part, s_total, &s_ota_handle) != ESP_OK) {
            notify_error("ota_begin failed");
            return 0;
        }
        s_state = OTA_RECV;
        ESP_LOGI(TAG, "BLE OTA start, total=%lu bytes", (unsigned long)s_total);
        notify_ready();

    } else if (cmd == 0x02) {
        /* Commit */
        if (s_state != OTA_RECV) { notify_error("not in progress"); return 0; }

        if (esp_ota_end(s_ota_handle) != ESP_OK) {
            s_state = OTA_IDLE;
            notify_error("ota_end failed (checksum?)");
            return 0;
        }
        if (esp_ota_set_boot_partition(s_part) != ESP_OK) {
            s_state = OTA_IDLE;
            notify_error("set_boot failed");
            return 0;
        }
        s_state = OTA_DONE;
        ESP_LOGI(TAG, "BLE OTA success! Rebooting...");
        notify_success();
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();

    } else if (cmd == 0x03) {
        /* Abort */
        if (s_state == OTA_RECV) esp_ota_abort(s_ota_handle);
        s_state = OTA_IDLE;
        ESP_LOGW(TAG, "BLE OTA aborted by client");
    }
    return 0;
}

/* ── DATA characteristic handler ─────────────────────────── */
static int data_write_cb(uint16_t conn_hdl, uint16_t attr_hdl,
                         struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)conn_hdl; (void)attr_hdl; (void)arg;
    if (s_state != OTA_RECV) return 0;

    uint16_t len = OS_MBUF_PKTLEN(ctxt->om);
    uint8_t  buf[512];
    if (len > sizeof(buf)) return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;

    ble_hs_mbuf_to_flat(ctxt->om, buf, len, NULL);

    if (esp_ota_write(s_ota_handle, buf, len) != ESP_OK) {
        notify_error("ota_write failed");
        s_state = OTA_IDLE;
        return 0;
    }
    s_received += len;

    /* Progress notify every 64KB */
    if (s_received % (64 * 1024) < (uint32_t)len) {
        notify_progress();
        ESP_LOGI(TAG, "BLE OTA progress: %lu / %lu", (unsigned long)s_received, (unsigned long)s_total);
    }
    return 0;
}

/* ── GATT service table ───────────────────────────────────── */
static const struct ble_gatt_svc_def s_gatt_svcs[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &SVC_UUID.u,
        .characteristics = (struct ble_gatt_chr_def[]) {
            {   /* CTRL */
                .uuid       = &CTRL_UUID.u,
                .access_cb  = ctrl_write_cb,
                .flags      = BLE_GATT_CHR_F_WRITE,
            },
            {   /* DATA */
                .uuid       = &DATA_UUID.u,
                .access_cb  = data_write_cb,
                .flags      = BLE_GATT_CHR_F_WRITE_NO_RSP,
            },
            {   /* STATUS */
                .uuid       = &STATUS_UUID.u,
                .access_cb  = NULL,
                .val_handle = &s_status_handle,
                .flags      = BLE_GATT_CHR_F_NOTIFY,
            },
            { 0 } /* end */
        },
    },
    { 0 } /* end */
};

/* ── GAP event handler ────────────────────────────────────── */
static int gap_event_cb(struct ble_gap_event *event, void *arg)
{
    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if (event->connect.status == 0) {
            s_conn_handle = event->connect.conn_handle;
            ESP_LOGI(TAG, "BLE connected, handle=%d", s_conn_handle);
            /* Request max MTU for speed */
            ble_att_set_preferred_mtu(512);
            ble_gattc_exchange_mtu(s_conn_handle, NULL, NULL);
        }
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        s_conn_handle = BLE_HS_CONN_HANDLE_NONE;
        if (s_state == OTA_RECV) { esp_ota_abort(s_ota_handle); s_state = OTA_IDLE; }
        ESP_LOGI(TAG, "BLE disconnected, restarting adv");
        ble_gap_adv_start(BLE_OWN_ADDR_PUBLIC, NULL, BLE_HS_FOREVER,
            &(struct ble_gap_adv_params){ .conn_mode = BLE_GAP_CONN_MODE_UND,
                                          .disc_mode = BLE_GAP_DISC_MODE_GEN }, gap_event_cb, NULL);
        break;
    case BLE_GAP_EVENT_MTU:
        ESP_LOGI(TAG, "MTU negotiated: %d", event->mtu.value);
        break;
    default: break;
    }
    return 0;
}

/* ── BLE host task ────────────────────────────────────────── */
static void ble_host_task(void *param)
{
    nimble_port_run();
    nimble_port_freertos_deinit();
}

/* ── Advertise ────────────────────────────────────────────── */
static void start_advertising(void)
{
    uint8_t own_addr_type;
    ble_hs_id_infer_auto(0, &own_addr_type);

    struct ble_hs_adv_fields fields = {
        .flags              = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP,
        .name               = (uint8_t *)"ESP32-Vibe-OTA",
        .name_len           = 14,
        .name_is_complete   = 1,
        /* Include service UUID for browser filter */
        .uuids128           = &SVC_UUID,
        .num_uuids128       = 1,
        .uuids128_is_complete = 1,
    };
    ble_gap_adv_set_fields(&fields);

    struct ble_gap_adv_params params = {
        .conn_mode = BLE_GAP_CONN_MODE_UND,
        .disc_mode = BLE_GAP_DISC_MODE_GEN,
    };
    ble_gap_adv_start(own_addr_type, NULL, BLE_HS_FOREVER, &params, gap_event_cb, NULL);
    ESP_LOGI(TAG, "BLE advertising as 'ESP32-Vibe-OTA'");
}

static void on_sync(void) { start_advertising(); }
static void on_reset(int reason) { ESP_LOGE(TAG, "BLE reset: %d", reason); }

/* ── Public init ──────────────────────────────────────────── */
void ble_ota_start(void)
{
    nimble_port_init();
    ble_hs_cfg.sync_cb  = on_sync;
    ble_hs_cfg.reset_cb = on_reset;

    ble_svc_gap_init();
    ble_svc_gatt_init();
    ble_gatts_count_cfg(s_gatt_svcs);
    ble_gatts_add_svcs(s_gatt_svcs);

    ble_svc_gap_device_name_set("ESP32-Vibe-OTA");

    nimble_port_freertos_init(ble_host_task);
    ESP_LOGI(TAG, "BLE OTA service started");
}
