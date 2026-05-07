# ESP32 Vibe Coder

> 让硬件开发像聊天一样简单 —— AI 辅助嵌入式开发 Web IDE

在浏览器里用自然语言描述需求，AI 自动生成带完整硬件上下文的嵌入式代码；编译、烧录、日志分析全部在浏览器内完成，**无需安装任何工具链**。

---

## 核心思路

大家都在用 AI 做 Vibe Coding，但只停留在纯软件开发层面。硬件开发有两个致命缺口：

**第一，硬件上下文。** AI 不认识你的板子——它不知道 I2C 地址是 0x41 而不是 0x40，不知道 GPIO35/36/37 是 PSRAM 保留引脚。这些"隐性知识"不会出现在公开训练数据里。本项目把多年嵌入式经验提炼为 **AI 硬件上下文引擎**，每块板子一份完整的硬件 DNA。

**第二，物理闭环。** 代码烧进芯片，屏幕亮没亮、声音响没响——AI 看不到。本项目搭了完整的工具链：编译 → 烧录 → 日志 → AI 分析，让物理世界的结果能流回 AI。

**最妙的是自进化**：AI 在对话中发现新陷阱，一键持久化到本地 Skill。系统越用越懂你的板子。

---

## 功能特性

### AI 辅助编码
- **硬件上下文包** — AI 系统提示自动注入开发板全部引脚、外设地址、BSP 函数签名、陷阱知识，生成的代码开箱即用
- **AI 自进化** — 每次对话后自动发现新硬件陷阱，一键持久化
- **流式 AI 对话** — 支持 OpenAI 兼容接口 + Anthropic 原生 API，内置 8 个主流提供商预设
- **Monaco 代码编辑器** — C/C++/Arduino/汇编语法高亮、JetBrains Mono 字体、VS Dark 主题
- **一键插入** — AI 回复中每个代码块都有「写入项目」按钮

### 多板 / 多框架支持
- **3 种开发框架** — ESP-IDF (ESP32)、Arduino (nRF52/STM32)、STM32Cube HAL (STM32)
- **3 块板子开箱即用** — 立创实战派 ESP32-S3、Seeed XIAO nRF52840、STM32F103C8 Blue Pill
- **板子一键切换** — 顶部下拉菜单切换，系统自动切换硬件上下文、Skill 列表、编译配置
- **20 个外设 Skill** — 11 (SZPI) + 5 (XIAO) + 4 (Blue Pill)，持续增长

### 云端编译
- **ESP-IDF 编译器** — ESP-IDF v5.4 Docker 容器，生成 `.bin` 固件
- **Arduino 编译器** *(开发中)* — Arduino CLI，生成 `.hex` 固件
- **STM32Cube 编译器** *(开发中)* — arm-none-eabi-gcc，生成 `.hex` 固件
- **一键下载** — 编译成功后直接下载固件

### 无线烧录（OTA）
- **WiFi OTA** — HTTP 推送新固件，进度条实时显示，自动重启
- **BLE OTA** — Web Bluetooth API 直接蓝牙烧录，无需 WiFi

### 设备日志
- **WiFi WebSocket 日志流** — 实时接收，按级别过滤，关键字搜索
- **WebSerial 串口日志** — USB 直连串口，无需驱动
- **AI 日志分析** — 一键将日志发给 AI，自动定位错误原因

---

## 完整工作流

```
描述需求 → AI 生成代码 → 云端编译 → OTA 烧录 → 实时日志 → AI 分析报错
```

---

## 支持的 AI 提供商

| 提供商 | Base URL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Anthropic | `https://api.anthropic.com` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 阿里云百炼 (Qwen) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| 智谱 (GLM) | `https://open.bigmodel.cn/api/paas/v4` |
| MiniMax | `https://api.minimax.chat/v1` |
| Ollama (本地) | `http://localhost:11434/v1` |

任何 OpenAI 兼容接口均可使用。

---

## 快速开始

### 前端

```bash
git clone https://github.com/wangqioo/esp32-vibe-coder.git
cd esp32-vibe-coder
npm install --include=dev
npm run dev
# 打开 http://localhost:5173
```

### 云编译器（后端，ESP-IDF）

```bash
cd compiler-service
docker build -t esp32-compiler .
docker run -d -p 8760:8760 esp32-compiler
# 开发环境 Vite 代理 /compile → 127.0.0.1:8760
# 生产环境 nginx 代理 /compile → 127.0.0.1:8760
```

### OTA 引导固件（首次 USB 烧录，仅限 ESP32）

```bash
cd ota-firmware
idf.py menuconfig   # 配置 WiFi SSID / Password
idf.py build flash monitor
```

---

## 使用说明

1. 顶部下拉**选择你的板子** — 系统自动切换硬件上下文
2. 点击右上角 **⚙ 配置 AI**，填入 API Key 和模型
3. 勾选右侧**外设模块**（Skill）— AI 会注入对应外设的详细文档
4. 在聊天框用中文描述需求
5. AI 回复中点击 **「写入项目」** 将代码同步到编辑器
6. 点击 **▶ 编译** → 等待编译完成
7. 选择烧录方式：WiFi OTA / BLE 烧录 / 下载 .bin
8. 切换到 **📟 设备日志** → 点击 **✨ AI 分析** 自动排错

---

## 多板支持架构

这是项目的核心设计。每块板子是一个独立的**硬件语境包**，包含完整的引脚定义、外设陷阱知识、BSP 文档，以及该板专属的 AI Skill 文件。

```
src/context/boards/
├── index.js                   # 注册表 — 登记所有支持的板子
│
├── szpi_esp32s3/              # [ESP-IDF] 立创实战派 ESP32-S3
│   ├── definition.js          #   引脚图、I2C 地址陷阱、BSP 函数
│   └── skills/                #   11 个外设 Skill
│       ├── lvgl.js, audio.js, camera.js, imu.js, wifi.js ...
│
├── xiao_nrf52840/             # [Arduino] Seeed XIAO nRF52840
│   ├── definition.js          #   ARM M4F 引脚、NeoPixel、充电管理
│   └── skills/                #   5 个外设 Skill
│       ├── neopixel.js, ble.js, i2c.js, gpio.js, battery.js
│
└── stm32f103c8/               # [STM32Cube] STM32F103C8 Blue Pill
    ├── definition.js          #   Cortex-M3 引脚、时钟系统、HAL 模块
    └── skills/                #   4 个外设 Skill
        ├── gpio.js, uart.js, i2c.js, spi.js
```

### Board 对象结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一标识 |
| `name` | string | 板子名称 |
| `chip` | string | 芯片型号 |
| `framework` | `'esp-idf' \| 'arduino' \| 'stm32cube'` | 开发框架 |
| `basePrompt` | string | 硬件上下文（喂给 AI 的 system prompt） |
| `skills` | Skill[] | 该板可用的外设模块 |
| `idfTarget` | string? | ESP-IDF 目标芯片 |
| `arduinoBoardId` | string? | Arduino CLI FQBN |
| `mcuType` | string? | STM32 MCU 型号 |
| `linkerscript` | string? | 链接脚本文件名 |
| `flashSize` | string | Flash 大小（如 "16MB"） |

### 三框架隔离

| 维度 | `esp-idf` | `arduino` | `stm32cube` |
|---|---|---|---|
| 芯片架构 | Xtensa LX7 / RISC-V | ARM M0-M4 / AVR / RP2040 | ARM Cortex-M3/4/7 |
| 开发框架 | ESP-IDF v5.4 | Arduino (STM32duino / Adafruit) | STM32Cube HAL |
| 构建系统 | idf.py + CMake | Arduino CLI | arm-none-eabi-gcc + Makefile |
| 入口文件 | `main/main.c` | `sketch.ino` | `Src/main.c` |
| 配置格式 | sdkconfig, idf_component.yml | FQBN + libraries | HAL modules + defines |
| 依赖声明 | `idfComponents[]` | `arduinoLibraries[]` | `stm32HalModules[]` |
| 生成文件 | CMakeLists, sdkconfig, csv | sketch.ino, metadata | Makefile, Src/, Inc/, startup.s |

**自动化**：系统根据 `board.framework` 自动选择项目文件生成逻辑 —— `buildProjectFiles()` 内部分流到三个不同的 builder。

### Skill 对象结构

每个 Skill 包含：

```js
{
  id: 'uart',           // 唯一标识
  label: 'UART 串口',    // 显示名
  projectConfig: {       // 编译配置
    srcs: [],            // 附加源文件
    // 按框架：
    idfComponents: [],   // ESP-IDF 组件依赖
    arduinoLibraries:[], // Arduino 库依赖
    stm32HalModules:[],  // STM32 HAL 模块
    defines: [],         // 预处理器定义
    sdkconfig: [],       // ESP-IDF 配置项
    partitions: null,    // 分区表
    buildFlags: [],      // 编译标志
  },
  systemPrompt: `...`,   // AI 上下文（用法 + 陷阱）
}
```

### 新增一块板子

#### 同芯片同框架（如另一块 ESP32-S3 板）
只需新建 `boards/<id>/` 目录，写 `definition.js`（引脚、陷阱、BSP），然后在 `boards/index.js` 注册。Skill 直接复用或微调。

#### 不同框架（如加一块 RP2040 Arduino 板）
同上，注意设置 `framework: 'arduino'`，Skill 的 `projectConfig` 使用 `arduinoLibraries[]` 声明依赖。

#### 全新框架（如加一块 RISC-V 裸机板）
1. 在 `buildProjectFiles()` 中新增一个 builder 函数
2. 板子 `definition.js` 中设置 `framework: 'newfw'`
3. 新增的 builder 自动被调用

**你支持的板子越多，这个系统的护城河就越深** —— 每块板子的硬件上下文是 LLM 永远无法从公开语料中学到的。

---

## 当前支持的板子

| 板子 | 芯片 | 框架 | Skill 数量 |
|---|---|---|---|
| 立创实战派 ESP32-S3 | ESP32-S3 (Xtensa LX7) | ESP-IDF v5.4 | 11 |
| Seeed XIAO nRF52840 | nRF52840 (ARM M4F) | Arduino | 5 |
| STM32F103C8T6 Blue Pill | STM32F103C8 (ARM M3) | STM32Cube HAL | 4 |
| 更多... | | | 欢迎贡献 |

### 立创实战派 ESP32-S3 硬件陷阱（AI 已预置）

- ES7210 I2C 地址 `0x41`，非默认 `0x40`
- QMI8658 I2C 地址 `0x6A`，非 `0x6B`
- 所有 LVGL 调用需加 `lvgl_port_lock` / `lvgl_port_unlock`
- LCD CS 由 PCA9557 IO 扩展芯片控制，非直接 GPIO
- GPIO35/36/37 是 PSRAM 保留引脚，严禁使用

---

## BLE OTA 协议

| 方向 | 特征值 | 内容 |
|---|---|---|
| 浏览器 → 设备 | CTRL (write) | `[0x01, size(4B)]` 开始 / `[0x02]` 提交 / `[0x03]` 放弃 |
| 浏览器 → 设备 | DATA (write-no-rsp) | 固件块，最大 509 字节 (MTU-3) |
| 设备 → 浏览器 | STATUS (notify) | `[0x00]` 就绪 / `[0x01, offset(4B)]` 进度 / `[0x02]` 成功 / `[0x03, msg]` 错误 |

> BLE OTA 需要 **Chrome / Edge 桌面版**，设备广播名称为 `ESP32-Vibe-OTA`。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + Vite 5 |
| 代码编辑器 | Monaco Editor (`@monaco-editor/react`) |
| Markdown 渲染 | react-markdown + react-syntax-highlighter |
| AI 接口 | Fetch SSE（OpenAI 兼容 + Anthropic 原生） |
| 串口日志 | Web Serial API |
| BLE 烧录 | Web Bluetooth API |
| 云编译器 | Flask + gunicorn on `espressif/idf:v5.4` |
| ESP32 BLE 栈 | NimBLE (ESP-IDF 内置) |
| 部署 | nginx:alpine (Docker 多阶段构建) |

---

## 项目结构

```
esp32-vibe-coder/
├── src/                         # React 前端
│   ├── App.jsx                  # 根布局，板子选择，状态管理
│   ├── context/                 # ===== 核心引擎 =====
│   │   ├── index.js             # board-aware API (system prompt, file gen, patch)
│   │   ├── boards.js            # 兼容层 (BOARDS 映射)
│   │   └── boards/              # 板子注册表
│   │       ├── index.js         # getBoard(), getBoardList()
│   │       ├── szpi_esp32s3/    # [ESP-IDF] 11 skills
│   │       ├── xiao_nrf52840/   # [Arduino] 5 skills
│   │       └── stm32f103c8/     # [STM32Cube] 4 skills
│   ├── components/              # UI 组件
│   │   ├── ChatPanel.jsx        # AI 流式对话 + 自进化
│   │   ├── ProjectEditor.jsx    # Monaco 编辑器（框架感知）
│   │   ├── CompilePanel.jsx     # 编译 + OTA（框架感知）
│   │   ├── LogPanel.jsx         # 设备日志
│   │   └── SettingsModal.jsx    # AI 提供商配置
│   └── utils/                   # 工具
│       ├── aiApi.js             # 流式 AI 客户端
│       ├── compiler.js          # SSE 编译客户端
│       ├── ota.js               # WiFi OTA
│       ├── bleOta.js            # BLE OTA
│       └── logStream.js         # WS + WebSerial
├── compiler-service/            # 云编译器
│   └── server.py                # Flask + SSE + ESP-IDF
├── ota-firmware/                # OTA 引导固件 (ESP32)
│   └── main/main.c
├── Dockerfile                   # nginx:alpine, port 4100
├── docker-compose.yml           # network_mode: host
└── nginx.conf                   # SPA + /compile proxy
```

---

## 许可证

MIT
