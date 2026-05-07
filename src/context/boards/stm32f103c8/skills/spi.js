export const spiSkill = {
  id: 'spi',
  label: 'SPI 显示/外设',
  projectConfig: {
    srcs: [],
    stm32HalModules: ['stm32f1xx_hal_spi', 'stm32f1xx_hal_gpio', 'stm32f1xx_hal_rcc'],
    defines: ['STM32F103xB'],
    buildFlags: [],
  },
  systemPrompt: `## SPI (STM32Cube HAL)

### SPI1（PA5=SCK, PA6=MISO, PA7=MOSI）
\`\`\`c
#include "stm32f1xx_hal.h"

SPI_HandleTypeDef hspi1;

void MX_SPI1_Init(void) {
  hspi1.Instance = SPI1;
  hspi1.Init.Mode = SPI_MODE_MASTER;
  hspi1.Init.Direction = SPI_DIRECTION_2LINES;
  hspi1.Init.DataSize = SPI_DATASIZE_8BIT;
  hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;
  hspi1.Init.CLKPhase = SPI_PHASE_1EDGE;
  hspi1.Init.NSS = SPI_NSS_SOFT;         // Software CS
  hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;  // 72/16 = 4.5MHz
  hspi1.Init.FirstBit = SPI_FIRSTBIT_MSB;
  hspi1.Init.CRCPolynomial = 7;
  hspi1.Init.CRCLength = SPI_CRC_LENGTH_DATASIZE;
  hspi1.Init.NSSPMode = SPI_NSS_PULSE_DISABLE;
  HAL_SPI_Init(&hspi1);
}

// MSP init
void HAL_SPI_MspInit(SPI_HandleTypeDef *hspi) {
  if (hspi->Instance == SPI1) {
    __HAL_RCC_SPI1_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = GPIO_PIN_5 | GPIO_PIN_6 | GPIO_PIN_7;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
  }
}

// 发送接收
uint8_t tx_data = 0xAA, rx_data;
HAL_SPI_TransmitReceive(&hspi1, &tx_data, &rx_data, 1, HAL_MAX_DELAY);

// CS 控制（用任意 GPIO）
HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, GPIO_PIN_RESET);  // CS LOW
HAL_SPI_Transmit(&hspi1, buffer, len, HAL_MAX_DELAY);
HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, GPIO_PIN_SET);    // CS HIGH
\`\`\`

### Pitfalls
- SPI1 在 APB2（72MHz），速度比 SPI2（APB1 36MHz）快一倍
- NSS = SPI_NSS_SOFT！硬件 NSS 在 F103 上有很多坑
- CS 用普通 GPIO 控制，不要用硬件 NSS
- SPI 模式（极性/相位）必须和从设备匹配
- PA4 可作为 CS 引脚（也 ADC12_IN4/SPI1_NSS）`,
}
