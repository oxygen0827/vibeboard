# ESP32 Cloud Compiler Service
# Base: official ESP-IDF v5.4 image (~3GB, includes xtensa toolchain)
FROM espressif/idf:v5.4

# Install Python deps for the API server
RUN . /opt/esp/idf/export.sh && python -m pip install flask gunicorn --break-system-packages

WORKDIR /compiler

# Copy project template with the vendored BSP component
COPY template/ ./template/

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

