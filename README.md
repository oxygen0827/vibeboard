     1|# ESP32 Vibe Coder
     2|
     3|> 让硬件开发像聊天一样简单 —— AI 辅助嵌入式开发 Web IDE
     4|
     5|在浏览器里用自然语言描述需求，AI 自动生成带完整硬件上下文的嵌入式代码；编译、烧录、日志分析全部在浏览器内完成，**无需安装任何工具链**。
     6|
     7|---
     8|
     9|## 核心思路
    10|
    11|大家都在用 AI 做 Vibe Coding，但只停留在纯软件开发层面。硬件开发有两个致命缺口：
    12|
    13|**第一，硬件上下文。** AI 不认识你的板子——它不知道 I2C 地址是 0x41 而不是 0x40，不知道 GPIO35/36/37 是 PSRAM 保留引脚。这些"隐性知识"不会出现在公开训练数据里。本项目把多年嵌入式经验提炼为 **AI 硬件上下文引擎**，每块板子一份完整的硬件 DNA。
    14|
    15|**第二，物理闭环。** 代码烧进芯片，屏幕亮没亮、声音响没响——AI 看不到。本项目搭了完整的工具链：编译 → 烧录 → 日志 → AI 分析，让物理世界的结果能流回 AI。
    16|
    17|**最妙的是自进化**：AI 在对话中发现新陷阱，一键持久化到本地 Skill。系统越用越懂你的板子。
    18|
    19|---
    20|
    21|## 功能特性
    22|
    23|### AI 辅助编码
    24|- **硬件上下文包** — AI 系统提示自动注入开发板全部引脚、外设地址、BSP 函数签名、陷阱知识，生成的代码开箱即用
    25|- **AI 自进化** — 每次对话后自动发现新硬件陷阱，一键持久化
    26|- **流式 AI 对话** — 支持 OpenAI 兼容接口 + Anthropic 原生 API，内置 8 个主流提供商预设
    27|- **Monaco 代码编辑器** — C/C++/Arduino/汇编语法高亮、JetBrains Mono 字体、VS Dark 主题
    28|- **一键插入** — AI 回复中每个代码块都有「写入项目」按钮
    29|
    30|### 多板 / 多框架支持
    31|- **3 种开发框架** — ESP-IDF (ESP32)、Arduino (nRF52/STM32)、STM32Cube HAL (STM32)
    32|- **3 块板子开箱即用** — 立创实战派 ESP32-S3、Seeed XIAO nRF52840、STM32F103C8 Blue Pill
    33|- **板子一键切换** — 顶部下拉菜单切换，系统自动切换硬件上下文、Skill 列表、编译配置
    34|- **20 个外设 Skill** — 11 (SZPI) + 5 (XIAO) + 4 (Blue Pill)，持续增长
    35|
    36|### 云端编译
    37|- **ESP-IDF 编译器** — ESP-IDF v5.4 Docker 容器，生成 `.bin` 固件
    38|- **Arduino 编译器** *(开发中)* — Arduino CLI，生成 `.hex` 固件
    39|- **STM32Cube 编译器** *(开发中)* — arm-none-eabi-gcc，生成 `.hex` 固件
    40|- **一键下载** — 编译成功后直接下载固件
    41|
    42|### 无线烧录（OTA）
    43|- **WiFi OTA** — HTTP 推送新固件，进度条实时显示，自动重启
    44|- **BLE OTA** — Web Bluetooth API 直接蓝牙烧录，无需 WiFi
    45|
    46|### 设备日志
    47|- **WiFi WebSocket 日志流** — 实时接收，按级别过滤，关键字搜索
    48|- **WebSerial 串口日志** — USB 直连串口，无需驱动
    49|- **AI 日志分析** — 一键将日志发给 AI，自动定位错误原因
    50|
    51|---
    52|
    53|## 完整工作流
    54|
    55|```
    56|描述需求 → AI 生成代码 → 云端编译 → OTA 烧录 → 实时日志 → AI 分析报错
    57|```
    58|
    59|---
    60|
    61|## 支持的 AI 提供商
    62|
    63|| 提供商 | Base URL |
    64||---|---|
    65|| OpenAI | `https://api.openai.com/v1` |
    66|| Anthropic | `https://api.anthropic.com` |
    67|| DeepSeek | `https://api.deepseek.com/v1` |
    68|| 阿里云百炼 (Qwen) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
    69|| Groq | `https://api.groq.com/openai/v1` |
    70|| 智谱 (GLM) | `https://open.bigmodel.cn/api/paas/v4` |
    71|| MiniMax | `https://api.minimax.chat/v1` |
    72|| Ollama (本地) | `http://localhost:11434/v1` |
    73|
    74|任何 OpenAI 兼容接口均可使用。
    75|
    76|---
    77|
    78|## 快速开始
    79|
    80|### 前端
    81|
    82|```bash
    83|git clone https://github.com/wangqioo/esp32-vibe-coder.git
    84|cd esp32-vibe-coder
    85|npm install --include=dev
    86|npm run dev
    87|# 打开 http://localhost:5173
    88|```
    89|
    90|### 云编译器（后端，ESP-IDF）
    91|
    92|```bash
    93|cd backend/compiler-service
    94|docker build -t esp32-compiler .
    95|docker run -d -p 8760:8760 esp32-compiler
    96|# 开发环境 Vite 代理 /compile → 127.0.0.1:8760
    97|# 生产环境 nginx 代理 /compile → 127.0.0.1:8760
    98|```
    99|
   100|### OTA 引导固件（首次 USB 烧录，仅限 ESP32）
   101|
   102|```bash
   103|cd hardware/ota-firmware
   104|idf.py menuconfig   # 配置 WiFi SSID / Password
   105|idf.py build flash monitor
   106|```
   107|
   108|---
   109|
   110|## 使用说明
   111|
   112|1. 顶部下拉**选择你的板子** — 系统自动切换硬件上下文
   113|2. 点击右上角 **⚙ 配置 AI**，填入 API Key 和模型
   114|3. 勾选右侧**外设模块**（Skill）— AI 会注入对应外设的详细文档
   115|4. 在聊天框用中文描述需求
   116|5. AI 回复中点击 **「写入项目」** 将代码同步到编辑器
   117|6. 点击 **▶ 编译** → 等待编译完成
   118|7. 选择烧录方式：WiFi OTA / BLE 烧录 / 下载 .bin
   119|8. 切换到 **📟 设备日志** → 点击 **✨ AI 分析** 自动排错
   120|
   121|---
   122|
   123|## 多板支持架构
   124|
   125|这是项目的核心设计。每块板子是一个独立的**硬件语境包**，包含完整的引脚定义、外设陷阱知识、BSP 文档，以及该板专属的 AI Skill 文件。
   126|
   127|```
   128|src/context/boards/
   129|├── index.js                   # 注册表 — 登记所有支持的板子
   130|│
   131|├── szpi_esp32s3/              # [ESP-IDF] 立创实战派 ESP32-S3
   132|│   ├── definition.js          #   引脚图、I2C 地址陷阱、BSP 函数
   133|│   └── skills/                #   11 个外设 Skill
   134|│       ├── lvgl.js, audio.js, camera.js, imu.js, wifi.js ...
   135|│
   136|├── xiao_nrf52840/             # [Arduino] Seeed XIAO nRF52840
   137|│   ├── definition.js          #   ARM M4F 引脚、NeoPixel、充电管理
   138|│   └── skills/                #   5 个外设 Skill
   139|│       ├── neopixel.js, ble.js, i2c.js, gpio.js, battery.js
   140|│
   141|└── stm32f103c8/               # [STM32Cube] STM32F103C8 Blue Pill
   142|    ├── definition.js          #   Cortex-M3 引脚、时钟系统、HAL 模块
   143|    └── skills/                #   4 个外设 Skill
   144|        ├── gpio.js, uart.js, i2c.js, spi.js
   145|```
   146|
   147|### Board 对象结构
   148|
   149|| 字段 | 类型 | 说明 |
   150||---|---|---|
   151|| `id` | string | 唯一标识 |
   152|| `name` | string | 板子名称 |
   153|| `chip` | string | 芯片型号 |
   154|| `framework` | `'esp-idf' \| 'arduino' \| 'stm32cube'` | 开发框架 |
   155|| `basePrompt` | string | 硬件上下文（喂给 AI 的 system prompt） |
   156|| `skills` | Skill[] | 该板可用的外设模块 |
   157|| `idfTarget` | string? | ESP-IDF 目标芯片 |
   158|| `arduinoBoardId` | string? | Arduino CLI FQBN |
   159|| `mcuType` | string? | STM32 MCU 型号 |
   160|| `linkerscript` | string? | 链接脚本文件名 |
   161|| `flashSize` | string | Flash 大小（如 "16MB"） |
   162|
   163|### 三框架隔离
   164|
   165|| 维度 | `esp-idf` | `arduino` | `stm32cube` |
   166||---|---|---|---|
   167|| 芯片架构 | Xtensa LX7 / RISC-V | ARM M0-M4 / AVR / RP2040 | ARM Cortex-M3/4/7 |
   168|| 开发框架 | ESP-IDF v5.4 | Arduino (STM32duino / Adafruit) | STM32Cube HAL |
   169|| 构建系统 | idf.py + CMake | Arduino CLI | arm-none-eabi-gcc + Makefile |
   170|| 入口文件 | `main/main.c` | `sketch.ino` | `Src/main.c` |
   171|| 配置格式 | sdkconfig, idf_component.yml | FQBN + libraries | HAL modules + defines |
   172|| 依赖声明 | `idfComponents[]` | `arduinoLibraries[]` | `stm32HalModules[]` |
   173|| 生成文件 | CMakeLists, sdkconfig, csv | sketch.ino, metadata | Makefile, Src/, Inc/, startup.s |
   174|
   175|**自动化**：系统根据 `board.framework` 自动选择项目文件生成逻辑 —— `buildProjectFiles()` 内部分流到三个不同的 builder。
   176|
   177|### Skill 对象结构
   178|
   179|每个 Skill 包含：
   180|
   181|```js
   182|{
   183|  id: 'uart',           // 唯一标识
   184|  label: 'UART 串口',    // 显示名
   185|  projectConfig: {       // 编译配置
   186|    srcs: [],            // 附加源文件
   187|    // 按框架：
   188|    idfComponents: [],   // ESP-IDF 组件依赖
   189|    arduinoLibraries:[], // Arduino 库依赖
   190|    stm32HalModules:[],  // STM32 HAL 模块
   191|    defines: [],         // 预处理器定义
   192|    sdkconfig: [],       // ESP-IDF 配置项
   193|    partitions: null,    // 分区表
   194|    buildFlags: [],      // 编译标志
   195|  },
   196|  systemPrompt: `...`,   // AI 上下文（用法 + 陷阱）
   197|}
   198|```
   199|
   200|### 新增一块板子
   201|
   202|#### 同芯片同框架（如另一块 ESP32-S3 板）
   203|只需新建 `boards/<id>/` 目录，写 `definition.js`（引脚、陷阱、BSP），然后在 `boards/index.js` 注册。Skill 直接复用或微调。
   204|
   205|#### 不同框架（如加一块 RP2040 Arduino 板）
   206|同上，注意设置 `framework: 'arduino'`，Skill 的 `projectConfig` 使用 `arduinoLibraries[]` 声明依赖。
   207|
   208|#### 全新框架（如加一块 RISC-V 裸机板）
   209|1. 在 `buildProjectFiles()` 中新增一个 builder 函数
   210|2. 板子 `definition.js` 中设置 `framework: 'newfw'`
   211|3. 新增的 builder 自动被调用
   212|
   213|**你支持的板子越多，这个系统的护城河就越深** —— 每块板子的硬件上下文是 LLM 永远无法从公开语料中学到的。
   214|
   215|---
   216|
   217|## 当前支持的板子
   218|
   219|| 板子 | 芯片 | 框架 | Skill 数量 |
   220||---|---|---|---|
   221|| 立创实战派 ESP32-S3 | ESP32-S3 (Xtensa LX7) | ESP-IDF v5.4 | 11 |
   222|| Seeed XIAO nRF52840 | nRF52840 (ARM M4F) | Arduino | 5 |
   223|| STM32F103C8T6 Blue Pill | STM32F103C8 (ARM M3) | STM32Cube HAL | 4 |
   224|| 更多... | | | 欢迎贡献 |
   225|
   226|### 立创实战派 ESP32-S3 硬件陷阱（AI 已预置）
   227|
   228|- ES7210 I2C 地址 `0x41`，非默认 `0x40`
   229|- QMI8658 I2C 地址 `0x6A`，非 `0x6B`
   230|- 所有 LVGL 调用需加 `lvgl_port_lock` / `lvgl_port_unlock`
   231|- LCD CS 由 PCA9557 IO 扩展芯片控制，非直接 GPIO
   232|- GPIO35/36/37 是 PSRAM 保留引脚，严禁使用
   233|
   234|---
   235|
   236|## BLE OTA 协议
   237|
   238|| 方向 | 特征值 | 内容 |
   239||---|---|---|
   240|| 浏览器 → 设备 | CTRL (write) | `[0x01, size(4B)]` 开始 / `[0x02]` 提交 / `[0x03]` 放弃 |
   241|| 浏览器 → 设备 | DATA (write-no-rsp) | 固件块，最大 509 字节 (MTU-3) |
   242|| 设备 → 浏览器 | STATUS (notify) | `[0x00]` 就绪 / `[0x01, offset(4B)]` 进度 / `[0x02]` 成功 / `[0x03, msg]` 错误 |
   243|
   244|> BLE OTA 需要 **Chrome / Edge 桌面版**，设备广播名称为 `ESP32-Vibe-OTA`。
   245|
   246|---
   247|
   248|## 技术栈
   249|
   250|| 层 | 技术 |
   251||---|---|
   252|| 前端框架 | React 18 + Vite 5 |
   253|| 代码编辑器 | Monaco Editor (`@monaco-editor/react`) |
   254|| Markdown 渲染 | react-markdown + react-syntax-highlighter |
   255|| AI 接口 | Fetch SSE（OpenAI 兼容 + Anthropic 原生） |
   256|| 串口日志 | Web Serial API |
   257|| BLE 烧录 | Web Bluetooth API |
   258|| 云编译器 | Flask + gunicorn on `espressif/idf:v5.4` |
   259|| ESP32 BLE 栈 | NimBLE (ESP-IDF 内置) |
   260|| 部署 | nginx:alpine (Docker 多阶段构建) |
   261|
   262|---
   263|
   264|## 项目结构
   265|
   266|```
   267|esp32-vibe-coder/
   268|├── src/                         # React 前端
   269|│   ├── App.jsx                  # 根布局，板子选择，状态管理
   270|│   ├── context/                 # ===== 核心引擎 =====
   271|│   │   ├── index.js             # board-aware API (system prompt, file gen, patch)
   272|│   │   ├── boards.js            # 兼容层 (BOARDS 映射)
   273|│   │   └── boards/              # 板子注册表
   274|│   │       ├── index.js         # getBoard(), getBoardList()
   275|│   │       ├── szpi_esp32s3/    # [ESP-IDF] 11 skills
   276|│   │       ├── xiao_nrf52840/   # [Arduino] 5 skills
   277|│   │       └── stm32f103c8/     # [STM32Cube] 4 skills
   278|│   ├── components/              # UI 组件
   279|│   │   ├── ChatPanel.jsx        # AI 流式对话 + 自进化
   280|│   │   ├── ProjectEditor.jsx    # Monaco 编辑器（框架感知）
   281|│   │   ├── CompilePanel.jsx     # 编译 + OTA（框架感知）
   282|│   │   ├── LogPanel.jsx         # 设备日志
   283|│   │   └── SettingsModal.jsx    # AI 提供商配置
   284|│   └── utils/                   # 工具
   285|│       ├── aiApi.js             # 流式 AI 客户端
   286|│       ├── compiler.js          # SSE 编译客户端
   287|│       ├── ota.js               # WiFi OTA
   288|│       ├── bleOta.js            # BLE OTA
   289|│       └── logStream.js         # WS + WebSerial
   290|├── backend/compiler-service/       # 云编译器
   291|│   └── server.py                # Flask + SSE + ESP-IDF
   292|├── hardware/ota-firmware/           # OTA 引导固件 (ESP32)
   293|│   └── main/main.c
   294|├── deploy/Dockerfile               # nginx:alpine, port 4100
   295|├── deploy/docker-compose.yml       # network_mode: host
   296|└── deploy/nginx.conf               # SPA + /compile proxy
   297|```
   298|
   299|---
   300|
   301|## 许可证
   302|
   303|MIT
   304|