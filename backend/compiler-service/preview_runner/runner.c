#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#include "lvgl.h"
#include "app_ui.h"

#ifndef PREVIEW_WIDTH
#define PREVIEW_WIDTH 320
#endif

#ifndef PREVIEW_HEIGHT
#define PREVIEW_HEIGHT 240
#endif

static uint8_t framebuffer[PREVIEW_WIDTH * PREVIEW_HEIGHT * 4];
static lv_color_t draw_buf_1[PREVIEW_WIDTH * 40];
static lv_color_t draw_buf_2[PREVIEW_WIDTH * 40];
static lv_point_t pointer_point;
static bool pointer_pressed;

static void color_to_rgba(lv_color_t color, uint8_t *rgba)
{
#if LV_COLOR_DEPTH == 32
    uint32_t raw = color.full;
    rgba[0] = (raw >> 16) & 0xff;
    rgba[1] = (raw >> 8) & 0xff;
    rgba[2] = raw & 0xff;
    rgba[3] = 0xff;
#elif LV_COLOR_DEPTH == 16
    uint16_t raw = color.full;
    rgba[0] = ((raw >> 11) & 0x1f) * 255 / 31;
    rgba[1] = ((raw >> 5) & 0x3f) * 255 / 63;
    rgba[2] = (raw & 0x1f) * 255 / 31;
    rgba[3] = 0xff;
#else
    rgba[0] = 0x00;
    rgba[1] = 0x00;
    rgba[2] = 0x00;
    rgba[3] = 0xff;
#endif
}

static void preview_flush(lv_disp_drv_t *disp_drv, const lv_area_t *area, lv_color_t *color_p)
{
    (void)disp_drv;
    int32_t x1 = area->x1 < 0 ? 0 : area->x1;
    int32_t y1 = area->y1 < 0 ? 0 : area->y1;
    int32_t x2 = area->x2 >= PREVIEW_WIDTH ? PREVIEW_WIDTH - 1 : area->x2;
    int32_t y2 = area->y2 >= PREVIEW_HEIGHT ? PREVIEW_HEIGHT - 1 : area->y2;

    for (int32_t y = y1; y <= y2; y++) {
        for (int32_t x = x1; x <= x2; x++) {
            int32_t src_index = (y - area->y1) * lv_area_get_width(area) + (x - area->x1);
            color_to_rgba(color_p[src_index], &framebuffer[(y * PREVIEW_WIDTH + x) * 4]);
        }
    }
    lv_disp_flush_ready(disp_drv);
}

static void preview_pointer_read(lv_indev_drv_t *indev_drv, lv_indev_data_t *data)
{
    (void)indev_drv;
    data->point = pointer_point;
    data->state = pointer_pressed ? LV_INDEV_STATE_PR : LV_INDEV_STATE_REL;
}

static void run_ticks(uint32_t ms)
{
    for (uint32_t elapsed = 0; elapsed < ms; elapsed += 5) {
        lv_tick_inc(5);
        lv_timer_handler();
    }
}

static bool write_rgba(const char *path)
{
    FILE *file = fopen(path, "wb");
    if (!file) return false;
    size_t written = fwrite(framebuffer, 1, sizeof(framebuffer), file);
    fclose(file);
    return written == sizeof(framebuffer);
}

int main(int argc, char **argv)
{
    const char *output_path = argc > 1 ? argv[1] : "preview.rgba";
    int tap_x = argc > 2 ? atoi(argv[2]) : -1;
    int tap_y = argc > 3 ? atoi(argv[3]) : -1;

    memset(framebuffer, 0xff, sizeof(framebuffer));
    pointer_point.x = tap_x >= 0 ? tap_x : 0;
    pointer_point.y = tap_y >= 0 ? tap_y : 0;
    pointer_pressed = false;

    lv_init();

    lv_disp_draw_buf_t draw_buf;
    lv_disp_draw_buf_init(&draw_buf, draw_buf_1, draw_buf_2, PREVIEW_WIDTH * 40);

    lv_disp_drv_t disp_drv;
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = PREVIEW_WIDTH;
    disp_drv.ver_res = PREVIEW_HEIGHT;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.flush_cb = preview_flush;
    lv_disp_drv_register(&disp_drv);

    lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = preview_pointer_read;
    lv_indev_drv_register(&indev_drv);

    app_ui_create(lv_scr_act());
    run_ticks(80);

    if (tap_x >= 0 && tap_y >= 0) {
        pointer_point.x = tap_x;
        pointer_point.y = tap_y;
        pointer_pressed = true;
        run_ticks(60);
        pointer_pressed = false;
        run_ticks(180);
    }

    lv_refr_now(NULL);
    run_ticks(40);

    if (!write_rgba(output_path)) {
        fprintf(stderr, "failed to write %s\n", output_path);
        return 2;
    }
    return 0;
}
