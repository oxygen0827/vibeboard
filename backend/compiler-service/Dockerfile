# ESP32 Cloud Compiler Service
# Base: official ESP-IDF v5.4 image (~3GB, includes xtensa toolchain)
FROM espressif/idf:v5.4

# Install preview/build deps and Python deps for the API server.
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc make git ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    . /opt/esp/idf/export.sh && python -m pip install flask gunicorn pillow --break-system-packages

WORKDIR /compiler

# Copy project template with the vendored BSP component
COPY template/ ./template/
COPY examples/ ./examples/
COPY ota_receiver/ ./ota_receiver/
COPY preview_runner/ ./preview_runner/

# Vendored-at-build LVGL 8.3 source for the headless preview runner.
RUN git clone --depth 1 --branch v8.3.11 https://github.com/lvgl/lvgl.git /compiler/lvgl-8.3

# Pre-warm the cmake/component cache so first user build is faster.
RUN cd /tmp && \
    cp -r /compiler/template warmup && \
    . /opt/esp/idf/export.sh && \
    idf.py -C warmup -B warmup/build reconfigure 2>&1 | tail -20 || true && \
    rm -rf /tmp/warmup

# Copy API server
COPY server.py .

EXPOSE 8760

ENTRYPOINT ["/bin/bash", "-c", \
    "source /opt/esp/idf/export.sh && gunicorn -w 2 -b 0.0.0.0:8760 --timeout 180 server:app"]

