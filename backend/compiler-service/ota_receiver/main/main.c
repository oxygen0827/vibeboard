#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

#include "esp_app_desc.h"
#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "nvs_flash.h"

#include "vibeboard_wifi_config.h"

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1
#define MAX_RETRY          10
#define OTA_PORT           3232
#define OTA_RECV_CHUNK     4096

static const char *TAG = "VibeBoardOTA";
static EventGroupHandle_t s_wifi_event_group;
static int s_retry_num;
static httpd_handle_t s_httpd;

static void add_cors_headers(httpd_req_t *req)
{
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
}

static esp_err_t ping_handler(httpd_req_t *req)
{
    add_cors_headers(req);
    httpd_resp_set_type(req, "application/json");
    return httpd_resp_sendstr(req, "{\"ok\":true}");
}

static esp_err_t info_handler(httpd_req_t *req)
{
    wifi_ap_record_t ap = {0};
    int rssi = 0;
    if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK) {
        rssi = ap.rssi;
    }

    esp_netif_ip_info_t ip = {0};
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (netif) {
        esp_netif_get_ip_info(netif, &ip);
    }

    char body[256];
    snprintf(body, sizeof(body),
             "{\"version\":\"%s\",\"ip\":\"" IPSTR "\",\"rssi\":%d,\"otaPort\":%d}",
             VIBEBOARD_FIRMWARE_VERSION,
             IP2STR(&ip.ip),
             rssi,
             OTA_PORT);

    add_cors_headers(req);
    httpd_resp_set_type(req, "application/json");
    return httpd_resp_sendstr(req, body);
}

static esp_err_t options_handler(httpd_req_t *req)
{
    add_cors_headers(req);
    httpd_resp_set_status(req, "204 No Content");
    return httpd_resp_send(req, NULL, 0);
}

static esp_err_t ota_handler(httpd_req_t *req)
{
    add_cors_headers(req);

    if (req->content_len <= 0) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "empty firmware");
        return ESP_FAIL;
    }

    const esp_partition_t *partition = esp_ota_get_next_update_partition(NULL);
    if (!partition) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "no ota partition");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "OTA start: %d bytes -> %s", req->content_len, partition->label);

    esp_ota_handle_t ota = 0;
    esp_err_t err = esp_ota_begin(partition, req->content_len, &ota);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_begin failed: %s", esp_err_to_name(err));
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "ota begin failed");
        return ESP_FAIL;
    }

    char *buf = malloc(OTA_RECV_CHUNK);
    if (!buf) {
        esp_ota_abort(ota);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "out of memory");
        return ESP_FAIL;
    }

    int remaining = req->content_len;
    int written = 0;
    while (remaining > 0) {
        int recv_len = httpd_req_recv(req, buf, remaining > OTA_RECV_CHUNK ? OTA_RECV_CHUNK : remaining);
        if (recv_len == HTTPD_SOCK_ERR_TIMEOUT) {
            continue;
        }
        if (recv_len <= 0) {
            free(buf);
            esp_ota_abort(ota);
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "receive failed");
            return ESP_FAIL;
        }

        err = esp_ota_write(ota, buf, recv_len);
        if (err != ESP_OK) {
            free(buf);
            esp_ota_abort(ota);
            ESP_LOGE(TAG, "esp_ota_write failed: %s", esp_err_to_name(err));
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "ota write failed");
            return ESP_FAIL;
        }
        written += recv_len;
        remaining -= recv_len;
    }
    free(buf);

    err = esp_ota_end(ota);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_end failed: %s", esp_err_to_name(err));
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "ota end failed");
        return ESP_FAIL;
    }

    err = esp_ota_set_boot_partition(partition);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_ota_set_boot_partition failed: %s", esp_err_to_name(err));
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "set boot partition failed");
        return ESP_FAIL;
    }

    char body[128];
    snprintf(body, sizeof(body), "{\"ok\":true,\"size\":%d,\"partition\":\"%s\"}", written, partition->label);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, body);

    ESP_LOGI(TAG, "OTA complete, restarting");
    vTaskDelay(pdMS_TO_TICKS(800));
    esp_restart();
    return ESP_OK;
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < MAX_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGW(TAG, "WiFi retry %d/%d", s_retry_num, MAX_RETRY);
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

static void wifi_init_sta(void)
{
    s_wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));

    wifi_config_t wifi_config = {0};
    strlcpy((char *)wifi_config.sta.ssid, VIBEBOARD_WIFI_SSID, sizeof(wifi_config.sta.ssid));
    strlcpy((char *)wifi_config.sta.password, VIBEBOARD_WIFI_PASSWORD, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    EventBits_t bits = xEventGroupWaitBits(
        s_wifi_event_group,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdFALSE,
        pdFALSE,
        pdMS_TO_TICKS(20000));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "Connected to SSID %s", VIBEBOARD_WIFI_SSID);
    } else {
        ESP_LOGE(TAG, "Failed to connect to SSID %s", VIBEBOARD_WIFI_SSID);
    }
}

static void start_http_ota_server(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = OTA_PORT;
    config.ctrl_port = OTA_PORT + 1;
    config.stack_size = 8192;

    ESP_ERROR_CHECK(httpd_start(&s_httpd, &config));

    httpd_uri_t ping = {.uri = "/ping", .method = HTTP_GET, .handler = ping_handler};
    httpd_uri_t info = {.uri = "/info", .method = HTTP_GET, .handler = info_handler};
    httpd_uri_t ota = {.uri = "/ota", .method = HTTP_POST, .handler = ota_handler};
    httpd_uri_t ota_options = {.uri = "/ota", .method = HTTP_OPTIONS, .handler = options_handler};
    ESP_ERROR_CHECK(httpd_register_uri_handler(s_httpd, &ping));
    ESP_ERROR_CHECK(httpd_register_uri_handler(s_httpd, &info));
    ESP_ERROR_CHECK(httpd_register_uri_handler(s_httpd, &ota));
    ESP_ERROR_CHECK(httpd_register_uri_handler(s_httpd, &ota_options));

    ESP_LOGI(TAG, "HTTP OTA server listening on port %d", OTA_PORT);
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
    ESP_LOGI(TAG, "VibeBoard OTA receiver %s", VIBEBOARD_FIRMWARE_VERSION);

    wifi_init_sta();
    start_http_ota_server();
}
