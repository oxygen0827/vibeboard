# ESP32 Vibe Coder

> 面向 **立创实战派ESP32-S3** 的 AI 辅助嵌入式开发 Web IDE

在浏览器里用自然语言描述需求，AI 自动生成带完整硬件上下文的 ESP-IDF v5.4 C 代码；编译、烧录、日志分析全部在浏览器内完成，**无需安装任何工具链**。

---

## 功能特性

### AI 辅助编码
- **硬件上下文包** — AI 系统提示自动注入开发板全部引脚、外设地址、BSP 函数签名，生成的代码开箱即用
- **流式 AI 对话** — 支持 OpenAI 兼容接口 + Anthropic 原生 API，内置 6 个主流提供商预设
- **Monaco 代码编辑器** — C 语言语法高亮、JetBrains Mono 字体、VS Dark 主题
- **一键插入** — AI 回复中每个代码块都有「插入编辑器」按钮

### 云端编译
- **云编译器** — ESP-IDF v5.4 Docker 容器暴露 REST API，浏览器发送代码，返回 `.bin` 固件
- **一键下载 .bin** — 编译成功后可直接下载固件文件

### 无线烧录（OTA）
- **WiFi OTA** — 设备运行 OTA 固件后，通过 HTTP 推送新固件，进度条实时显示，自动重启
- **BLE OTA** — 无需 WiFi，通过 **Web Bluetooth API** 直接蓝牙烧录，512 字节 MTU 高速传输

### 设备日志
- **WiFi WebSocket 日志流** — 实时接收 ESP32 日志，按级别过滤（E/W/I/D/V），关键字搜索
- **WebSerial 串口日志** — USB 直连串口，115200 baud，无需驱动
- **AI 日志分析** — 一键将日志发送给 AI，自动定位错误原因并给出修复建议

---

## 完整工作流

```
描述需求 → AI 生成代码 → 云端编译 → WiFi OTA / BLE 烧录 → 实时查看日志 → AI 分析报错
```

**第一次** 需要 USB 烧录 `ota-firmware/`（OTA 引导固件），之后所有更新均可无线完成。

---

## 支持的 AI 提供商

| 提供商 | Base URL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Anthropic | `https://api.anthropic.com` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 阿里云百炼 (Qwen) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Ollama (本地) | `http://localhost:11434/v1` |

任何 OpenAI 兼容接口均可使用。

---

## 快速开始

### Web IDE（前端）

```bash
git clone https://github.com/wangqioo/esp32-vibe-coder.git
cd esp32-vibe-coder
npm install --include=dev
npm run dev
# 打开 http://localhost:5173
```

### 云编译器（后端）

```bash
cd compiler-service
docker build -t esp32-compiler .
docker run -d -p 8760:8760 esp32-compiler
# 开发环境会通过 Vite 代理 /compile 到 http://127.0.0.1:8760
# 生产环境由 nginx 将 /compile 代理到 http://127.0.0.1:8760
```

### OTA 引导固件（首次烧录）

```bash
cd ota-firmware
# 修改 sdkconfig 中的 WiFi SSID / Password
idf.py menuconfig   # Component config → OTA WiFi
idf.py build flash monitor
```

---

## 使用说明

1. 点击右上角 **⚙ 配置 AI**，填入 API Base URL、API Key 和模型名称
   > API Key 仅保存在当前浏览器本地；请勿在共享或不可信设备上保存真实密钥。
2. 在右侧聊天框用中文描述需求：
   - `帮我写一个点亮屏幕显示 Hello World 的完整例程`
   - `帮我写一个读取 QMI8658 加速度计数据的代码`
   - `帮我实现 WiFi 扫描并连接功能`
3. AI 回复中点击 **插入编辑器** 将代码同步到左侧编辑器
4. 点击 **▶ 编译** → 填入云编译器地址 → 等待编译完成
5. 编译成功后选择烧录方式：
   - **WiFi OTA** — 填入设备 IP，点击「↑ 推送 OTA」
   - **BLE 烧录** — 点击「⬡ BLE 烧录」，在 Chrome 弹窗选择设备
6. 切换到 **📟 设备日志** 标签查看运行日志，可点击「✨ AI 分析」定位问题

---

## BLE OTA 协议

| 方向 | 特征值 | 内容 |
|---|---|---|
| 浏览器 → 设备 | CTRL (write) | `[0x01, size(4B)]` 开始 / `[0x02]` 提交 / `[0x03]` 放弃 |
| 浏览器 → 设备 | DATA (write-no-rsp) | 固件块，最大 509 字节 (MTU-3) |
| 设备 → 浏览器 | STATUS (notify) | `[0x00]` 就绪 / `[0x01, offset(4B)]` 进度 / `[0x02]` 成功 / `[0x03, msg]` 错误 |

> BLE OTA 需要 **Chrome / Edge 桌面版**，设备广播名称为 `ESP32-Vibe-OTA`。

---

## 多板支持架构

该项目支持多块开发板。每块板子是一个独立的"硬件语境包"，包含完整的引脚定义、外设陷阱知识、BSP 文档，以及该板专属的 AI Skill 文件。

```
src/context/boards/
├── index.js               # 注册表 — 登记所有支持的板子
└── szpi_esp32s3/           # 立创实战派 ESP32-S3
    ├── definition.js       # 板级定义 + 硬件上下文 (喂给 AI 的 basePrompt)
    └── skills/             # 该板专属的外设 Skill 文件
        ├── index.js        # 聚合导出
        ├── lvgl.js         # LVGL 显示 (ST7789 320x240)
        ├── audio.js        # 音频 (ES8311+ES7210)
        ├── camera.js       # 摄像头 (GC0308)
        ├── imu.js          # IMU (QMI8658)
        ├── wifi.js         # WiFi
        ├── ble.js          # BLE
        ├── sdcard.js       # SD卡/SPIFFS
        ├── gpio.js         # GPIO/按键
        ├── speech.js       # 语音识别
        ├── vision.js       # 人脸/目标检测
        └── handheld.js     # 综合手持设备
```

### 新增一块板子（示例：ESP32-C3-DevKit）

如果你想增加一块新的开发板，只需 4 步：

**第 1 步：创建板子目录**

```
mkdir -p src/context/boards/esp32c3_devkit/skills
```

**第 2 步：编写 `definition.js`**

这是最重要的文件 —— 它定义了这块板子的"硬件 DNA"，AI 会以此为依据生成代码：

```js
// src/context/boards/esp32c3_devkit/definition.js

const basePrompt = `You are an expert embedded engineer for the ESP32-C3-DevKit-M-1.
Use ESP-IDF v5.4.

## Board: ESP32-C3-DevKit-M-1
Module: ESP32-C3-WROOM-02 (4MB Flash, No PSRAM, single-core RISC-V @ 160MHz)

## Pin Assignments
\`\`\`
Onboard LED: GPIO8 (active HIGH)
BOOT btn:   GPIO9 (active LOW)
UART:       TX=GPIO21, RX=GPIO20
\`\`\`

## Critical Pitfalls
1. ESP32-C3 is RISC-V — NOT Xtensa; toolchain is different
2. No PSRAM — MALLOC_CAP_SPIRAM will fail
3. GPIO12-15 used for JTAG — avoid when debugging
4. Only 4MB Flash — partitions must be tight
...`

export const esp32c3_devkitBoard = {
  id: 'esp32c3_devkit',
  name: 'ESP32-C3-DevKit-M-1',
  chip: 'ESP32-C3',
  idfTarget: 'esp32c3',
  idfVersion: '5.4',
  flashSize: '4MB',
  description: 'RISC-V single-core, 4MB Flash, onboard LED GPIO8',
  basePrompt,
  skills: [],  // 第 3 步填充
}
```

> **关键原则**：`basePrompt` 里放的是 AI **不可能从公开语料学到**的东西。你的板子有什么特殊的 I2C 地址？哪个引脚是 PSRAM 保留的？哪个外设必须按特定顺序初始化？这些踩坑经验才是最有价值的。

**第 3 步：编写该板子可用的 Skill**

Skill 是 AI 能理解的外设模块。不是所有外设都适用于每块板子：

- 立创实战派有 11 个 Skill（因为板载外设多）
- 一块简单的 ESP32-C3 开发板可能只有 3 个：WiFi、BLE、GPIO

每个 Skill 的结构如下（以 WiFi 为例）：

```js
// src/context/boards/esp32c3_devkit/skills/wifi.js
export const wifiSkill = {
  id: 'wifi',
  label: 'WiFi',
  projectConfig: {
    srcs: [],
    sdkconfig: [
      'CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ_160=y',
    ],
    idfComponents: [],
    partitions: null,
    spiffs: false,
  },
  systemPrompt: `## WiFi (ESP32-C3)
\`\`\`c
// C3 has only one core — no need for task pinning
esp_netif_init();
esp_event_loop_create_default();
...
\`\`\`

### Pitfalls
- NVS must be init before WiFi
- No PSRAM — small heap, avoid large buffers`,
}
```

然后在 `skills/index.js` 中聚合导出：

```js
import { wifiSkill } from './wifi'
import { bleSkill } from './ble'
import { gpioSkill } from './gpio'
export const esp32c3_devkitSkills = [wifiSkill, bleSkill, gpioSkill]
```

回到 `definition.js`，补上 skills 引用：

```js
import { esp32c3_devkitSkills } from './skills/index'
// ...
export const esp32c3_devkitBoard = {
  // ...
  skills: esp32c3_devkitSkills,
}
```

**第 4 步：注册到注册表**

编辑 `src/context/boards/index.js`，在 BOARD_MAP 中添加一行：

```js
import { esp32c3_devkitBoard } from './esp32c3_devkit/definition'

const BOARD_MAP = {
  szpi_esp32s3: szpi_esp32s3Board,
  esp32c3_devkit: esp32c3_devkitBoard,  // ← 新增
}
```

**完成。** 刷新页面，顶部的板子选择下拉框会自动出现新选项。选中后，整个系统 —— AI 系统提示、编译配置、外设 Skill 列表 —— 全部自动切换。

### 核心思路

| 有了这个架构 | 以前是这样 |
|---|---|
| 每块板子独立目录，互不干扰 | 所有硬件信息写死在 `base.js` 里 |
| 加新板只需要 new directory + 4 行配置 | 加新板要改 N 个文件还怕弄坏旧的 |
| Skill 按板定制，同一名字不同内容 | Skill 全局共享，换板子就失效 |
| 硬件上下文就是你的知识资产，可复用可积累 | 经验只存在于聊天记录或脑子里 |

**你支持的板子越多，这个系统的护城河就越深。** 因为每块板子的硬件上下文 —— 那些从实际调试中踩过的坑、正确的初始化顺序、特殊的 I2C 地址 —— 是 LLM 永远无法从公开语料中学到的。

---

### 跨平台 / 跨框架扩展

当板子使用的芯片架构和开发框架完全不同时，系统通过 `framework` 字段做**重度隔离**。

当前支持两种框架：

| framework | 芯片架构 | 构建系统 | 适用板子 |
|---|---|---|---|
| `esp-idf` | ESP32 (Xtensa/RISC-V) | idf.py + CMake | 立创实战派 ESP32-S3 |
| `arduino` | ARM Cortex-M / AVR / RP2040 | Arduino CLI | Seeed XIAO nRF52840 |
| `stm32cube` | ARM Cortex-M | arm-none-eabi-gcc + Makefile | STM32F103C8 Blue Pill |

每块板子的 `definition.js` 中声明所属框架：

```js
// ESP32-S3 board (IDF)
{
  framework: 'esp-idf',
  ...
}

// nRF52840 board (Arduino)
{
  framework: 'arduino',
  arduinoBoardId: 'Seeeduino:nrf52:XIAO_nRF52840',
  ...
}

// STM32 board (Cube HAL)
{
  framework: 'stm32cube',
  mcuType: 'STM32F103C8',
  linkerscript: 'STM32F103C8Tx_FLASH.ld',
  ...
}
```

#### `buildProjectFiles()` 自动分流

系统根据 `board.framework` 自动选择不同的项目文件生成逻辑：

- **ESP-IDF 框架**：生成 `CMakeLists.txt`、`sdkconfig.defaults`、`main/idf_component.yml`
- **Arduino 框架**：生成 `sketch.ino`，附带元数据（`__libraries[]`、`__boardFqbn`）

#### Arduino 版 Skill 示例

Arduino skill 使用 `arduinoLibraries[]` 替代 `idfComponents[]`：

```js
// Seeed XIAO nRF52840 的 NeoPixel Skill
export const neopixelSkill = {
  id: 'neopixel',
  label: 'RGB LED (NeoPixel)',
  projectConfig: {
    srcs: [],
    arduinoLibraries: ['Adafruit NeoPixel'],  // Arduino 库
    buildFlags: [],
  },
  systemPrompt: `## 板载 WS2812 RGB LED
...
### Pitfalls
- DO NOT use pinMode(D14, OUTPUT) — NeoPixel data line is NOT a regular GPIO`,
}
```

系统根据 `board.framework` 自动选择不同的项目文件生成逻辑：

- **ESP-IDF 框架**：生成 `CMakeLists.txt`、`sdkconfig.defaults`、`main/idf_component.yml`
- **Arduino 框架**：生成 `sketch.ino`，附带元数据（`__libraries[]`、`__boardFqbn`）
- **STM32Cube 框架**：生成 `Makefile`、`Src/main.c`、`Inc/` 头文件、`startup_stm32f103xb.s`、链接脚本

#### STM32Cube 版 Skill 示例

STM32Cube skill 使用 `stm32HalModules[]` 声明 HAL 驱动依赖：

```js
// STM32F103C8 Blue Pill 的 UART Skill
export const uartSkill = {
  id: 'uart',
  label: 'UART 串口',
  projectConfig: {
    srcs: [],
    stm32HalModules: [
      'stm32f1xx_hal_uart',
      'stm32f1xx_hal_gpio',
      'stm32f1xx_hal_rcc',
    ],
    defines: ['STM32F103xB'],
    buildFlags: [],
  },
  systemPrompt: `## UART 串口 (STM32Cube HAL)
### USART1（PA9=TX, PA10=RX）
\`\`\`c
UART_HandleTypeDef huart1;
void MX_USART1_UART_Init(void) {
  huart1.Instance = USART1;
  huart1.Init.BaudRate = 115200;
  ...
  HAL_UART_Init(&huart1);
}
\`\`\`
### Pitfalls
- USART1 的 TX/RX 是 PA9/PA10，不是 PA2/PA3
- APB2 总线 72MHz vs APB1 36MHz — 影响波特率精度`,
}
```

#### 编译服务需要新增对应容器

当选择不同框架的板子时，前端的 metadata 会告诉编译器使用哪个容器：

ESP-IDF：
```json
{"__framework": "esp-idf", "__idfTarget": "esp32s3"}
```

Arduino：
```json
{"__framework": "arduino", "__boardFqbn": "Seeeduino:nrf52:XIAO_nRF52840", "__libraries": "..."}
```

STM32Cube：
```json
{"__framework": "stm32cube", "__mcuType": "STM32F103C8", "__halModules": "..."}
```

编译器层解包后，用对应工具链编译：

```bash
# ESP-IDF
idf.py build

# Arduino
arduino-cli compile --fqbn Seeeduino:nrf52:XIAO_nRF52840 sketch.ino

# STM32Cube
arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -DSTM32F103xB ... Src/main.c
arm-none-eabi-ld -T STM32F103C8Tx_FLASH.ld ... -o firmware.elf
arm-none-eabi-objcopy -O ihex firmware.elf firmware.hex
```

后端 Docker 部署时，需要为 Arduino 框架单独建一个容器（`esp32-compiler-arduino`），
不同框架的编译请求路由到对应的容器。详情见 `compiler-service/` 目录。

---

### 当前支持的板子

| 板子 | 芯片 | 框架 | 目前状态 |
|---|---|---|---|
| 立创实战派 ESP32-S3 | ESP32-S3 | ESP-IDF v5.4 | ✅ 已完成，11 个 Skill |
| Seeed XIAO nRF52840 | nRF52840 (ARM M4F) | Arduino | ✅ 已完成，5 个 Skill |
| STM32F103C8T6 Blue Pill | STM32F103C8 (ARM M3) | STM32Cube HAL | ✅ 已完成，4 个 Skill |
| 更多... | | | 欢迎贡献 |

---

## 目标硬件

| 项目 | 参数 |
|---|---|
| 模组 | ESP32-S3-WROOM-1-N16R8 |
| Flash | 16MB |
| PSRAM | 8MB Octal |
| 主频 | 240MHz 双核 LX7 |
| 框架 | ESP-IDF v5.4 |
| BSP | `esp32_s3_szp.h` |

AI 预置的硬件陷阱提示（防止生成错误代码）：
- ES7210 I2C 地址 `0x41`，非默认 `0x40`
- QMI8658 I2C 地址 `0x6A`，非 `0x6B`
- 所有 LVGL 调用需加 `lvgl_port_lock` / `lvgl_port_unlock`
- LCD CS 由 PCA9557 IO 扩展芯片控制，非直接 GPIO

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + Vite 5 |
| 代码编辑器 | Monaco Editor (`@monaco-editor/react`) |
| Markdown 渲染 | react-markdown + react-syntax-highlighter |
| AI 接口 | Fetch SSE（OpenAI 兼容）+ Anthropic 原生 |
| 串口日志 | Web Serial API |
| BLE 烧录 | Web Bluetooth API |
| 云编译器 | Flask + gunicorn on `espressif/idf:v5.4` |
| ESP32 BLE 栈 | NimBLE (ESP-IDF 内置) |
| 部署 | nginx:alpine (Docker 多阶段构建) |

---

## 项目结构

```
esp32-vibe-coder/
├── src/                     # React 前端
│   ├── App.jsx              # 根布局：编辑器 55% + 右侧面板 45%
│   ├── components/
│   │   ├── ChatPanel.jsx    # AI 对话面板
│   │   ├── LogPanel.jsx     # 设备日志（WiFi WS + WebSerial）
│   │   ├── CompilePanel.jsx # 编译 + WiFi OTA + BLE OTA
│   │   └── SettingsModal.jsx
│   ├── utils/
│   │   ├── aiApi.js         # 流式 AI 接口
│   │   ├── compiler.js      # 云编译器 REST 调用
│   │   ├── ota.js           # WiFi OTA HTTP 推送
│   │   ├── bleOta.js        # BLE OTA Web Bluetooth 客户端
│   │   └── logStream.js     # WebSocket + WebSerial 日志流
│   └── context/boards.js    # 开发板注册表 + AI 系统提示
├── compiler-service/        # 云编译器 Docker 服务
│   ├── server.py            # Flask REST API
│   ├── Dockerfile           # espressif/idf:v5.4 基础镜像
│   └── template/            # ESP-IDF 工程模板
└── ota-firmware/            # OTA 引导固件（首次 USB 烧录）
    └── main/
        ├── main.c           # WiFi + HTTP OTA + WebSocket 日志
        ├── ota_ble.c        # NimBLE BLE OTA GATT 服务
        └── ota_ble.h
```

---

## License

MIT
