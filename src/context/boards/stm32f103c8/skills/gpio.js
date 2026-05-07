export const gpioSkill = {
  id: 'gpio',
  label: 'GPIO / LED',
  projectConfig: {
    srcs: [],
    stm32HalModules: [],
    defines: ['STM32F103xB'],
    buildFlags: [],
  },
  systemPrompt: `## GPIO (STM32Cube HAL)

### 板载 LED（PC13，低电平亮）
\`\`\`c
#include "gpio.h"

HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, GPIO_PIN_RESET);  // LED ON (active LOW)
HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, GPIO_PIN_SET);     // LED OFF
HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13);                  // Toggle
\`\`\`

### 普通 GPIO 输出
\`\`\`c
GPIO_InitTypeDef GPIO_InitStruct = {0};
__HAL_RCC_GPIOA_CLK_ENABLE();
GPIO_InitStruct.Pin = GPIO_PIN_5;
GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
GPIO_InitStruct.Pull = GPIO_NOPULL;
GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
\`\`\`

### GPIO 输入（带上拉）
\`\`\`c
GPIO_InitStruct.Pin = GPIO_PIN_0;
GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
GPIO_InitStruct.Pull = GPIO_PULLUP;
HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

// 读取
GPIO_PinState state = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0);
\`\`\`

### Pitfalls
- PC13 LED active LOW: RESET = ON, SET = OFF
- 必须先 __HAL_RCC_GPIOx_CLK_ENABLE() 才能用该端口的 GPIO
- GPIO speed 设置对 EMI 有影响，高速应用才用 SPEED_FREQ_HIGH`,
}
