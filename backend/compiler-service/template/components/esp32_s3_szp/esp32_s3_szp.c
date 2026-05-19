/*
 * esp32_s3_szp.c — BSP for 立创实战派ESP32-S3 (SZPI)
 * Module: ESP32-S3-WROOM-1-N16R8 (16MB Flash, 8MB Octal PSRAM)
 */

#include "esp32_s3_szp.h"

#include "driver/i2c_master.h"
#include "driver/spi_master.h"
#include "driver/ledc.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_vendor.h"  /* esp_lcd_new_panel_st7789() */
#include "esp_spiffs.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

/* Optional managed-component headers — compiled only when present */
#if __has_include("esp_lvgl_port.h")
#  include "esp_lvgl_port.h"
#  define BSP_HAVE_LVGL_PORT 1
#else
#  define BSP_HAVE_LVGL_PORT 0
#endif

#if __has_include("esp_lcd_touch_ft5x06.h")
#  include "esp_lcd_touch_ft5x06.h"
#  define BSP_HAVE_TOUCH 1
#else
#  define BSP_HAVE_TOUCH 0
#endif

#if __has_include("driver/sdmmc_host.h")
#  include "driver/sdmmc_host.h"
#  include "sdmmc_cmd.h"
#  include "esp_vfs_fat.h"
#  define BSP_HAVE_SDMMC 1
#else
#  define BSP_HAVE_SDMMC 0
#endif

static const char *TAG = "BSP";

/* ─── Shared handles ─────────────────────────────────────────────────────── */
static i2c_master_bus_handle_t  s_i2c_bus      = NULL;
static i2c_master_dev_handle_t  s_pca9557_dev  = NULL;
static esp_lcd_panel_io_handle_t s_lcd_io      = NULL;
static esp_lcd_panel_handle_t    s_lcd_panel   = NULL;

/* PCA9557 output register shadow (P0=LCD_CS, P1=PA_EN, P2=DVP_PWDN) */
static uint8_t s_pca_out = 0x05;  /* LCD_CS=1(desel), PA_EN=0, DVP_PWDN=1(off) */

/* ═══════════════════════════════════════════════════════════════════════════
 *  I2C
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_i2c_init(void)
{
    if (s_i2c_bus) return ESP_OK;  /* already initialised */

    i2c_master_bus_config_t bus_cfg = {
        .clk_source        = I2C_CLK_SRC_DEFAULT,
        .i2c_port          = BSP_I2C_NUM,
        .scl_io_num        = BSP_I2C_SCL,
        .sda_io_num        = BSP_I2C_SDA,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    return i2c_new_master_bus(&bus_cfg, &s_i2c_bus);
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PCA9557 IO Expander
 * ═══════════════════════════════════════════════════════════════════════════ */

static esp_err_t pca9557_write(uint8_t reg, uint8_t val)
{
    if (!s_pca9557_dev) return ESP_ERR_INVALID_STATE;
    uint8_t buf[2] = {reg, val};
    return i2c_master_transmit(s_pca9557_dev, buf, 2, pdMS_TO_TICKS(50));
}

esp_err_t pca9557_init(void)
{
    if (!s_i2c_bus) {
        ESP_LOGE(TAG, "bsp_i2c_init() must be called before pca9557_init()");
        return ESP_ERR_INVALID_STATE;
    }

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address  = PCA9557_ADDR,
        .scl_speed_hz    = BSP_I2C_FREQ_HZ,
    };
    esp_err_t ret = i2c_master_bus_add_device(s_i2c_bus, &dev_cfg, &s_pca9557_dev);
    if (ret != ESP_OK) return ret;

    /* OUTPUT register = 0x05: LCD_CS=1(desel), PA_EN=0, DVP_PWDN=1(camera off) */
    pca9557_write(0x01, s_pca_out);
    /* CONFIG register = 0xF8: P0-P2 as outputs, P3-P7 as inputs */
    return pca9557_write(0x03, 0xF8);
}

static void pca9557_set_bit(int bit, int level)
{
    if (level) s_pca_out |=  (1 << bit);
    else       s_pca_out &= ~(1 << bit);
    pca9557_write(0x01, s_pca_out);
}

void lcd_cs(int level)   { pca9557_set_bit(PCA9557_OUT_BIT_LCD_CS,   level); }
void pa_en(int level)    { pca9557_set_bit(PCA9557_OUT_BIT_PA_EN,    level); }
void dvp_pwdn(int level) { pca9557_set_bit(PCA9557_OUT_BIT_DVP_PWDN, level); }

/* ═══════════════════════════════════════════════════════════════════════════
 *  LCD (ST7789, SPI3_HOST, 80 MHz)
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_lcd_init(void)
{
    if (s_lcd_panel) return ESP_OK;

    /* SPI bus */
    spi_bus_config_t buscfg = {
        .mosi_io_num   = BSP_LCD_MOSI,
        .miso_io_num   = -1,
        .sclk_io_num   = BSP_LCD_CLK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = BSP_LCD_H_RES * BSP_LCD_V_RES * 2 + 8,
    };
    ESP_ERROR_CHECK(spi_bus_initialize(BSP_LCD_HOST, &buscfg, SPI_DMA_CH_AUTO));

    /* Panel IO over SPI */
    esp_lcd_panel_io_spi_config_t io_cfg = {
        .dc_gpio_num          = BSP_LCD_DC,
        .cs_gpio_num          = -1,          /* CS driven by PCA9557 */
        .pclk_hz              = 80 * 1000 * 1000,
        .lcd_cmd_bits         = 8,
        .lcd_param_bits       = 8,
        .spi_mode             = 0,
        .trans_queue_depth    = 10,
        .on_color_trans_done  = NULL,
        .user_ctx             = NULL,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi((esp_lcd_spi_bus_handle_t)BSP_LCD_HOST,
                                              &io_cfg, &s_lcd_io));

    /* ST7789 panel */
    esp_lcd_panel_dev_config_t panel_cfg = {
        .reset_gpio_num = -1,
        .rgb_endian     = LCD_RGB_ENDIAN_RGB,
        .bits_per_pixel = 16,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_st7789(s_lcd_io, &panel_cfg, &s_lcd_panel));

    /* Init sequence */
    lcd_cs(0);                              /* assert CS via PCA9557 */
    esp_lcd_panel_reset(s_lcd_panel);
    esp_lcd_panel_init(s_lcd_panel);
    esp_lcd_panel_invert_color(s_lcd_panel, true);
    esp_lcd_panel_swap_xy(s_lcd_panel, true);
    esp_lcd_panel_mirror(s_lcd_panel, true, false);
    esp_lcd_panel_set_gap(s_lcd_panel, 0, 0);
    esp_lcd_panel_disp_on_off(s_lcd_panel, true);

    /* Backlight on */
    bsp_display_brightness_set(80);

    ESP_LOGI(TAG, "LCD init OK (%dx%d)", BSP_LCD_H_RES, BSP_LCD_V_RES);
    return ESP_OK;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Backlight (LEDC)
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_display_brightness_set(int percent)
{
    if (percent < 0)   percent = 0;
    if (percent > 100) percent = 100;

    static bool ledc_inited = false;
    if (!ledc_inited) {
        ledc_timer_config_t timer = {
            .speed_mode      = LEDC_LOW_SPEED_MODE,
            .duty_resolution = LEDC_TIMER_8_BIT,
            .timer_num       = LEDC_TIMER_0,
            .freq_hz         = 5000,
            .clk_cfg         = LEDC_AUTO_CLK,
        };
        ledc_timer_config(&timer);

        ledc_channel_config_t channel = {
            .gpio_num   = BSP_LCD_BL,
            .speed_mode = LEDC_LOW_SPEED_MODE,
            .channel    = LEDC_CHANNEL_0,
            .timer_sel  = LEDC_TIMER_0,
            .duty       = 0,
            .hpoint     = 0,
        };
        ledc_channel_config(&channel);
        ledc_inited = true;
    }

    uint32_t duty = (percent * 255) / 100;
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, duty);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
    return ESP_OK;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  LVGL + Touch (requires esp_lvgl_port + esp_lcd_touch_ft5x06)
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_lvgl_start(void)
{
    /* LCD must be ready */
    if (!s_lcd_panel) {
        ESP_ERROR_CHECK(bsp_lcd_init());
    }

#if BSP_HAVE_LVGL_PORT
    const lvgl_port_cfg_t lvgl_cfg = {
        .task_priority    = 4,
        .task_stack       = 6144,
        .task_affinity    = -1,
        .task_max_sleep_ms = 500,
        .timer_period_ms  = 5,
    };
    ESP_ERROR_CHECK(lvgl_port_init(&lvgl_cfg));

    const lvgl_port_display_cfg_t disp_cfg = {
        .io_handle       = s_lcd_io,
        .panel_handle    = s_lcd_panel,
        .buffer_size     = BSP_LCD_H_RES * 50,
        .double_buffer   = true,
        .hres            = BSP_LCD_H_RES,
        .vres            = BSP_LCD_V_RES,
        .monochrome      = false,
        .rotation        = { .swap_xy = false, .mirror_x = false, .mirror_y = false },
        .flags           = { .buff_dma = true },
    };
    lv_disp_t *disp = lvgl_port_add_disp(&disp_cfg);
    if (!disp) {
        ESP_LOGE(TAG, "lvgl_port_add_disp failed");
        return ESP_FAIL;
    }

#if BSP_HAVE_TOUCH
    /* FT6336 touch (FT5x06 compatible, I2C addr 0x38) */
    esp_lcd_touch_config_t tp_cfg = {
        .x_max     = BSP_LCD_V_RES,   /* axes swapped — physical x maps to LVGL y */
        .y_max     = BSP_LCD_H_RES,
        .rst_gpio_num = -1,
        .int_gpio_num = -1,
        .levels    = { .reset = 0, .interrupt = 0 },
        .flags     = { .swap_xy = true, .mirror_x = false, .mirror_y = true },
    };
    esp_lcd_panel_io_handle_t tp_io = NULL;
    esp_lcd_panel_io_i2c_config_t tp_io_cfg = ESP_LCD_TOUCH_IO_I2C_FT5x06_CONFIG();
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_i2c(s_i2c_bus, &tp_io_cfg, &tp_io));

    esp_lcd_touch_handle_t tp = NULL;
    ESP_ERROR_CHECK(esp_lcd_touch_new_i2c_ft5x06(tp_io, &tp_cfg, &tp));

    const lvgl_port_touch_cfg_t touch_cfg = { .disp = disp, .handle = tp };
    lvgl_port_add_touch(&touch_cfg);
    ESP_LOGI(TAG, "Touch init OK");
#endif /* BSP_HAVE_TOUCH */

    ESP_LOGI(TAG, "LVGL started");
    return ESP_OK;

#else /* !BSP_HAVE_LVGL_PORT */
    ESP_LOGE(TAG, "bsp_lvgl_start() requires esp_lvgl_port — add it to idf_component.yml");
    return ESP_ERR_NOT_SUPPORTED;
#endif
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  lcd_draw_bitmap
 * ═══════════════════════════════════════════════════════════════════════════ */

void lcd_draw_bitmap(uint16_t x, uint16_t y, uint16_t xe, uint16_t ye, void *data)
{
    if (!s_lcd_panel) return;
    esp_lcd_panel_draw_bitmap(s_lcd_panel, x, y, xe, ye, data);
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SPIFFS
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_spiffs_mount(void)
{
    esp_vfs_spiffs_conf_t conf = {
        .base_path              = SPIFFS_BASE,
        .partition_label        = NULL,
        .max_files              = 8,
        .format_if_mount_failed = true,
    };
    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPIFFS mount failed: %s", esp_err_to_name(ret));
    }
    return ret;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SD Card (SDMMC 1-bit)
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_sdcard_mount(void)
{
#if BSP_HAVE_SDMMC
    sdmmc_host_t host = SDMMC_HOST_DEFAULT();
    host.max_freq_khz = SDMMC_FREQ_DEFAULT;

    sdmmc_slot_config_t slot = SDMMC_SLOT_CONFIG_DEFAULT();
    slot.width = 1;
    slot.clk   = BSP_SDMMC_CLK;
    slot.cmd   = BSP_SDMMC_CMD;
    slot.d0    = BSP_SDMMC_D0;
    slot.flags |= SDMMC_SLOT_FLAG_INTERNAL_PULLUP;

    esp_vfs_fat_sdmmc_mount_config_t mount_cfg = {
        .format_if_mount_failed  = false,
        .max_files               = 5,
        .allocation_unit_size    = 16 * 1024,
    };

    sdmmc_card_t *card;
    esp_err_t ret = esp_vfs_fat_sdmmc_mount(SD_MOUNT_POINT, &host, &slot, &mount_cfg, &card);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SD mount failed: %s", esp_err_to_name(ret));
    } else {
        ESP_LOGI(TAG, "SD mounted at %s  (%lluMB)", SD_MOUNT_POINT,
                 ((uint64_t)card->csd.capacity * card->csd.sector_size) >> 20);
    }
    return ret;
#else
    ESP_LOGE(TAG, "bsp_sdcard_mount() requires sdmmc/esp_vfs_fat headers");
    return ESP_ERR_NOT_SUPPORTED;
#endif
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Audio I2S + Codec stubs
 *  Full implementations require es8311 / es7210 managed components.
 *  Add them to your idf_component.yml and implement bsp_audio_init() yourself.
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_audio_init(void)
{
    ESP_LOGW(TAG, "bsp_audio_init(): add es8311/es7210 managed components for full implementation");
    return ESP_OK;
}

esp_err_t bsp_codec_init(void)
{
    ESP_LOGW(TAG, "bsp_codec_init(): implement with es8311/es7210 component APIs");
    return ESP_OK;
}

esp_err_t bsp_codec_set_fs(uint32_t rate, uint32_t bits, uint32_t ch)
{
    ESP_LOGI(TAG, "bsp_codec_set_fs: rate=%lu bits=%lu ch=%lu (stub)", rate, bits, ch);
    return ESP_OK;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Camera stub
 *  Full implementation requires esp_camera managed component.
 * ═══════════════════════════════════════════════════════════════════════════ */

esp_err_t bsp_camera_init(void)
{
    ESP_LOGW(TAG, "bsp_camera_init(): add esp_camera managed component for full implementation");
    return ESP_OK;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Audio Feed helpers (for speech-recognition pipelines)
 * ═══════════════════════════════════════════════════════════════════════════ */

int esp_get_feed_channel(void)
{
    return ADC_I2S_CHANNEL;
}

esp_err_t esp_get_feed_data(bool is_get_raw_data, int16_t *buffer, int buffer_len)
{
    if (!buffer || buffer_len <= 0) return ESP_ERR_INVALID_ARG;
    /* Caller is responsible for reading I2S data via i2s_channel_read().
     * This stub just zeroes the buffer so compilation succeeds. */
    for (int i = 0; i < buffer_len; i++) buffer[i] = 0;
    return ESP_OK;
}
