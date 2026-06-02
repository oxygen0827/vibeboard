# VibeBoard

VibeBoard 是一个面向 ESP-IDF 开发板的 AI 辅助硬件开发工作台。

它不是简单的聊天窗口，而是把开发板硬件资料、外设能力、ESP-IDF 工程规则、代码生成、编译日志、固件产物和设备反馈串成一个浏览器 IDE。目标是让嵌入式开发过程更接近一次可验证的对话：描述需求，AI 基于板卡上下文生成代码，系统组装工程，本地 ESP-IDF 编译，失败后把日志反馈给 AI，再继续修正。

## 项目定位

通用 AI 编程工具经常缺少嵌入式开发里最关键的硬件约束：

- 哪些 GPIO 已经接了 LCD、摄像头、I2S、SDMMC、I2C 设备
- 哪些 GPIO 被 Flash、PSRAM、启动模式或板级电路占用，不能随便使用
- BSP 头文件、初始化顺序、外设地址和板级陷阱
- ESP-IDF 工程结构、CMake、sdkconfig、component manifest、分区表
- 编译错误、烧录结果、设备日志和运行时症状

VibeBoard 的核心做法是：把一块开发板抽象成一个硬件上下文包，再把上下文注入 AI。AI 负责生成应用代码，系统负责工程配置和编译验证。

## 当前支持的开发板

| 开发板 | 芯片 | 框架 | 说明 |
| --- | --- | --- | --- |
| 立创实战派 ESP32-S3 | ESP32-S3 | ESP-IDF v5.4 | 已内置较完整的板卡上下文、BSP 约束和外设 skill |

板卡定义入口：

```text
src/context/boards/szpi_esp32s3/definition.js
```

当前板卡上下文包含：

- ESP32-S3-WROOM-1-N16R8，16MB Flash，8MB Octal PSRAM
- I2C 总线：PCA9557、QMI8658、ES7210、ES8311、FT6336
- SPI LCD：ST7789，320x240，RGB565
- I2S 音频：ES8311 播放、ES7210 录音
- SDMMC、DVP 摄像头、BOOT 按键、LCD 背光
- 保留 GPIO：例如 GPIO35/36/37 被 Octal PSRAM 占用，不能使用
- 板级 BSP 头文件和函数：必须使用 `#include "esp32_s3_szp.h"`
- 常见陷阱：PCA9557 初始化顺序、音频 PA_EN、摄像头 PWDN、I2C 地址、PSRAM 配置等

## Skill 机制

板卡能力拆成多个 skill，位于：

```text
src/context/boards/szpi_esp32s3/skills/
```

当前包含：

- `lvgl`
- `audio`
- `camera`
- `imu`
- `wifi`
- `ble`
- `sdcard`
- `gpio`
- `speech`
- `vision`
- `handheld`

每个 skill 可以提供两类信息：

1. `systemPrompt`

   注入给 AI 的外设使用说明、初始化顺序、推荐 API、注意事项和禁用做法。

2. `projectConfig`

   用来生成 ESP-IDF 工程配置，例如：

   - `sdkconfig.defaults`
   - `main/idf_component.yml`
   - `main/CMakeLists.txt`
   - `partitions.csv`
   - 额外源文件
   - 编译选项
   - SPIFFS 分区

这意味着用户勾选不同 skill，AI 会获得不同上下文，工程配置也会随之变化。

## AI 如何结合硬件信息生成代码

项目里有两条 AI 路径：普通解释对话和结构化代码生成。

### 1. 普通对话

普通聊天入口在：

```text
src/components/ChatPanel.jsx
```

发送消息时，系统会调用当前板卡的：

```js
board.buildSystemPrompt(selectedSkills)
```

最终 prompt 由两部分组成：

```text
板卡 basePrompt
+ 用户选中的 skill systemPrompt
```

因此 AI 不只是看到用户一句话，还会看到开发板硬件约束、BSP 函数、GPIO 占用、外设地址、ESP-IDF 版本和代码输出规则。

普通对话适合解释、分析、询问实现方案。它不会直接修改工程文件。

### 2. 结构化代码生成

结构化生成逻辑在：

```text
src/utils/codeGeneration.js
```

用户点击生成代码时，系统要求 AI 只返回 JSON，不能返回 Markdown、解释文字或散乱代码块。格式如下：

```json
{
  "files": [
    { "path": "main/main.c", "content": "..." },
    { "path": "main/helper.h", "content": "..." },
    { "path": "main/helper.c", "content": "..." }
  ]
}
```

生成规则很明确：

- 只能生成应用源码
- 必须包含 `main/main.c` 或 `main/main.cpp`
- `main/main.c` 或 `main/main.cpp` 里必须有 `app_main`
- 可以拆分 helper 文件
- 如果 include 了本地头文件，必须同时生成该头文件
- 板级 API 只能 include `esp32_s3_szp.h`
- 不允许 AI 生成或修改 ESP-IDF 配置文件

## 文件校验和放置规则

AI 返回结果会经过：

```text
src/utils/filePlacement.js
src/utils/codeGeneration.js
```

系统只接受这些应用文件：

```text
main/main.c
main/main.cpp
main/*.c
main/*.cpp
main/*.h
main/*.hpp
main/*.s
```

这些文件默认会被拒绝：

```text
CMakeLists.txt
main/CMakeLists.txt
sdkconfig.defaults
main/idf_component.yml
partitions.csv
components/*
```

这样做的原因是：ESP-IDF 配置由 VibeBoard 根据板卡和 skill 自动生成，不能交给 AI 自由发挥。AI 主要负责应用层逻辑，系统负责工程结构和依赖边界。

## ESP-IDF 工程如何生成

工程组装逻辑在：

```text
src/utils/projectAssembly.js
src/context/index.js
```

核心函数：

```js
buildProjectFiles(boardId, projectName, selectedSkillIds)
assembleCompileFiles({ boardId, projectFiles, selectedSkills })
```

流程是：

1. 根据当前 board 和 selected skills 生成系统配置文件
2. 从用户/AI 的 projectFiles 中过滤掉系统配置文件
3. 合并应用源码和系统生成配置
4. 传给 compiler-service 编译

系统会自动生成：

```text
CMakeLists.txt
main/CMakeLists.txt
sdkconfig.defaults
main/idf_component.yml
partitions.csv
```

其中：

- `sdkconfig.defaults` 由板卡基础配置和 skill 配置合并
- `main/idf_component.yml` 由 skill 声明的 managed components 生成
- `main/CMakeLists.txt` 会包含 BSP 组件和 skill 所需组件
- 如果 skill 需要 SPIFFS，会自动追加 `spiffs_create_partition_image`
- 多个 skill 的分区表会按名称合并，优先保留更大的分区

## 编译服务

前端编译客户端：

```text
src/utils/compiler.js
```

后端服务：

```text
backend/compiler-service/server.py
```

本地开发时，Vite 代理：

```text
/compile -> http://127.0.0.1:8760
/health  -> http://127.0.0.1:8760
```

编译服务提供：

```text
GET  /health
POST /compile
```

`POST /compile` 会：

1. 复制 `backend/compiler-service/template`
2. 写入 AI 生成的应用源码和系统配置文件
3. 调用 `idf.py build`
4. 通过 SSE 流式返回编译日志
5. 编译成功后返回 base64 固件 bin
6. 编译失败时返回错误摘要

前端会把日志实时显示出来。成功时可以下载固件，失败时可以把错误日志作为下一轮 AI 修复输入。

## 本地部署

### 前端

```bash
npm install
npm run dev
```

默认访问：

```text
http://localhost:5173
```

如果端口被占用，Vite 会自动切换到下一个端口，例如：

```text
http://localhost:5174
```

### 编译服务：Docker 方式

README 原始设计推荐 Docker：

```bash
cd backend/compiler-service
docker build -t vibeboard-esp32-compiler .
docker run -d -p 8760:8760 vibeboard-esp32-compiler
```

这种方式不会依赖本机 ESP-IDF。

### 编译服务：使用本机 ESP-IDF

如果本机已经安装 ESP-IDF，可以直接启动 Python 服务，并指定模板目录和 `IDF_PATH`。

Windows 示例：

```powershell
$env:TEMPLATE_DIR="C:\Users\100448405\VibeBoard\backend\compiler-service\template"
$env:IDF_PATH="C:\Espressif\v5.4\esp-idf"
python server.py
```

服务启动后检查：

```text
http://127.0.0.1:8760/health
```

当前本机部署使用的是：

```text
C:\Espressif\v5.4\esp-idf
```

不会重装或覆盖 ESP-IDF 工具链。

## 主要目录

```text
src/components/ChatPanel.jsx
```

AI 对话、流式输出、结构化生成入口、skill 知识提取。

```text
src/components/ProjectEditor.jsx
```

工程文件编辑器。

```text
src/components/CompilePanel.jsx
```

编译、固件输出和下载流程。

```text
src/components/LogPanel.jsx
```

设备日志和 AI 辅助诊断。

```text
src/context/boards/
```

板卡定义、硬件上下文和 skill 注册。

```text
src/context/index.js
```

板卡 prompt 组装、skill 配置合并、ESP-IDF 工程配置生成。

```text
src/utils/codeGeneration.js
```

结构化代码生成 prompt、JSON 解析、生成结果校验。

```text
src/utils/filePlacement.js
```

路径归一化、源码/配置文件判定、安全路径检查。

```text
src/utils/projectAssembly.js
```

编译前工程文件组装。

```text
src/utils/compiler.js
```

SSE 编译客户端。

```text
backend/compiler-service/
```

ESP-IDF 编译服务和工程模板。

## 当前设计边界

VibeBoard 的关键边界是：

```text
AI 生成应用代码
系统生成 ESP-IDF 配置
本地 compiler-service 验证结果
```

AI 可以生成：

```text
main/main.c
main/main.cpp
main/*.c
main/*.cpp
main/*.h
main/*.hpp
```

AI 不应该生成：

```text
CMakeLists.txt
main/CMakeLists.txt
sdkconfig.defaults
main/idf_component.yml
partitions.csv
components/*
```

这个边界能显著降低 AI 破坏 ESP-IDF 工程结构的概率。

## 后续改进方向

从代码结构看，项目下一步最值得加强的是：

1. 板卡上下文进一步结构化

   现在大量硬件信息在 `basePrompt` 中，后续可以拆成机器可读字段，例如 pin map、reserved pins、bus devices、BSP APIs、known pitfalls。

2. 增加硬件冲突检查

   在 AI 代码进入工程前，扫描 GPIO 使用、I2C 地址、外设初始化顺序，提前拒绝明显错误。

3. 编译错误分类

   当前 compiler-service 会提取错误摘要。后续可以进一步分类为 include 错误、undefined reference、CMake 错误、component 错误、sdkconfig 错误。

4. AI 修复闭环

   编译失败后，把结构化错误和当前源码交给 AI，只允许它 patch `main/` 下的应用文件。

5. 多开发板支持

   新增开发板时，只需要增加 board definition、skills 和模板/BSP 支持，前端流程可以复用。

6. 日志和硬件反馈闭环

   将 Web Serial、WebSocket 日志和 AI 诊断结合，让 AI 不只看编译错误，也能看运行时异常。

## License

See [LICENSE](./LICENSE).
