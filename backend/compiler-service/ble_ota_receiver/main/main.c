#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_gap_ble_api.h"
#include "esp_gatt_common_api.h"
#include "esp_gatts_api.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "nvs_flash.h"

#define TAG "VibeBoardBLEOTA"
#define DEVICE_NAME "ESP32-Vibe-OTA"
#define PROFILE_APP_ID 0x56
#define SVC_INST_ID 0
#define PROFILE_NUM 1
#define PROFILE_APP_IDX 0
#define STATUS_PROGRESS_STEP 4096
#define CHAR_DECLARATION_SIZE sizeof(uint8_t)
#define ADV_INTERVAL_20_MS 0x20
#define ADV_INTERVAL_40_MS 0x40
#define CONN_INTERVAL_20_MS 0x10
#define CONN_INTERVAL_40_MS 0x20

enum {
    IDX_SVC,
    IDX_CTRL_CHAR,
    IDX_CTRL_VAL,
    IDX_DATA_CHAR,
    IDX_DATA_VAL,
    IDX_STATUS_CHAR,
    IDX_STATUS_VAL,
    IDX_STATUS_CFG,
    IDX_NB,
};

static const uint16_t primary_service_uuid = ESP_GATT_UUID_PRI_SERVICE;
static const uint16_t character_declaration_uuid = ESP_GATT_UUID_CHAR_DECLARE;
static const uint16_t character_client_config_uuid = ESP_GATT_UUID_CHAR_CLIENT_CONFIG;
static const uint8_t char_prop_write = ESP_GATT_CHAR_PROP_BIT_WRITE;
static const uint8_t char_prop_write_and_write_nr = ESP_GATT_CHAR_PROP_BIT_WRITE | ESP_GATT_CHAR_PROP_BIT_WRITE_NR;
static const uint8_t char_prop_notify = ESP_GATT_CHAR_PROP_BIT_NOTIFY;
static const uint8_t status_ccc[2] = {0x00, 0x00};
static uint8_t empty_value[1] = {0};

/* UUID bytes are little-endian for ESP-IDF attribute tables. */
static const uint8_t svc_uuid[16] = {
    0x4b, 0x91, 0x31, 0xc3, 0xc9, 0xc5, 0xcc, 0x8f,
    0x9e, 0x45, 0xb5, 0x1f, 0x01, 0xc2, 0xaf, 0x4f,
};
static const uint8_t ctrl_uuid[16] = {
    0xa8, 0x26, 0x1b, 0x36, 0x07, 0xea, 0xf5, 0xb7,
    0x88, 0x46, 0xe1, 0x36, 0x3e, 0x48, 0xb5, 0xbe,
};
static const uint8_t data_uuid[16] = {
    0x4b, 0x91, 0x31, 0xc3, 0xc9, 0xc5, 0xcc, 0x8f,
    0x9e, 0x45, 0xb5, 0x1f, 0xcd, 0xab, 0x34, 0x12,
};
static const uint8_t status_uuid[16] = {
    0x4b, 0x91, 0x31, 0xc3, 0xc9, 0xc5, 0xcc, 0x8f,
    0x9e, 0x45, 0xb5, 0x1f, 0x34, 0x12, 0xcd, 0xab,
};

static uint16_t handle_table[IDX_NB];
static uint8_t adv_config_done;
static esp_gatt_if_t s_gatts_if = ESP_GATT_IF_NONE;
static uint16_t s_conn_id;
static bool s_connected;
static bool s_notify_enabled;
static const esp_partition_t *s_partition;
static esp_ota_handle_t s_ota_handle;
static bool s_ota_active;
static uint32_t s_expected_size;
static uint32_t s_written;
static uint32_t s_last_progress;
static bool s_commit_pending;

#define ADV_CONFIG_FLAG (1 << 0)
#define SCAN_RSP_CONFIG_FLAG (1 << 1)

static esp_ble_adv_params_t adv_params = {
    .adv_int_min = ADV_INTERVAL_20_MS,
    .adv_int_max = ADV_INTERVAL_40_MS,
    .adv_type = ADV_TYPE_IND,
    .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
    .channel_map = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

static esp_ble_adv_data_t adv_data = {
    .set_scan_rsp = false,
    .include_name = false,
    .include_txpower = false,
    .min_interval = CONN_INTERVAL_20_MS,
    .max_interval = CONN_INTERVAL_40_MS,
    .appearance = 0,
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = sizeof(svc_uuid),
    .p_service_uuid = (uint8_t *)svc_uuid,
    .flag = ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT,
};

static esp_ble_adv_data_t scan_rsp_data = {
    .set_scan_rsp = true,
    .include_name = true,
    .include_txpower = false,
    .min_interval = CONN_INTERVAL_20_MS,
    .max_interval = CONN_INTERVAL_40_MS,
    .appearance = 0,
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 0,
    .p_service_uuid = NULL,
    .flag = ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT,
};

static const esp_gatts_attr_db_t gatt_db[IDX_NB] = {
    [IDX_SVC] =
        {{ESP_GATT_AUTO_RSP}, {ESP_UUID_LEN_16, (uint8_t *)&primary_service_uuid, ESP_GATT_PERM_READ,
          sizeof(svc_uuid), sizeof(svc_uuid), (uint8_t *)svc_uuid}},

    [IDX_CTRL_CHAR] =
        {{ESP_GATT_AUTO_RSP}, {ESP_UUID_LEN_16, (uint8_t *)&character_declaration_uuid, ESP_GATT_PERM_READ,
          CHAR_DECLARATION_SIZE, CHAR_DECLARATION_SIZE, (uint8_t *)&char_prop_write}},
    [IDX_CTRL_VAL] =
        {{ESP_GATT_RSP_BY_APP}, {ESP_UUID_LEN_128, (uint8_t *)ctrl_uuid, ESP_GATT_PERM_WRITE,
          32, sizeof(empty_value), empty_value}},

    [IDX_DATA_CHAR] =
        {{ESP_GATT_AUTO_RSP}, {ESP_UUID_LEN_16, (uint8_t *)&character_declaration_uuid, ESP_GATT_PERM_READ,
          CHAR_DECLARATION_SIZE, CHAR_DECLARATION_SIZE, (uint8_t *)&char_prop_write_and_write_nr}},
    [IDX_DATA_VAL] =
        {{ESP_GATT_RSP_BY_APP}, {ESP_UUID_LEN_128, (uint8_t *)data_uuid, ESP_GATT_PERM_WRITE,
          512, sizeof(empty_value), empty_value}},

    [IDX_STATUS_CHAR] =
        {{ESP_GATT_AUTO_RSP}, {ESP_UUID_LEN_16, (uint8_t *)&character_declaration_uuid, ESP_GATT_PERM_READ,
          CHAR_DECLARATION_SIZE, CHAR_DECLARATION_SIZE, (uint8_t *)&char_prop_notify}},
    [IDX_STATUS_VAL] =
        {{ESP_GATT_AUTO_RSP}, {ESP_UUID_LEN_128, (uint8_t *)status_uuid, ESP_GATT_PERM_READ,
          64, sizeof(empty_value), empty_value}},
    [IDX_STATUS_CFG] =
        {{ESP_GATT_AUTO_RSP}, {ESP_UUID_LEN_16, (uint8_t *)&character_client_config_uuid, ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE,
          sizeof(uint16_t), sizeof(status_ccc), (uint8_t *)status_ccc}},
};

struct gatts_profile_inst {
    esp_gatts_cb_t gatts_cb;
    esp_gatt_if_t gatts_if;
};

static void gatts_profile_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param);

static struct gatts_profile_inst profile_tab[PROFILE_NUM] = {
    [PROFILE_APP_IDX] = {
        .gatts_cb = gatts_profile_event_handler,
        .gatts_if = ESP_GATT_IF_NONE,
    },
};

static uint32_t be32(const uint8_t *p)
{
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3];
}

static void put_be32(uint8_t *p, uint32_t v)
{
    p[0] = (uint8_t)(v >> 24);
    p[1] = (uint8_t)(v >> 16);
    p[2] = (uint8_t)(v >> 8);
    p[3] = (uint8_t)v;
}

static void notify_status(const uint8_t *data, uint16_t len)
{
    if (!s_connected || !s_notify_enabled || s_gatts_if == ESP_GATT_IF_NONE) {
        return;
    }
    esp_ble_gatts_send_indicate(s_gatts_if, s_conn_id, handle_table[IDX_STATUS_VAL], len, (uint8_t *)data, false);
}

static void notify_code(uint8_t code)
{
    notify_status(&code, 1);
}

static void notify_progress(bool force)
{
    if (!force && s_written - s_last_progress < STATUS_PROGRESS_STEP) {
        return;
    }
    s_last_progress = s_written;
    uint8_t status[5] = {0x01, 0, 0, 0, 0};
    put_be32(status + 1, s_written);
    notify_status(status, sizeof(status));
}

static void notify_error(const char *msg)
{
    uint8_t status[64] = {0x03};
    size_t msg_len = strnlen(msg, sizeof(status) - 1);
    memcpy(status + 1, msg, msg_len);
    notify_status(status, (uint16_t)(msg_len + 1));
    ESP_LOGE(TAG, "%s", msg);
}

static void abort_ota(void)
{
    if (s_ota_active) {
        esp_ota_abort(s_ota_handle);
    }
    s_ota_active = false;
    s_ota_handle = 0;
    s_partition = NULL;
    s_expected_size = 0;
    s_written = 0;
    s_last_progress = 0;
    s_commit_pending = false;
}

static esp_err_t start_ota(uint32_t size)
{
    abort_ota();
    if (size == 0) {
        notify_error("empty firmware");
        return ESP_FAIL;
    }
    s_partition = esp_ota_get_next_update_partition(NULL);
    if (!s_partition) {
        notify_error("no ota partition");
        return ESP_FAIL;
    }
    esp_err_t err = esp_ota_begin(s_partition, size, &s_ota_handle);
    if (err != ESP_OK) {
        notify_error("ota begin failed");
        return err;
    }
    s_expected_size = size;
    s_written = 0;
    s_last_progress = 0;
    s_ota_active = true;
    ESP_LOGI(TAG, "OTA start: %" PRIu32 " bytes -> %s", size, s_partition->label);
    notify_code(0x00);
    return ESP_OK;
}

static esp_err_t write_ota_data(const uint8_t *data, uint16_t len)
{
    if (!s_ota_active) {
        return ESP_FAIL;
    }
    if (s_written + len > s_expected_size) {
        notify_error("firmware too large");
        abort_ota();
        return ESP_FAIL;
    }
    esp_err_t err = esp_ota_write(s_ota_handle, data, len);
    if (err != ESP_OK) {
        notify_error("ota write failed");
        abort_ota();
        return err;
    }
    s_written += len;
    notify_progress(false);
    return ESP_OK;
}

static void restart_task(void *arg)
{
    vTaskDelay(pdMS_TO_TICKS(900));
    esp_restart();
}

static void commit_task(void *arg)
{
    vTaskDelay(pdMS_TO_TICKS(50));
    ESP_LOGI(TAG, "OTA commit requested: written=%" PRIu32 " expected=%" PRIu32, s_written, s_expected_size);
    if (!s_ota_active) {
        notify_error("ota not started");
        s_commit_pending = false;
        vTaskDelete(NULL);
        return;
    }
    if (s_written != s_expected_size) {
        notify_error("size mismatch");
        abort_ota();
        vTaskDelete(NULL);
        return;
    }
    notify_progress(true);
    esp_err_t err = esp_ota_end(s_ota_handle);
    if (err != ESP_OK) {
        notify_error("ota end failed");
        abort_ota();
        vTaskDelete(NULL);
        return;
    }
    err = esp_ota_set_boot_partition(s_partition);
    if (err != ESP_OK) {
        notify_error("set boot failed");
        abort_ota();
        vTaskDelete(NULL);
        return;
    }
    s_ota_active = false;
    s_ota_handle = 0;
    s_commit_pending = false;
    ESP_LOGI(TAG, "OTA complete, restarting");
    notify_code(0x02);
    xTaskCreate(restart_task, "restart_task", 2048, NULL, 5, NULL);
    vTaskDelete(NULL);
}

static void schedule_commit(void)
{
    if (s_commit_pending) {
        ESP_LOGW(TAG, "OTA commit already pending");
        return;
    }
    s_commit_pending = true;
    if (xTaskCreate(commit_task, "commit_task", 4096, NULL, 5, NULL) != pdPASS) {
        s_commit_pending = false;
        notify_error("commit task failed");
    }
}

static void handle_ctrl_write(const uint8_t *value, uint16_t len)
{
    if (len < 1) {
        notify_error("empty command");
        return;
    }
    uint8_t cmd = value[0];
    if (cmd == 0x01) {
        if (len != 5) {
            notify_error("bad start command");
            return;
        }
        start_ota(be32(value + 1));
    } else if (cmd == 0x02) {
        schedule_commit();
    } else if (cmd == 0x03) {
        abort_ota();
        notify_error("aborted");
    } else {
        notify_error("unknown command");
    }
}

static void send_write_response(esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    if (param->write.need_rsp) {
        esp_ble_gatts_send_response(gatts_if, param->write.conn_id, param->write.trans_id, ESP_GATT_OK, NULL);
    }
}

static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
    case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
        adv_config_done &= ~ADV_CONFIG_FLAG;
        if (adv_config_done == 0) esp_ble_gap_start_advertising(&adv_params);
        break;
    case ESP_GAP_BLE_SCAN_RSP_DATA_SET_COMPLETE_EVT:
        adv_config_done &= ~SCAN_RSP_CONFIG_FLAG;
        if (adv_config_done == 0) esp_ble_gap_start_advertising(&adv_params);
        break;
    case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
        ESP_LOGI(TAG, "advertising %s", param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS ? "started" : "failed");
        break;
    case ESP_GAP_BLE_UPDATE_CONN_PARAMS_EVT:
        ESP_LOGI(TAG, "conn params status=%d int=%d latency=%d timeout=%d",
                 param->update_conn_params.status,
                 param->update_conn_params.conn_int,
                 param->update_conn_params.latency,
                 param->update_conn_params.timeout);
        break;
    default:
        break;
    }
}

static void gatts_profile_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    switch (event) {
    case ESP_GATTS_REG_EVT:
        esp_ble_gap_set_device_name(DEVICE_NAME);
        adv_config_done |= ADV_CONFIG_FLAG;
        esp_ble_gap_config_adv_data(&adv_data);
        adv_config_done |= SCAN_RSP_CONFIG_FLAG;
        esp_ble_gap_config_adv_data(&scan_rsp_data);
        esp_ble_gatts_create_attr_tab(gatt_db, gatts_if, IDX_NB, SVC_INST_ID);
        break;

    case ESP_GATTS_WRITE_EVT:
        if (!param->write.is_prep) {
            if (param->write.handle == handle_table[IDX_STATUS_CFG] && param->write.len == 2) {
                uint16_t descr_value = ((uint16_t)param->write.value[1] << 8) | param->write.value[0];
                s_notify_enabled = (descr_value == 0x0001);
                ESP_LOGI(TAG, "notify %s", s_notify_enabled ? "enabled" : "disabled");
            } else if (param->write.handle == handle_table[IDX_CTRL_VAL]) {
                handle_ctrl_write(param->write.value, param->write.len);
            } else if (param->write.handle == handle_table[IDX_DATA_VAL]) {
                write_ota_data(param->write.value, param->write.len);
            }
            send_write_response(gatts_if, param);
        }
        break;

    case ESP_GATTS_MTU_EVT:
        ESP_LOGI(TAG, "MTU %d", param->mtu.mtu);
        break;

    case ESP_GATTS_CONNECT_EVT: {
        s_gatts_if = gatts_if;
        s_conn_id = param->connect.conn_id;
        s_connected = true;
        s_notify_enabled = false;
        ESP_LOGI(TAG, "connected conn_id=%d", s_conn_id);
        esp_ble_conn_update_params_t conn_params = {0};
        memcpy(conn_params.bda, param->connect.remote_bda, sizeof(esp_bd_addr_t));
        conn_params.latency = 0;
        conn_params.max_int = 0x20;
        conn_params.min_int = 0x10;
        conn_params.timeout = 400;
        esp_ble_gap_update_conn_params(&conn_params);
        break;
    }

    case ESP_GATTS_DISCONNECT_EVT:
        ESP_LOGI(TAG, "disconnected reason=0x%x", param->disconnect.reason);
        s_connected = false;
        s_notify_enabled = false;
        abort_ota();
        esp_ble_gap_start_advertising(&adv_params);
        break;

    case ESP_GATTS_CREAT_ATTR_TAB_EVT:
        if (param->add_attr_tab.status != ESP_GATT_OK || param->add_attr_tab.num_handle != IDX_NB) {
            ESP_LOGE(TAG, "create attr table failed status=0x%x handles=%d", param->add_attr_tab.status, param->add_attr_tab.num_handle);
            break;
        }
        memcpy(handle_table, param->add_attr_tab.handles, sizeof(handle_table));
        esp_ble_gatts_start_service(handle_table[IDX_SVC]);
        break;

    default:
        break;
    }
}

static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    if (event == ESP_GATTS_REG_EVT) {
        if (param->reg.status == ESP_GATT_OK) {
            profile_tab[PROFILE_APP_IDX].gatts_if = gatts_if;
        } else {
            ESP_LOGE(TAG, "register app failed status=%d", param->reg.status);
            return;
        }
    }
    for (int idx = 0; idx < PROFILE_NUM; idx++) {
        if (gatts_if == ESP_GATT_IF_NONE || gatts_if == profile_tab[idx].gatts_if) {
            if (profile_tab[idx].gatts_cb) {
                profile_tab[idx].gatts_cb(event, gatts_if, param);
            }
        }
    }
}

void app_main(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    esp_ota_mark_app_valid_cancel_rollback();

    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));
    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());
    ESP_ERROR_CHECK(esp_ble_gatts_register_callback(gatts_event_handler));
    ESP_ERROR_CHECK(esp_ble_gap_register_callback(gap_event_handler));
    ESP_ERROR_CHECK(esp_ble_gatts_app_register(PROFILE_APP_ID));
    ESP_ERROR_CHECK(esp_ble_gatt_set_local_mtu(500));

    ESP_LOGI(TAG, "BLE OTA receiver ready: %s", DEVICE_NAME);
}
