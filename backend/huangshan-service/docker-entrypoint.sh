#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "${SIFLI_SDK_PATH}/export.sh" ]; then
  echo "SiFli SDK export.sh not found: ${SIFLI_SDK_PATH}/export.sh" >&2
  echo "Mount hardware/huangshan/sifli-sdk to ${SIFLI_SDK_PATH}." >&2
  exit 1
fi

if [ ! -f "${HUANGSHAN_WORKSPACE}/scripts/build.sh" ]; then
  echo "Huangshan workspace build script not found: ${HUANGSHAN_WORKSPACE}/scripts/build.sh" >&2
  echo "Mount hardware/huangshan/huangshan-pi-sf32-dev to ${HUANGSHAN_WORKSPACE}." >&2
  exit 1
fi

mkdir -p "${SIFLI_SDK_TOOLS_PATH}"

if [ ! -x "${SIFLI_SDK_TOOLS_PATH}/tools/arm-none-eabi-gcc/14.2.1/bin/arm-none-eabi-gcc" ]; then
  echo "Installing Linux SiFli SDK tools into ${SIFLI_SDK_TOOLS_PATH}..."
  "${SIFLI_SDK_PATH}/install.sh"
fi

exec "$@"
