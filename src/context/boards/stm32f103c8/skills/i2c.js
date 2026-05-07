export const i2cSkill = {
  id: 'i2c',
  label: 'I2C 传感器',
  projectConfig: {
    srcs: [],
    stm32HalModules: ['stm32f1xx_hal_i2c', 'stm32f1xx_hal_gpio', 'stm32f1xx_hal_rcc'],
    defines: ['STM32F103xB'],
    buildFlags: [],
  },
  systemPrompt: `## I2C (STM32Cube HAL)

### I2C1（PB6=SCL, PB7=SDA）— 默认 I2C 总线
\`\`\`c
#include "stm32f1xx_hal.h"

I2C_HandleTypeDef hi2c1;

void MX_I2C1_Init(void) {
  hi2c1.Instance = I2C1;
  hi2c1.Init.ClockSpeed = 100000;         // 100kHz standard mode
  hi2c1.Init.DutyCycle = I2C_DUTYCYCLE_2;
  hi2c1.Init.OwnAddress1 = 0;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  HAL_I2C_Init(&hi2c1);
}

// MSP init
void HAL_I2C_MspInit(I2C_HandleTypeDef *hi2c) {
  if (hi2c->Instance == I2C1) {
    __HAL_RCC_I2C1_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = GPIO_PIN_6 | GPIO_PIN_7;  // SCL=SDA
    GPIO_InitStruct.Mode = GPIO_MODE_AF_OD;          // Open-drain!
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOB, &GPIO_InitStruct);
  }
}

// 扫描设备
for (uint16_t addr = 1; addr < 127; addr++) {
  if (HAL_I2C_IsDeviceReady(&hi2c1, addr << 1, 1, 10) == HAL_OK) {
    printf("Found I2C: 0x%02X\\r\\n", addr);
  }
}

// 写寄存器
uint8_t data[] = {0x00, 0xFF};
HAL_I2C_Master_Transmit(&hi2c1, (0x76 << 1), data, 2, 100);

// 读寄存器
uint8_t reg = 0xD0, val;
HAL_I2C_Master_Transmit(&hi2c1, (0x76 << 1), &reg, 1, 100);
HAL_I2C_Master_Receive(&hi2c1, (0x76 << 1), &val, 1, 100);
\`\`\`

### Pitfalls
- I2C 引脚必须是 GPIO_MODE_AF_OD（开漏），不是推挽输出
- STM32 I2C 地址是 7-bit 左移一位（即 addr<<1）
- I2C1 在 APB1（36MHz），不要用 400kHz 以上
- PB6/PB7 需要外部上拉电阻（4.7kΩ 典型值）`,
}
