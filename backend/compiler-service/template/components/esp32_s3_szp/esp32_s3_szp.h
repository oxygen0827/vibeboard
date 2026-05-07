#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "driver/gpio.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ─── Pin Map ─────────────────────────────────────────────────────────────── */

/* I2C — shared bus */
#define BSP_I2C_SDA         GPIO_NUM_1
#define BSP_I2C_SCL         GPIO_NUM_2
#define BSP_I2C_NUM         I2C_NUM_0
#define BSP_I2C_FREQ_HZ     100000

/* SPI LCD — ST7789, 320×240 */
#define BSP_LCD_MOSI        GPIO_NUM_40
#define BSP_LCD_CLK         GPIO_NUM_41
#define BSP_LCD_DC          GPIO_NUM_39
#define BSP_LCD_BL          GPIO_NUM_42
#define BSP_LCD_HOST        SPI3_HOST
#define BSP_LCD_H_RES       320
#define BSP_LCD_V_RES       240

/* I2S Audio */
#define BSP_I2S_NUM         I2S_NUM_1
#define BSP_I2S_MCLK        GPIO_NUM_38
#define BSP_I2S_BCLK        GPIO_NUM_14
#define BSP_I2S_WS          GPIO_NUM_13
#define BSP_I2S_DOUT        GPIO_NUM_45   /* to ES8311 DAC */
#define BSP_I2S_DIN         GPIO_NUM_12   /* from ES7210 ADC */

/* SDMMC */
#define BSP_SDMMC_CLK       GPIO_NUM_47
#define BSP_SDMMC_CMD       GPIO_NUM_48
#define BSP_SDMMC_D0        GPIO_NUM_21
#define SD_MOUNT_POINT      "/sdcard"
#define SPIFFS_BASE         "/spiffs"

/* Camera DVP */
#define BSP_CAM_XCLK        GPIO_NUM_5
#define BSP_CAM_VSYNC       GPIO_NUM_3
#define BSP_CAM_HREF        GPIO_NUM_46
#define BSP_CAM_PCLK        GPIO_NUM_7
#define BSP_CAM_D0          GPIO_NUM_16
#define BSP_CAM_D1          GPIO_NUM_18
#define BSP_CAM_D2          GPIO_NUM_8
#define BSP_CAM_D3          GPIO_NUM_17
#define BSP_CAM_D4          GPIO_NUM_15
#define BSP_CAM_D5          GPIO_NUM_6
#define BSP_CAM_D6          GPIO_NUM_4
#define BSP_CAM_D7          GPIO_NUM_9

/* Boot button */
#define BSP_BOOT_BTN        GPIO_NUM_0

/* ─── PCA9557 IO Expander (I2C 0x19) ─────────────────────────────────────── */
#define PCA9557_ADDR                0x19
#define PCA9557_OUT_BIT_LCD_CS      0   /* BIT0 — LCD chip-select,  active-LOW  */
#define PCA9557_OUT_BIT_PA_EN       1   /* BIT1 — PA power,         active-HIGH */
#define PCA9557_OUT_BIT_DVP_PWDN    2   /* BIT2 — Camera power-down,active-HIGH = OFF */

/* ─── Audio Codec Addresses ──────────────────────────────────────────────── */
#define ES8311_ADDR                 0x18
#define ES7210_ADDR                 0x41   /* AD0 wired HIGH → NOT default 0x40 */

/* ─── Audio Defaults ─────────────────────────────────────────────────────── */
#define CODEC_DEFAULT_SAMPLE_RATE   16000
#define CODEC_DEFAULT_BIT_WIDTH     32
#define CODEC_DEFAULT_CHANNEL       2
#define ADC_I2S_CHANNEL             4

/* ─── Function Declarations ──────────────────────────────────────────────── */

/** Init I2C bus (SDA=GPIO1, SCL=GPIO2, I2C_NUM_0, 100 kHz). Call once at boot. */
esp_err_t bsp_i2c_init(void);

/**
 * Init PCA9557 IO expander — MUST be called before bsp_lcd_init, bsp_audio_init,
 * or bsp_camera_init.  Sets OUTPUT register to 0x05 and CONFIG register to 0xF8.
 */
esp_err_t pca9557_init(void);

/** Drive LCD chip-select (BIT0 of PCA9557 OUTPUT). level=0 → select, 1 → deselect. */
void lcd_cs(int level);

/** Drive audio power-amp enable (BIT1 of PCA9557 OUTPUT). level=1 → speakers ON. */
void pa_en(int level);

/** Drive camera power-down (BIT2 of PCA9557 OUTPUT). level=0 → camera ON. */
void dvp_pwdn(int level);

/** Init SPI + ST7789 LCD panel (does NOT start LVGL). Returns lcd_panel handle. */
esp_err_t bsp_lcd_init(void);

/**
 * Full display stack: LCD + FT6336 touch + LVGL + backlight.
 * Requires esp_lvgl_port and esp_lcd_touch_ft5x06 managed components.
 */
esp_err_t bsp_lvgl_start(void);

/** Set backlight brightness (0–100 %). */
esp_err_t bsp_display_brightness_set(int percent);

/** Init camera (DVP, 24 MHz XCLK). Requires esp_camera managed component. */
esp_err_t bsp_camera_init(void);

/** Init I2S bus for audio (I2S_NUM_1). */
esp_err_t bsp_audio_init(void);

/** Init ES8311 DAC + ES7210 ADC over I2C at default sample rate/bit-width. */
esp_err_t bsp_codec_init(void);

/** Change codec sample rate / bit-width / channel count at runtime. */
esp_err_t bsp_codec_set_fs(uint32_t rate, uint32_t bits, uint32_t ch);

/** Mount SPIFFS partition at /spiffs. */
esp_err_t bsp_spiffs_mount(void);

/** Mount SD card via SDMMC at /sdcard (1-bit mode). */
esp_err_t bsp_sdcard_mount(void);

/**
 * Draw a 16-bit RGB565 bitmap to the LCD.
 * (x,y) = top-left corner; (xe,ye) = bottom-right corner (exclusive).
 */
void lcd_draw_bitmap(uint16_t x, uint16_t y, uint16_t xe, uint16_t ye, void *data);

/** Returns the number of I2S input channels used for audio feed (= ADC_I2S_CHANNEL). */
int  esp_get_feed_channel(void);

/**
 * Fetch one frame of audio input.
 * @param is_get_raw_data  true → raw I2S samples; false → processed
 * @param buffer           destination int16_t buffer
 * @param buffer_len       buffer length in samples
 */
esp_err_t esp_get_feed_data(bool is_get_raw_data, int16_t *buffer, int buffer_len);

#ifdef __cplusplus
}
#endif
