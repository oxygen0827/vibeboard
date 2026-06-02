idf_component_register(
    SRCS "main.c"
    INCLUDE_DIRS "."
    REQUIRES app_update esp_event esp_http_client esp_http_server esp_netif esp_wifi mbedtls nvs_flash
)
