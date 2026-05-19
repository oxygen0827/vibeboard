# PlatformIO Cloud Compiler Service
# Supports: Arduino (nRF52840) + STM32Cube (STM32F103C8)
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl && \
    rm -rf /var/lib/apt/lists/*

# Install PlatformIO core + Flask server dependencies
RUN pip install --no-cache-dir platformio flask gunicorn

# Pre-install platform packages (toolchains + frameworks) so first build is fast.
# nordicnrf52: arm-gcc toolchain + Seeeduino nRF52 Arduino core
# ststm32    : arm-gcc toolchain + STM32Cube HAL
RUN pio pkg install -g --platform nordicnrf52 && \
    pio pkg install -g --platform ststm32

# Warmup: compile a minimal sketch for each board to fully populate the cache
# (pio downloads missing toolchain packages on first compile, not pkg install)
RUN mkdir -p /tmp/warmup/nrf52/src && \
    printf '[env:target]\nplatform=nordicnrf52\nframework=arduino\nboard=seeed_xiao_nrf52840_sense\n' \
        > /tmp/warmup/nrf52/platformio.ini && \
    printf 'void setup(){}\nvoid loop(){}\n' \
        > /tmp/warmup/nrf52/src/main.cpp && \
    pio run -d /tmp/warmup/nrf52 2>&1 | tail -5 || true

RUN mkdir -p /tmp/warmup/stm32/src && \
    printf '[env:target]\nplatform=ststm32\nframework=stm32cube\nboard=bluepill_f103c8\n' \
        > /tmp/warmup/stm32/platformio.ini && \
    printf '#include "stm32f1xx_hal.h"\nint main(void){ HAL_Init(); while(1){} }\n' \
        > /tmp/warmup/stm32/src/main.c && \
    pio run -d /tmp/warmup/stm32 2>&1 | tail -5 || true

RUN rm -rf /tmp/warmup

WORKDIR /compiler
COPY server.py .

EXPOSE 8761

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8761", "--timeout", "300", "server:app"]
