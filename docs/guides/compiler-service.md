# Compiler Service

The ESP-IDF compiler service lives in:

```text
backend/compiler-service
```

It builds generated projects, official examples, WiFi OTA receiver firmware,
and BLE OTA receiver firmware.

## Local Docker Run

```bash
cd backend/compiler-service
docker compose up -d --build
```

For one-off runs without Compose, mount the state directories explicitly:

```bash
docker build -t esp32-compiler .
docker run -d --name esp32-compiler -p 8760:8760 \
  -e BUILD_BASE=/tmp/builds \
  -e REMOTE_OTA_DIR=/tmp/vibeboard-remote-ota \
  -v "$PWD/.compiler-build-cache:/tmp/builds" \
  -v "$PWD/.remote-ota-state:/tmp/vibeboard-remote-ota" \
  esp32-compiler
```

Mount build cache and remote OTA state to host paths so container recreation
does not erase useful artifacts.

Important state paths:

```text
/tmp/builds
/tmp/vibeboard-remote-ota
```

The local Compose defaults are:

```text
backend/compiler-service/.compiler-build-cache -> /tmp/builds
backend/compiler-service/.remote-ota-state     -> /tmp/vibeboard-remote-ota
```

The deploy Compose defaults are:

```text
/home/wq/vibeboard-build-cache -> /tmp/builds
/home/wq/vibeboard-remote-ota  -> /tmp/vibeboard-remote-ota
```

Both can be overridden:

```bash
VIBEBOARD_BUILD_CACHE=/data/vibeboard/builds \
VIBEBOARD_REMOTE_OTA_STATE=/data/vibeboard/remote-ota \
docker compose up -d
```

## API Surface

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health check. |
| `GET /examples` | List official examples available in the container. |
| `POST /compile` | Compile the current assembled project. |
| `POST /compile-example` | Compile an official example without AI rewriting. |
| `POST /compile-ota-receiver` | Compile WiFi OTA receiver firmware. |
| `POST /api/devices/heartbeat` | Device heartbeat and registration. |
| `GET /api/devices` | Remote OTA device list. |
| `POST /api/firmware` | Register/upload remote OTA firmware. |
| `GET /api/firmware/<firmwareId>/download` | Device firmware download. |
| `POST /api/ota-jobs` | Create a remote OTA job. |
| `GET /api/devices/<deviceId>/ota-job` | Device polls for a job. |
| `POST /api/ota-jobs/<jobId>/status` | Device reports OTA job status. |

Build results stream over Server-Sent Events. Successful builds return the app
binary and, when available, `flashFiles` for browser USB full flashing.

## Security Boundary

The compiler service treats these as system-owned project files:

```text
CMakeLists.txt
main/CMakeLists.txt
main/idf_component.yml
sdkconfig.defaults
sdkconfig
partitions.csv
```

Client-submitted build files are rejected or ignored. The service generates
trusted build configuration from the selected board skills.

Regression test:

```bash
npm run test:compiler-security
```

## Official Examples

Official examples are compiled from the examples directory inside the compiler
container and are not rewritten by AI. Frontend metadata lives in:

```text
src/data/officialExamples.js
```
