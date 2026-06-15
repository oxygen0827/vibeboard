# ESP32 Cloud Compiler Service
# Base: official ESP-IDF v5.4 image (~3GB, includes xtensa toolchain)
FROM espressif/idf:v5.4

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY=localhost,127.0.0.1,host.docker.internal
ARG http_proxy=${HTTP_PROXY}
ARG https_proxy=${HTTPS_PROXY}
ARG no_proxy=${NO_PROXY}

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}

# Install preview/build deps and Python deps for the API server.
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; fi; \
    if [ -f /etc/apt/sources.list ]; then sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list; fi; \
    apt_opts='-o Acquire::Retries=8 -o Acquire::http::Pipeline-Depth=0 -o Acquire::http::Timeout=90 -o Acquire::https::Timeout=90'; \
    installed=0; \
    for attempt in 1 2 3 4; do \
      apt-get ${apt_opts} update && \
      apt-get ${apt_opts} install -y --fix-missing --no-install-recommends gcc make git ca-certificates && \
      installed=1 && \
      break; \
      echo "apt install failed on attempt ${attempt}, retrying..." >&2; \
      rm -rf /var/lib/apt/lists/*; \
      sleep $((attempt * 5)); \
    done; \
    test "${installed}" = 1; \
    rm -rf /var/lib/apt/lists/* && \
    . /opt/esp/idf/export.sh && python -m pip install flask gunicorn pillow --break-system-packages

WORKDIR /compiler

# Copy project template with the vendored BSP component
COPY template/ ./template/
COPY examples/ ./examples/
COPY ota_receiver/ ./ota_receiver/
COPY ble_ota_receiver/ ./ble_ota_receiver/
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
