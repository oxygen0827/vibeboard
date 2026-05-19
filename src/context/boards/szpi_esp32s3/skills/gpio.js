
export const gpioSkill = {
  id: 'gpio',
  label: 'GPIO / 按键',
  projectConfig: {
    srcs: [],
    sdkconfig: [],
    idfComponents: [],
    partitions: null,
    spiffs: false,
  },
  systemPrompt: `## GPIO & 按键中断

### BOOT 按键 (GPIO0)
板载唯一按键，active LOW，内置上拉。

### 中断 + FreeRTOS Queue 模式（官方例程）
\`\`\`c
#include "freertos/queue.h"
#include "driver/gpio.h"

static QueueHandle_t gpio_evt_queue = NULL;

static void IRAM_ATTR gpio_isr_handler(void *arg) {
    uint32_t gpio_num = (uint32_t)arg;
    xQueueSendFromISR(gpio_evt_queue, &gpio_num, NULL);
}

static void gpio_task(void *arg) {
    uint32_t io_num;
    for (;;) {
        if (xQueueReceive(gpio_evt_queue, &io_num, portMAX_DELAY))
            printf("GPIO[%d] val=%d\\n", io_num, gpio_get_level(io_num));
    }
}

void app_main(void) {
    gpio_config_t cfg = {
        .intr_type    = GPIO_INTR_NEGEDGE,
        .mode         = GPIO_MODE_INPUT,
        .pin_bit_mask = 1ULL << GPIO_NUM_0,
        .pull_up_en   = 1,
    };
    gpio_config(&cfg);
    gpio_evt_queue = xQueueCreate(10, sizeof(uint32_t));
    xTaskCreate(gpio_task, "gpio_task", 2048, NULL, 10, NULL);
    gpio_install_isr_service(0);
    gpio_isr_handler_add(GPIO_NUM_0, gpio_isr_handler, (void *)GPIO_NUM_0);
}
\`\`\`

### Pitfalls
- BOOT 按键 GPIO0 active LOW，必须配置上拉
- ISR 函数必须加 IRAM_ATTR，否则 flash cache miss 导致崩溃
- gpio_install_isr_service() 全局只调用一次`,
}
