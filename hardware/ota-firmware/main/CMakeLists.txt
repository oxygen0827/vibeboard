idf_component_register(
    SRCS "main.c" "ota_ble.c"
    INCLUDE_DIRS "."
    REQUIRES nvs_flash esp_wifi esp_http_server esp_ota bt
)
