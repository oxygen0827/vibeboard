idf_component_register(SRCS "esp32_s3_szp.c"
                        INCLUDE_DIRS "."
                        REQUIRES driver esp_lcd esp_timer fatfs freertos nvs_flash sdmmc spiffs)
