export const uartSkill = {
  id: 'uart',
  label: 'UART 串口',
  projectConfig: {
    srcs: [],
    stm32HalModules: ['stm32f1xx_hal_uart', 'stm32f1xx_hal_gpio', 'stm32f1xx_hal_rcc'],
    defines: ['STM32F103xB'],
    buildFlags: [],
  },
  systemPrompt: `## UART 串口 (STM32Cube HAL)

### USART1（PA9=TX, PA10=RX）— 最常用
\`\`\`c
#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart1;

void MX_USART1_UART_Init(void) {
  huart1.Instance = USART1;
  huart1.Init.BaudRate = 115200;
  huart1.Init.WordLength = UART_WORDLENGTH_8B;
  huart1.Init.StopBits = UART_STOPBITS_1;
  huart1.Init.Parity = UART_PARITY_NONE;
  huart1.Init.Mode = UART_MODE_TX_RX;
  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
  HAL_UART_Init(&huart1);
}

// HAL_UART_MspInit callback (pin config)
void HAL_UART_MspInit(UART_HandleTypeDef *huart) {
  if (huart->Instance == USART1) {
    __HAL_RCC_USART1_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = GPIO_PIN_9;  // TX
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
    GPIO_InitStruct.Pin = GPIO_PIN_10; // RX
    GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
    GPIO_InitStruct.Pull = GPIO_PULLUP;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
  }
}

// 发送字符串
HAL_UART_Transmit(&huart1, (uint8_t*)"Hello\\r\\n", 8, HAL_MAX_DELAY);
// 接收字节
uint8_t rx;
HAL_UART_Receive(&huart1, &rx, 1, HAL_MAX_DELAY);
// printf 重定向
int _write(int file, char *ptr, int len) {
  HAL_UART_Transmit(&huart1, (uint8_t*)ptr, len, HAL_MAX_DELAY);
  return len;
}
\`\`\`

### Pitfalls
- USART1 的 TX/RX 是 PA9/PA10，不是 PA2/PA3（那是 USART2）
- HAL_UART_MspInit() 由 HAL_UART_Init() 自动调用 — 不要手动调
- USART1 在 APB2 总线（72MHz），USART2/3 在 APB1（36MHz）
- 波特率误差超过 ~2% 会导致乱码 — 用标准波特率（9600/19200/38400/115200）`,
}
