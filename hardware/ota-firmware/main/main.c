/**
 * ESP32 Vibe Coder 鈥?OTA Bootstrap Firmware
 * 绔嬪垱瀹炴垬娲綞SP32-S3
 *
 * 涓€娆℃€?USB 鐑у綍姝ゅ浐浠跺悗锛屽悗缁墍鏈夋洿鏂板潎鍙€氳繃 WiFi 鎺ㄩ€併€?
 *
 * 鍔熻兘锛?
 *   - 杩炴帴 WiFi锛圫TA 妯″紡锛?
 *   - HTTP 鏈嶅姟鍣ㄧ洃鍚?3232 绔彛
 *   - POST /ota     鈫?鎺ユ敹 .bin 鍥轰欢锛屽啓 OTA 鍒嗗尯锛岄噸鍚?
 *   - GET  /info    鈫?杩斿洖褰撳墠鍥轰欢鐗堟湰銆両P銆丷SSI
 *   - GET  /ping    鈫?娴忚鍣ㄥ績璺虫娴?
 *   - WebSocket /log 鈫?瀹炴椂鏃ュ織娴侊紙渚涙祻瑙堝櫒鏃ュ織闈㈡澘璁㈤槄锛?
 */

#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_http_server.h"
#include "esp_app_desc.h"
#include "nvs_flash.h"
#include "lwip/inet.h"
#include "ota_ble.h"

/* 鈹€鈹€ WiFi 鍑嵁 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
#define WIFI_SSID     CONFIG_OTA_WIFI_SSID
#define WIFI_PASS     CONFIG_OTA_WIFI_PASSWORD
#define OTA_PORT      3232
/* 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */

static const char *TAG = "vibe-ota";
static EventGroupHandle_t s_wifi_events;
#define CONNECTED_BIT BIT0

/* 鈹€鈹€ WebSocket 鏃ュ織 sink 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static httpd_handle_t s_server = NULL;
static int s_log_ws_fd = -1;

static int ws_log_vprintf(const char *fmt, va_list args)
{
    char buf[256];
    va_list ws_args;
    va_copy(ws_args, args);
    int n = vsnprintf(buf, sizeof(buf), fmt, ws_args);
    va_end(ws_args);

    if (s_log_ws_fd >= 0 && s_server) {
        httpd_ws_frame_t frame = {
            .type    = HTTPD_WS_TYPE_TEXT,
            .payload = (uint8_t *)buf,
            .len     = n,
        };
        httpd_ws_send_frame_async(s_server, s_log_ws_fd, &frame);
    }

    va_list console_args;
    va_copy(console_args, args);
    int written = vprintf(fmt, console_args);
    va_end(console_args);
    return written;
}

/* 鈹€鈹€ OTA 澶勭悊鍣?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static esp_err_t ota_post_handler(httpd_req_t *req)
{
    /* CORS 棰勬 */
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

    esp_ota_handle_t ota_handle;
    const esp_partition_t *ota_part = esp_ota_get_next_update_partition(NULL);
    if (!ota_part) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "no OTA partition");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "OTA start 鈫?partition: %s (offset 0x%08lx)",
             ota_part->label, (unsigned long)ota_part->address);

    ESP_ERROR_CHECK(esp_ota_begin(ota_part, OTA_WITH_SEQUENTIAL_WRITES, &ota_handle));

    char buf[1024];
    int  received = 0;
    int  content_len = req->content_len;

    while (received < content_len) {
        int chunk = httpd_req_recv(req, buf,
                        MIN((int)sizeof(buf), content_len - received));
        if (chunk <= 0) {
            if (chunk == HTTPD_SOCK_ERR_TIMEOUT) continue;
            ESP_LOGE(TAG, "recv error");
            esp_ota_abort(ota_handle);
            return ESP_FAIL;
        }
        ESP_ERROR_CHECK(esp_ota_write(ota_handle, buf, chunk));
        received += chunk;

        /* 杩涘害鏃ュ織锛堟瘡 64KB 涓€娆★級 */
        if (received % (64 * 1024) < (int)sizeof(buf)) {
            ESP_LOGI(TAG, "OTA progress: %d / %d bytes (%.0f%%)",
                     received, content_len,
                     100.0f * received / content_len);
        }
    }

    if (esp_ota_end(ota_handle) != ESP_OK) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OTA end failed");
        return ESP_FAIL;
    }
    if (esp_ota_set_boot_partition(ota_part) != ESP_OK) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "set boot failed");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "OTA success! Rebooting in 1s...");
    httpd_resp_set_hdr(req, "Content-Type", "application/json");
    httpd_resp_sendstr(req, "{\"status\":\"ok\",\"message\":\"rebooting\"}");

    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();
    return ESP_OK;
}

/* CORS 棰勬 */
static esp_err_t options_handler(httpd_req_t *req)
{
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
    httpd_resp_send(req, NULL, 0);
    return ESP_OK;
}

/* 鈹€鈹€ /info 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static esp_err_t info_get_handler(httpd_req_t *req)
{
    const esp_app_desc_t *desc = esp_app_get_description();
    esp_netif_ip_info_t ip_info;
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    esp_netif_get_ip_info(netif, &ip_info);

    wifi_ap_record_t ap;
    esp_wifi_sta_get_ap_info(&ap);

    char resp[256];
    snprintf(resp, sizeof(resp),
        "{\"version\":\"%s\",\"project\":\"%s\","
        "\"ip\":\"" IPSTR "\",\"rssi\":%d}",
        desc->version, desc->project_name,
        IP2STR(&ip_info.ip), ap.rssi);

    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, resp);
    return ESP_OK;
}

/* 鈹€鈹€ /ping 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static esp_err_t ping_get_handler(httpd_req_t *req)
{
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_sendstr(req, "pong");
    return ESP_OK;
}

/* 鈹€鈹€ /log WebSocket 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static esp_err_t log_ws_handler(httpd_req_t *req)
{
    if (req->method == HTTP_GET) {
        s_log_ws_fd = httpd_req_to_sockfd(req);
        ESP_LOGI(TAG, "Log WebSocket connected, fd=%d", s_log_ws_fd);
        return ESP_OK;
    }
    httpd_ws_frame_t frame = { .type = HTTPD_WS_TYPE_TEXT };
    esp_err_t ret = httpd_ws_recv_frame(req, &frame, 0);
    if (ret != ESP_OK) return ret;
    if (frame.type == HTTPD_WS_TYPE_CLOSE) {
        s_log_ws_fd = -1;
    }
    return ESP_OK;
}

/* 鈹€鈹€ HTTP 鏈嶅姟鍣ㄥ惎鍔?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static void start_server(void)
{
    httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
    cfg.server_port        = OTA_PORT;
    cfg.max_uri_handlers   = 8;
    cfg.lru_purge_enable   = true;

    ESP_ERROR_CHECK(httpd_start(&s_server, &cfg));

    httpd_uri_t uris[] = {
        { .uri = "/ota",  .method = HTTP_POST,    .handler = ota_post_handler },
        { .uri = "/ota",  .method = HTTP_OPTIONS,  .handler = options_handler  },
        { .uri = "/info", .method = HTTP_GET,      .handler = info_get_handler },
        { .uri = "/ping", .method = HTTP_GET,      .handler = ping_get_handler },
        { .uri = "/log",  .method = HTTP_GET,      .handler = log_ws_handler,
          .is_websocket = true },
    };
    for (int i = 0; i < 5; i++)
        httpd_register_uri_handler(s_server, &uris[i]);

    esp_log_set_vprintf(ws_log_vprintf);
    ESP_LOGI(TAG, "OTA server ready on port %d", OTA_PORT);
}

/* 鈹€鈹€ WiFi 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
static void wifi_event_handler(void *arg, esp_event_base_t base,
                               int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *e = (ip_event_got_ip_t *)data;
        ESP_LOGI(TAG, "WiFi connected 鈥?IP: " IPSTR, IP2STR(&e->ip_info.ip));
        xEventGroupSetBits(s_wifi_events, CONNECTED_BIT);
    }
}

static void wifi_init(void)
{
    s_wifi_events = xEventGroupCreate();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,  wifi_event_handler, NULL);
    esp_event_handler_register(IP_EVENT,   IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL);

    wifi_config_t wcfg = {
        .sta = {
            .ssid     = WIFI_SSID,
            .password = WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wcfg));
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_ERROR_CHECK(esp_wifi_connect());

    xEventGroupWaitBits(s_wifi_events, CONNECTED_BIT, false, true, portMAX_DELAY);
}

/* 鈹€鈹€ app_main 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    wifi_init();
    start_server();
    ble_ota_start(); /* BLE OTA 鈥?鏃?WiFi 鏃剁殑澶囩敤鐑у綍閫氶亾 */

    /* 蹇冭烦鏃ュ織 */
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(30000));
        ESP_LOGI(TAG, "OTA server alive, heap free: %lu bytes",
                 (unsigned long)esp_get_free_heap_size());
    }
}

