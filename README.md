# VibeBoard

VibeBoard 是一个面向 ESP-IDF 开发板的 AI 硬件开发工作台。它把板卡上下文、自然语言代码生成、官方例程编译、云端 ESP-IDF 构建、HTTPS 网页 USB 直刷、WiFi OTA、BLE OTA 和设备反馈串成一条完整链路。

当前目标不是做一个泛泛的聊天工具，而是让嵌入式开发可以这样推进：

```text
描述需求 / 选择官方例程
  -> 生成或选择 ESP-IDF 工程
  -> 云端编译
  -> USB 全量烧录或 OTA 推送
  -> 读取设备日志和运行结果
  -> 继续让 AI 修正
```

## 当前支持的硬件

| 开发板 | 芯片 | 框架 | 状态 |
| --- | --- | --- | --- |
| 立创实战派 ESP32-S3 / SZPI ESP32-S3 | ESP32-S3 | ESP-IDF v5.4 | 当前主力支持 |

VibeBoard 现在是 ESP-IDF-first。Arduino 和泛用多板卡模板不是当前重点。

## MCU 分层开发标准

VibeBoard 的 AI 生成代码不按普通 Linux 应用开发来处理。Linux 应用通常站在操作系统和成熟驱动之上，开发重点是业务逻辑；MCU 固件必须同时满足功能逻辑、板卡事实、外设初始化、BSP API、编译配置、烧录布局和真实硬件反馈。

项目采用固定分层：

```text
L0 Hardware Facts       芯片、模组、Flash/PSRAM、器件、引脚、保留 GPIO
L1 Chip Peripherals    GPIO/I2C/SPI/I2S/UART/WiFi/BLE/DMA/中断等芯片外设
L2 Board Support       BSP、板级初始化、电源/复位/扩展 IO、官方例程事实
L3 Driver Contracts    每项能力允许调用的 API、初始化顺序、禁止项、常见失败
L4 App Orchestration   app_main、FreeRTOS task、状态机、外设组合、日志
L5 Product Behavior    用户自然语言描述的设备行为、交互、验收结果
```

职责边界：

- VibeBoard 负责 L0-L3：板卡事实、BSP、工程配置、组件依赖、分区表、Driver Contract 和安全写入边界。
- AI 负责 L4-L5：把用户需求转换成应用源码、状态机、任务编排、UI/外设组合和可观察日志。
- AI 不允许自由修改系统拥有文件：`CMakeLists.txt`、`sdkconfig.defaults`、`idf_component.yml`、`partitions.csv`、BSP/component 文件。
- 每个硬件能力必须尽量沉淀为 Driver Contract，而不是只写在 prompt 里。

当前 SZPI ESP32-S3 的 Driver Contract 位于：

```text
src/context/boards/szpi_esp32s3/driverContracts.js
```

Program Manifest 是 AI 规划和 AI 写代码之间的稳定中间产物，包含 `skillIds`、`driverContracts`、`runtimeServices`、`acceptanceChecks` 和应用源码文件计划。

## 当前已跑通的能力

- 自然语言生成 ESP-IDF 应用代码。
- 左侧树状项目文件视图，接近 VS Code 的工程排布方式。
- 系统自动生成 ESP-IDF 工程配置：
  - 根目录 `CMakeLists.txt`
  - `main/CMakeLists.txt`
  - `sdkconfig.defaults`
  - `main/idf_component.yml`
  - `partitions.csv`
- 官方 SZPI 例程原封不动编译，不经过 AI 改写。
- OTA 基础固件编译，支持填写 WiFi SSID / 密码。
- 云端 ESP-IDF 编译服务。
- HTTPS 网页 USB 直刷，基于 Web Serial 和 `esptool-js`。
- 编译结果带 flash manifest 时，USB 会全量烧录：
  - bootloader -> `0x0`
  - partition table -> `0x8000`
  - OTA data -> `0xD000`
  - app -> `0x10000`
- 编译结果只有 app 时，USB 退回到 app-only 烧录 `0x10000`。
- 对运行 OTA 基础固件的设备执行 WiFi OTA 推送。
- BLE OTA 基础能力。
- 编译证据、错误摘要和 AI 修复入口。

## 当前在线地址

用于 USB 直刷的 HTTPS 地址：

```text
https://habitat-cas-lens-dept.trycloudflare.com
```

原有 FRP HTTP 地址：

```text
http://150.158.146.192:6054/
```

当前 FRP HTTP 地址可能不可达。USB 直刷必须使用 HTTPS 地址。Chrome / Edge 只有在可信安全上下文中才会开放 `navigator.serial`，所以普通 HTTP FRP 页面不能直接连接 USB 串口。

当前 HTTPS 链路是 Cloudflare Quick Tunnel：

```text
浏览器
  -> Cloudflare HTTPS
  -> 家里 4060Ti 服务器上的 cloudflared
  -> http://127.0.0.1:4100
  -> VibeBoard nginx 容器
```

Quick Tunnel 的域名可能在服务重启后变化。家里服务器上查看最新地址：

```bash
tail -80 /home/wq/vibeboard-deploy/cloudflared-vibeboard.log
```

管理隧道服务：

```bash
systemctl --user status vibeboard-cloudflared.service
systemctl --user restart vibeboard-cloudflared.service
```

部署细节见 [deploy/HTTPS_USB_FLASH.md](./deploy/HTTPS_USB_FLASH.md)。

## 完整使用流程

### 1. 打开网页

使用 Chrome 或 Edge 打开：

```text
https://habitat-cas-lens-dept.trycloudflare.com
```

### 2. 首次刷 OTA 基础固件

如果后续要通过 WiFi OTA 推送官方例程或新工程，板子必须先运行带 OTA 分区表的 OTA 基础固件。

操作步骤：

1. 打开 **编译 & 烧录**。
2. 选择 **OTA 基础固件**。
3. 填 WiFi SSID 和密码。
4. 点击编译。
5. 编译成功后点击 **USB 直刷（Web Serial）**。

OTA 基础固件编译结果会返回完整 flash manifest，USB 直刷会写入：

```text
bootloader        0x0
partition-table   0x8000
ota-data          0xD000
app               0x10000
```

这个全量烧录很重要。如果只把 app 写到 `0x10000`，设备虽然能启动并连接 WiFi，但 OTA 时会失败：

```text
no ota partition
```

### 3. 获取设备 IP

OTA 基础固件启动后会在串口日志里打印 IP：

```text
Got IP: 192.168.1.53
HTTP OTA server listening on port 3232
```

设备会提供这些接口：

```text
http://<设备IP>:3232/ping
http://<设备IP>:3232/info
http://<设备IP>:3232/ota
```

当前版本还没有把 IP 显示到开发板屏幕上。先通过串口日志或路由器 DHCP 列表查看。

### 4. 编译并 OTA 推送官方例程

1. 打开 **编译 & 烧录**。
2. 选择 **官方例程**。
3. 选择例程，例如 `01-boot_key`。
4. 点击编译。
5. 在 **设备 IP（WiFi OTA）** 中输入设备 IP，例如：

```text
192.168.1.53
```

6. 点击 **WiFi OTA 推送**。

官方例程会从服务器上的原始工程目录直接编译，AI 不会改写源码。

注意：大多数官方例程本身不带 OTA 服务。OTA 推送官方例程成功后，板子会运行官方例程，后续可能不能继续 OTA。想再换固件时，通常需要再次 USB 直刷 **OTA 基础固件**，再 OTA 推送下一个工程。

### 5. 远程 OTA：板子和服务器不在同一局域网

局域网 OTA 是浏览器直接访问：

```text
浏览器 -> http://<设备IP>:3232/ota
```

所以它要求浏览器和板子网络互通。远程 OTA 不走这条路，而是让板子主动访问 VibeBoard 服务器：

```text
板子 VibeBoard Agent
  -> POST /api/devices/heartbeat
  -> GET /api/devices/<deviceId>/ota-job
  -> 下载 firmware.bin
  -> 写 OTA 分区并重启
```

使用方式：

1. 编译 **OTA 基础固件** 时填写：
   - WiFi SSID / 密码
   - 远程 OTA 服务器，例如当前 HTTPS 页面地址
   - 设备 ID
   - 设备 Token
2. 通过 **USB 直刷** 全量刷入这个 OTA 基础固件。
3. 板子联网后会主动心跳注册到服务器。
4. 编译任意新固件或官方例程。
5. 在 **远程 OTA（设备主动拉取）** 里选择在线设备。
6. 点击 **远程 OTA**。

远程 OTA 的核心优势是：板子只要能访问公网 HTTPS 服务器，就不需要和浏览器、编译服务器在同一个局域网。

当前远程 OTA 状态存储在编译服务容器内的 `/tmp/vibeboard-remote-ota`。正式生产建议把这个目录挂载为持久化 volume，或者迁移到数据库和对象存储。

### 6. 生成新应用代码

1. 在聊天面板选择外设 skill。
2. 点击 **生成代码** 让 AI 修改项目文件。
3. 点击 **解释** 只聊天，不修改项目。
4. 生成结果会写入左侧项目树。
5. 编译 **当前工程**。
6. 通过 USB、WiFi OTA、BLE OTA 或下载 `.bin` 交付固件。

AI 只能生成应用源码。`CMakeLists.txt`、`sdkconfig.defaults`、`idf_component.yml`、`partitions.csv` 和 BSP/component 文件由系统生成，不允许 AI 直接覆盖。

## 官方例程

编译服务从容器内读取官方例程：

```text
/compiler/examples
```

当前部署使用的原始例程包是：

```text
/Users/wq/Desktop/szpi-s3-esp/szpi-s3-esp-01-12.zip
```

前端注册的官方例程元数据在 [src/data/officialExamples.js](./src/data/officialExamples.js)，当前是 `01` 到 `12`。

## 板卡上下文和 Skill

板卡定义入口：

```text
src/context/boards/szpi_esp32s3/definition.js
```

当前板卡上下文包含：

- ESP32-S3-WROOM-1-N16R8，16MB Flash，8MB Octal PSRAM。
- I2C 总线：PCA9557、QMI8658、ES7210、ES8311、FT6336。
- SPI LCD：ST7789，320x240，RGB565。
- I2S 音频：ES8311 播放、ES7210 录音。
- SDMMC、DVP 摄像头、BOOT 按键、LCD 背光。
- 保留 GPIO，例如 GPIO35/36/37 被 Octal PSRAM 占用。
- 板级 BSP 头文件和函数：`#include "esp32_s3_szp.h"`。
- 常见陷阱：PCA9557 初始化顺序、音频 PA_EN、摄像头 PWDN、I2C 地址、PSRAM 配置等。

板卡能力拆成 skill：

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

每个 skill 可以提供：

- 注入 AI 的外设使用说明和限制。
- ESP-IDF 工程配置需求。
- 分区表、组件依赖、sdkconfig 片段和测试约束。
- Driver Contract：结构化的初始化顺序、允许 API、禁止 API、验收检查和常见失败。

### Driver Contract 开发要求

新增或修改硬件能力时，必须同步维护：

1. Board Profile：硬件事实是否完整，尤其是引脚、保留资源、芯片型号、外设型号。
2. Capability Skill：是否声明 `projectConfig`、依赖组件、sdkconfig、prompt 片段。
3. Driver Contract：是否声明 `requiredInit`、`allowedApis`、`forbiddenApis`、`acceptanceChecks`、`commonFailures`。
4. Manifest 校验：是否能拒绝缺失 skill、未知 contract、非法 runtime service。
5. Source Validation：是否能在编译前拦截明显越权 API 或系统文件写入。

这套标准的目标是让 AI 只做应用编排，不让 AI 猜硬件驱动、猜 GPIO、猜工程配置。

## 本地开发

安装前端依赖并启动 Vite：

```bash
git clone https://github.com/wangqioo/VibeBoard.git
cd VibeBoard
npm install
npm run dev
```

打开：

```text
http://localhost:5173
```

`localhost` 也是浏览器安全上下文，所以本地开发时 Web Serial 可以在 HTTP localhost 下使用。

## 编译服务

编译服务位于 [backend/compiler-service](./backend/compiler-service)。

构建并运行：

```bash
cd backend/compiler-service
docker build -t vibeboard-esp32-compiler .
docker run -d --name esp32-compiler -p 8760:8760 vibeboard-esp32-compiler
```

服务接口：

| 接口 | 作用 |
| --- | --- |
| `GET /health` | 编译服务健康检查 |
| `GET /examples` | 列出已上传官方例程 |
| `POST /compile` | 编译当前组装工程 |
| `POST /compile-example` | 原封不动编译官方例程 |
| `POST /compile-ota-receiver` | 编译 WiFi OTA 基础固件 |
| `POST /api/devices/heartbeat` | 设备心跳和注册 |
| `GET /api/devices` | 远程设备列表 |
| `POST /api/firmware` | 上传远程 OTA 固件 |
| `GET /api/firmware/<firmwareId>/download` | 设备下载固件 |
| `POST /api/ota-jobs` | 创建远程 OTA 任务 |
| `GET /api/devices/<deviceId>/ota-job` | 设备领取远程 OTA 任务 |
| `POST /api/ota-jobs/<jobId>/status` | 设备上报 OTA 任务状态 |

构建结果通过 Server-Sent Events 流式返回。成功时返回 app `.bin`，并在可用时返回 `flashFiles`，供网页 USB 全量烧录。

## 数字孪生 / LVGL 仿真服务

数字孪生前端预览已接入 [src/components/DigitalTwinPreview.jsx](./src/components/DigitalTwinPreview.jsx)。当前有两层：

- 语义预览：AI 返回 `uiManifest` 后，浏览器立即渲染 320x240 的屏幕/控件预览。
- LVGL Runtime Package：平台从应用源码生成 `sim/lvgl-runtime/` 仿真工作区，后续由 LVGL/Emscripten 或 LVGL/SDL 服务真实渲染。

服务代码位于：

```text
backend/lvgl-sim-service
```

家里服务器部署命令：

```bash
cd backend/lvgl-sim-service
docker build -t vibeboard-lvgl-sim .
docker compose up -d
```

主 nginx 已代理：

| 路径 | 后端 |
| --- | --- |
| `POST /simulate-lvgl` | `127.0.0.1:8770/simulate-lvgl` |
| `GET /lvgl-sim-health` | `127.0.0.1:8770/health` |

当前 LVGL 服务边界已经建立，但真实 LVGL/Emscripten 源码集成仍在推进中；没有 `emcc` 或 LVGL runtime 未接入时，服务会返回明确状态而不是伪装成功。

### 数字孪生待做计划

当前家里服务器部署的是轻量 LVGL 仿真服务镜像，`/lvgl-sim-health`
会返回 `{"status":"ok","emcc":false}`。这表示服务接口、nginx 代理和
runtime package 接收链路已经上线，但还没有接入真正的 Emscripten/LVGL
WASM 渲染工具链。

后续需要完成：

1. 制作稳定的 LVGL/Emscripten builder 镜像，避免在线部署时直接拉大体积
   `emscripten/emsdk` 基础镜像导致超时。
2. 把 `sim/lvgl-runtime/` 中生成的 `app_ui.c/h`、LVGL init、模拟 display/input
   和必要 mock BSP 组合成可编译的 WASM/HTML preview bundle。
3. 将 `/simulate-lvgl` 从当前的 `toolchain-missing` / `lvgl-runtime-not-wired`
   状态升级为返回真实预览产物地址、构建日志和失败分类。
4. 在前端 Digital Twin 面板中区分三层状态：语义预览、LVGL 服务可达、真实
   LVGL framebuffer/WASM 预览可用。
5. 为服务器部署增加 health check 和镜像回滚说明，确保 LVGL 仿真服务失败时
   不影响主站、编译服务和 OTA 流程。

## 关键源码结构

- [src/components/ChatPanel.jsx](./src/components/ChatPanel.jsx)：AI 对话和生成代码。
- [src/components/ProjectEditor.jsx](./src/components/ProjectEditor.jsx)：项目树和源码编辑。
- [src/components/CompilePanel.jsx](./src/components/CompilePanel.jsx)：编译、USB 烧录、WiFi OTA、BLE OTA、下载。
- [src/context/boards](./src/context/boards)：板卡定义和 skill。
- [src/utils/codeGeneration.js](./src/utils/codeGeneration.js)：结构化 AI 生成。
- [src/utils/projectAssembly.js](./src/utils/projectAssembly.js)：系统拥有的 ESP-IDF 工程文件生成。
- [src/utils/projectValidation.js](./src/utils/projectValidation.js)：编译前项目校验。
- [src/utils/compiler.js](./src/utils/compiler.js)：编译服务客户端。
- [src/utils/remoteOta.js](./src/utils/remoteOta.js)：远程 OTA 设备、固件和任务 API。
- [src/utils/usbFlash.js](./src/utils/usbFlash.js)：Web Serial USB 烧录。
- [src/utils/ota.js](./src/utils/ota.js)：HTTP OTA 推送。
- [src/utils/bleOta.js](./src/utils/bleOta.js)：BLE OTA 推送。
- [src/domain/workflow](./src/domain/workflow)：工作流状态和失败分类。
- [src/domain/program](./src/domain/program)：程序 manifest schema 和校验。
- [src/domain/evidence](./src/domain/evidence)：构建证据。

架构说明：

- [CONTEXT.md](./CONTEXT.md)
- [docs/architecture-natural-language-hardware-automation.md](./docs/architecture-natural-language-hardware-automation.md)
- [docs/development-plan.md](./docs/development-plan.md)
- [docs/agent-skill-integration.md](./docs/agent-skill-integration.md)

## 测试

运行当前聚焦测试：

```bash
npm run test:official-examples-backend
npm run test:remote-ota-backend
npm run test:project-validation
npm run test:board-skills
npm run test:code-generation
npm run test:file-placement
npm run test:project-config
npm run test:program-manifest
npm run test:build-evidence
npm run build
```

与 MCU 分层标准相关的重点测试：

- `test:program-manifest`：校验 manifest、driver contract、runtime service、写入边界。
- `test:project-validation`：校验生成源码的 include、skill API 和 contract 禁止项。
- `test:code-generation`：校验结构化 JSON 代码生成解析和 manifest 文件计划。

## 生产化 HTTPS 方案

当前 `trycloudflare.com` 链接适合立即使用和演示。长期稳定生产地址建议改成：

1. Cloudflare Named Tunnel 绑定真实域名。
2. FRP `type = "https"`，并在 frps 开启 `vhostHTTPSPort = 443`。
3. FRP TCP 透传公网 `443` 到家里服务器上的 Caddy/nginx HTTPS 入口。

当前 frps 是 TCP 端口转发为主：

```text
vhostHTTPPort = 0
vhostHTTPSPort = 0
```

所以今天使用 Cloudflare Quick Tunnel 来提供浏览器可信 HTTPS。

## License

See [LICENSE](./LICENSE).
