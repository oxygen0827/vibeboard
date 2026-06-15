FROM node:20-bookworm-slim

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY=localhost,127.0.0.1,host.docker.internal
ARG http_proxy=${HTTP_PROXY}
ARG https_proxy=${HTTPS_PROXY}
ARG no_proxy=${NO_PROXY}

ENV DEBIAN_FRONTEND=noninteractive
ENV HUANGSHAN_WORKSPACE=/workspaces/huangshan-pi-sf32-dev
ENV SIFLI_SDK_PATH=/opt/sifli-sdk
ENV SIFLI_SDK_TOOLS_PATH=/opt/sifli-tools
ENV HUANGSHAN_SERVICE_HOST=0.0.0.0
ENV HUANGSHAN_SERVICE_PORT=8771
ENV HUANGSHAN_BUILD_JOBS=4
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV http_proxy=${http_proxy}
ENV https_proxy=${https_proxy}
ENV no_proxy=${no_proxy}

RUN set -eux; \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    apt_opts='-o Acquire::Retries=8 -o Acquire::http::Pipeline-Depth=0 -o Acquire::http::Timeout=90 -o Acquire::https::Timeout=90'; \
    installed=0; \
    for attempt in 1 2 3 4; do \
      apt-get ${apt_opts} update && \
      apt-get ${apt_opts} install -y --fix-missing --no-install-recommends \
        bash \
        ca-certificates \
        gcc \
        git \
        libc6-dev \
        make \
        python3 \
        python3-venv \
        xz-utils && \
      installed=1 && \
      break; \
      echo "apt install failed on attempt ${attempt}, retrying..." >&2; \
      rm -rf /var/lib/apt/lists/*; \
      sleep $((attempt * 5)); \
    done; \
    test "${installed}" = 1; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/huangshan-service/ ./backend/huangshan-service/
COPY backend/compiler-service/preview_runner/ ./backend/compiler-service/preview_runner/
COPY src/domain/huangshan/ ./src/domain/huangshan/

COPY backend/huangshan-service/docker-entrypoint.sh /usr/local/bin/huangshan-entrypoint
RUN chmod +x /usr/local/bin/huangshan-entrypoint && \
    mkdir -p /workspaces /opt/sifli-tools

EXPOSE 8771

ENTRYPOINT ["huangshan-entrypoint"]
CMD ["node", "backend/huangshan-service/server.mjs"]
