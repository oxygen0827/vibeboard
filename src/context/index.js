import { getBoard } from './boards/index'

const VIBEBOARD_DEBUG_SOURCE = `#include "vibeboard_debug.h"

#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "esp_err.h"
#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#ifndef VIBEBOARD_DEBUG_WIFI_SSID
#define VIBEBOARD_DEBUG_WIFI_SSID "1-306"
#endif

#ifndef VIBEBOARD_DEBUG_WIFI_PASSWORD
#define VIBEBOARD_DEBUG_WIFI_PASSWORD "szyt1008"
#endif

#define VIBEBOARD_DEBUG_WS_PORT 3232
#define VIBEBOARD_DEBUG_MAX_CLIENTS 4
#define VIBEBOARD_DEBUG_LOG_QUEUE_LEN 32
#define VIBEBOARD_DEBUG_LOG_LINE_LEN 256

static const char *TAG = "vibeboard_debug";

typedef struct {
    char text[VIBEBOARD_DEBUG_LOG_LINE_LEN];
} vibeboard_log_msg_t;

static httpd_handle_t s_httpd = NULL;
static QueueHandle_t s_log_queue = NULL;
static vprintf_like_t s_previous_vprintf = NULL;
static int s_ws_clients[VIBEBOARD_DEBUG_MAX_CLIENTS] = { -1, -1, -1, -1 };
static char s_ip_addr[16] = "0.0.0.0";
static bool s_started = false;

static bool debug_ignorable_state_error(esp_err_t err)
{
    if (err == ESP_OK || err == ESP_ERR_INVALID_STATE) {
        return true;
    }
#ifdef ESP_ERR_WIFI_STATE
    if (err == ESP_ERR_WIFI_STATE) {
        return true;
    }
#endif
#ifdef ESP_ERR_WIFI_INIT_STATE
    if (err == ESP_ERR_WIFI_INIT_STATE) {
        return true;
    }
#endif
    return false;
}

static void debug_add_ws_client(int fd)
{
    for (int i = 0; i < VIBEBOARD_DEBUG_MAX_CLIENTS; ++i) {
        if (s_ws_clients[i] == fd) {
            return;
        }
    }
    for (int i = 0; i < VIBEBOARD_DEBUG_MAX_CLIENTS; ++i) {
        if (s_ws_clients[i] < 0) {
            s_ws_clients[i] = fd;
            return;
        }
    }
    s_ws_clients[0] = fd;
}

static void debug_remove_ws_client(int fd)
{
    for (int i = 0; i < VIBEBOARD_DEBUG_MAX_CLIENTS; ++i) {
        if (s_ws_clients[i] == fd) {
            s_ws_clients[i] = -1;
        }
    }
}

static void debug_log_task(void *arg)
{
    (void)arg;
    vibeboard_log_msg_t msg;
    while (true) {
        if (xQueueReceive(s_log_queue, &msg, portMAX_DELAY) != pdTRUE) {
            continue;
        }
        if (!s_httpd) {
            continue;
        }

        httpd_ws_frame_t frame = {
            .final = true,
            .fragmented = false,
            .type = HTTPD_WS_TYPE_TEXT,
            .payload = (uint8_t *)msg.text,
            .len = strlen(msg.text),
        };

        for (int i = 0; i < VIBEBOARD_DEBUG_MAX_CLIENTS; ++i) {
            int fd = s_ws_clients[i];
            if (fd < 0) {
                continue;
            }
            esp_err_t err = httpd_ws_send_frame_async(s_httpd, fd, &frame);
            if (err != ESP_OK) {
                debug_remove_ws_client(fd);
            }
        }
    }
}

static int debug_vprintf(const char *fmt, va_list args)
{
    va_list copy;
    va_copy(copy, args);
    int ret = s_previous_vprintf ? s_previous_vprintf(fmt, args) : vprintf(fmt, args);

    if (s_log_queue) {
        vibeboard_log_msg_t msg = { 0 };
        int len = vsnprintf(msg.text, sizeof(msg.text), fmt, copy);
        if (len > 0) {
            xQueueSend(s_log_queue, &msg, 0);
        }
    }

    va_end(copy);
    return ret;
}

static esp_err_t debug_ping_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/plain");
    return httpd_resp_sendstr(req, "ok");
}

static esp_err_t debug_info_handler(httpd_req_t *req)
{
    char payload[160];
    snprintf(payload, sizeof(payload),
             "{\\"service\\":\\"vibeboard-debug\\",\\"ip\\":\\"%s\\",\\"log\\":\\"ws://%s:%d/log\\"}",
             s_ip_addr, s_ip_addr, VIBEBOARD_DEBUG_WS_PORT);
    httpd_resp_set_type(req, "application/json");
    return httpd_resp_sendstr(req, payload);
}

static esp_err_t debug_log_ws_handler(httpd_req_t *req)
{
    if (req->method == HTTP_GET) {
        int fd = httpd_req_to_sockfd(req);
        debug_add_ws_client(fd);
        return ESP_OK;
    }

    httpd_ws_frame_t frame = { 0 };
    frame.type = HTTPD_WS_TYPE_TEXT;
    return httpd_ws_recv_frame(req, &frame, 0);
}

static void debug_start_httpd(void)
{
    if (s_httpd) {
        return;
    }

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = VIBEBOARD_DEBUG_WS_PORT;
    config.ctrl_port = VIBEBOARD_DEBUG_WS_PORT + 1;
    config.lru_purge_enable = true;

    esp_err_t err = httpd_start(&s_httpd, &config);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "WiFi log server start failed: %s", esp_err_to_name(err));
        s_httpd = NULL;
        return;
    }

    const httpd_uri_t ping_uri = {
        .uri = "/ping",
        .method = HTTP_GET,
        .handler = debug_ping_handler,
        .user_ctx = NULL,
    };
    const httpd_uri_t info_uri = {
        .uri = "/info",
        .method = HTTP_GET,
        .handler = debug_info_handler,
        .user_ctx = NULL,
    };
    const httpd_uri_t log_uri = {
        .uri = "/log",
        .method = HTTP_GET,
        .handler = debug_log_ws_handler,
        .user_ctx = NULL,
        .is_websocket = true,
    };

    httpd_register_uri_handler(s_httpd, &ping_uri);
    httpd_register_uri_handler(s_httpd, &info_uri);
    httpd_register_uri_handler(s_httpd, &log_uri);
    ESP_LOGI(TAG, "WiFi log server ready: ws://%s:%d/log", s_ip_addr, VIBEBOARD_DEBUG_WS_PORT);
}

static void debug_wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    (void)event_data;

    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "WiFi debug disconnected, reconnecting");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        snprintf(s_ip_addr, sizeof(s_ip_addr), IPSTR, IP2STR(&event->ip_info.ip));
        ESP_LOGI(TAG, "WiFi debug IP: %s", s_ip_addr);
        debug_start_httpd();
    }
}

static esp_err_t debug_init_nvs(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    return err;
}

esp_err_t vibeboard_debug_start(void)
{
    if (s_started) {
        return ESP_OK;
    }
    s_started = true;

    s_log_queue = xQueueCreate(VIBEBOARD_DEBUG_LOG_QUEUE_LEN, sizeof(vibeboard_log_msg_t));
    if (s_log_queue) {
        xTaskCreate(debug_log_task, "vb_dbg_log", 4096, NULL, 4, NULL);
        s_previous_vprintf = esp_log_set_vprintf(debug_vprintf);
    }

    esp_err_t err = debug_init_nvs();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "NVS init failed, WiFi debug disabled: %s", esp_err_to_name(err));
        return ESP_OK;
    }

    err = esp_netif_init();
    if (!debug_ignorable_state_error(err)) {
        ESP_LOGW(TAG, "esp_netif_init failed, WiFi debug disabled: %s", esp_err_to_name(err));
        return ESP_OK;
    }

    err = esp_event_loop_create_default();
    if (!debug_ignorable_state_error(err)) {
        ESP_LOGW(TAG, "event loop init failed, WiFi debug disabled: %s", esp_err_to_name(err));
        return ESP_OK;
    }

    esp_netif_create_default_wifi_sta();

    wifi_init_config_t wifi_init = WIFI_INIT_CONFIG_DEFAULT();
    err = esp_wifi_init(&wifi_init);
    if (!debug_ignorable_state_error(err)) {
        ESP_LOGW(TAG, "esp_wifi_init failed, WiFi debug disabled: %s", esp_err_to_name(err));
        return ESP_OK;
    }

    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, debug_wifi_event_handler, NULL, NULL);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, debug_wifi_event_handler, NULL, NULL);

    wifi_config_t wifi_config = { 0 };
    strncpy((char *)wifi_config.sta.ssid, VIBEBOARD_DEBUG_WIFI_SSID, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, VIBEBOARD_DEBUG_WIFI_PASSWORD, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.sae_pwe_h2e = WPA3_SAE_PWE_BOTH;

    esp_wifi_set_storage(WIFI_STORAGE_RAM);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);

    err = esp_wifi_start();
    if (!debug_ignorable_state_error(err)) {
        ESP_LOGW(TAG, "esp_wifi_start failed, WiFi debug disabled: %s", esp_err_to_name(err));
        return ESP_OK;
    }

    debug_start_httpd();
    ESP_LOGI(TAG, "WiFi debug enabled on ssid=%s; USB serial logs remain active", VIBEBOARD_DEBUG_WIFI_SSID);
    return ESP_OK;
}
`

const VIBEBOARD_DEBUG_HEADER = `#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t vibeboard_debug_start(void);

#ifdef __cplusplus
}
#endif
`

const VIBEBOARD_DEBUG_CONFIG = {
  systemSrcs: ['vibeboard_debug.c'],
  idfRequires: ['esp_event', 'esp_http_server', 'esp_netif', 'esp_wifi', 'nvs_flash'],
  sdkconfig: [
    'CONFIG_PARTITION_TABLE_CUSTOM=y',
    'CONFIG_HTTPD_WS_SUPPORT=y',
    'CONFIG_HTTPD_MAX_REQ_HDR_LEN=4096',
    'CONFIG_HTTPD_MAX_URI_LEN=1024',
  ],
  partitions: [
    '# Name,   Type, SubType, Offset,  Size, Flags',
    'nvs,      data, nvs,     0x9000,  0x6000,',
    'phy_init, data, phy,     ,        0x1000,',
    'factory,  app,  factory, ,        7M,',
  ],
  files: {
    'main/vibeboard_debug.c': VIBEBOARD_DEBUG_SOURCE,
    'main/vibeboard_debug.h': VIBEBOARD_DEBUG_HEADER,
  },
}

const SKILL_CONFIG_REQUIREMENTS = {
  audio: ['lvgl'],
  wifi: ['lvgl'],
  ble: ['lvgl'],
  speech: ['audio', 'lvgl'],
  vision: ['camera'],
}

export function expandSelectedSkillIds(board, selectedSkillIds = []) {
  const valid = new Set((board?.skills || []).map(skill => skill.id))
  const expanded = new Set((selectedSkillIds || []).filter(id => valid.has(id)))

  let changed = true
  while (changed) {
    changed = false
    for (const [skillId, requiredSkillIds] of Object.entries(SKILL_CONFIG_REQUIREMENTS)) {
      if (!expanded.has(skillId)) continue
      for (const requiredSkillId of requiredSkillIds) {
        if (valid.has(requiredSkillId) && !expanded.has(requiredSkillId)) {
          expanded.add(requiredSkillId)
          changed = true
        }
      }
    }
  }

  return [...expanded]
}

export function buildSystemPrompt(boardId, selectedSkillIds = []) {
  const board = getBoard(boardId)
  if (!board) throw new Error(`Unknown board: ${boardId}`)
  const effectiveSkillIds = expandSelectedSkillIds(board, selectedSkillIds)

  const skillPrompts = board.skills
    .filter(s => effectiveSkillIds.includes(s.id))
    .map(s => s.systemPrompt)
    .filter(Boolean)
    .join('\n\n')

  return skillPrompts ? `${board.basePrompt}\n\n${skillPrompts}` : board.basePrompt
}

export function buildProjectFiles(boardId, projectName, selectedSkillIds = []) {
  const board = getBoard(boardId)
  if (!board) throw new Error(`Unknown board: ${boardId}`)
  const effectiveSkillIds = expandSelectedSkillIds(board, selectedSkillIds)

  const skills = board.skills.filter(s => effectiveSkillIds.includes(s.id))
  const configs = [
    ...defaultProjectConfigsForBoard(board),
    ...skills.map(s => s.projectConfig).filter(Boolean),
  ]

  const needsCpp = configs.some(c => c.mainExt === 'cpp')
  const mainFile = needsCpp ? 'main.cpp' : 'main.c'
  const srcs = [mainFile, ...new Set(configs.flatMap(c => c.systemSrcs || []))]

  const sdkBase = [
    '# Generated by VibeBoard',
    `CONFIG_IDF_TARGET="${board.idfTarget || 'esp32s3'}"`,
  ]
  const flashSize = board.flashSize || '16MB'
  if (flashSize.endsWith('MB')) {
    sdkBase.push(`CONFIG_ESPTOOLPY_FLASHSIZE_${flashSize}=y`)
  }
  const sdkExtra = [...new Set(configs.flatMap(c => c.sdkconfig || []))]
  const sdkconfig = [...sdkBase, ...sdkExtra].join('\n')

  const components = [...new Set(configs.flatMap(c => c.idfComponents || []))]
  const idfRequires = [...new Set(configs.flatMap(c => c.idfRequires || []))]
  const cmakeRequires = ['esp32_s3_szp', ...idfRequires, ...components.map(componentToRequireName)]
  const idfComponentYml = components.length > 0
    ? `# IDF Component Manager Manifest File\ndependencies:\n` +
      components.map(c => `  ${c}`).join('\n') +
      `\n  idf:\n    version: ">=5.0"`
    : null

  const allPartitions = configs.map(c => c.partitions).filter(Boolean)
  const partitionsCsv = allPartitions.length > 0
    ? mergePartitions(allPartitions).join('\n')
    : null

  const needsSpiffs = configs.some(c => c.spiffs)
  const compileOpts = [...new Set(configs.flatMap(c => c.compileOptions || []))]

  const srcList = srcs.map(s => `"${s}"`).join('\n                    ')
  let mainCmake = `idf_component_register(SRCS ${srcList}\n                    INCLUDE_DIRS ".")`
  if (cmakeRequires.length > 0) {
    mainCmake = `idf_component_register(SRCS ${srcList}\n                    INCLUDE_DIRS "."\n                    REQUIRES ${cmakeRequires.join(' ')})`
  }
  if (needsSpiffs) {
    mainCmake += `\n\nspiffs_create_partition_image(storage ../spiffs FLASH_IN_PROJECT)`
  }
  if (compileOpts.length > 0) {
    mainCmake += `\ntarget_compile_options(\${COMPONENT_LIB} PRIVATE ${compileOpts.join(' ')})`
  }

  const files = {
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(${projectName})`,
    'main/CMakeLists.txt': mainCmake,
    'sdkconfig.defaults': sdkconfig,
    '__mainFile': mainFile,
    '__idfTarget': board.idfTarget || 'esp32s3',
    '__selectedSkills': effectiveSkillIds,
    ...defaultProjectFilesForBoard(board),
  }
  if (idfComponentYml) files['main/idf_component.yml'] = idfComponentYml
  if (partitionsCsv) files['partitions.csv'] = partitionsCsv

  return files
}

function defaultProjectConfigsForBoard(board) {
  const configs = []
  if (board?.projectConfig) configs.push(board.projectConfig)
  if (board?.id === 'szpi_esp32s3') configs.push(VIBEBOARD_DEBUG_CONFIG)
  return configs
}

function defaultProjectFilesForBoard(board) {
  if (board?.id === 'szpi_esp32s3') return VIBEBOARD_DEBUG_CONFIG.files
  return {}
}

function componentToRequireName(component) {
  return String(component)
    .split(':')[0]
    .trim()
    .split('/')
    .pop()
}

function mergePartitions(partitionSets) {
  const header = '# Name,   Type, SubType, Offset,  Size, Flags'
  const byName = new Map()

  for (const lines of partitionSets) {
    for (const line of lines) {
      const trimmed = String(line).trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const parts = trimmed.split(',').map(part => part.trim())
      const name = parts[0]
      if (!name) continue
      const current = byName.get(name)
      if (!current || partitionSizeBytes(parts[4]) > partitionSizeBytes(current.parts[4])) {
        byName.set(name, { original: trimmed, parts })
      }
    }
  }

  const preferredOrder = ['nvs', 'phy_init', 'factory', 'storage', 'model']
  const lines = [header]
  for (const name of preferredOrder) {
    if (byName.has(name)) lines.push(byName.get(name).original)
  }
  for (const [name, entry] of byName.entries()) {
    if (!preferredOrder.includes(name)) lines.push(entry.original)
  }
  return lines
}

function partitionSizeBytes(size) {
  const value = String(size || '').trim().toLowerCase()
  const match = value.match(/^(\d+)(k|m|kb|mb)?$/)
  if (!match) return 0
  const n = parseInt(match[1], 10)
  const unit = match[2] || ''
  if (unit.startsWith('m')) return n * 1024 * 1024
  if (unit.startsWith('k')) return n * 1024
  return n
}

export function patchSkill(boardId, skillId, type, content) {
  const board = getBoard(boardId)
  if (!board) return null

  const skill = board.skills.find(s => s.id === skillId)
  if (!skill) return null

  const section = type === 'pitfall' ? '### Pitfalls' : '### Usage'
  const entry = `- ${content}`
  if (skill.systemPrompt && skill.systemPrompt.includes(section)) {
    skill.systemPrompt = skill.systemPrompt.replace(section, `${section}\n${entry}`)
  } else {
    skill.systemPrompt = (skill.systemPrompt || '') + `\n\n${section}\n${entry}`
  }
  return skill
}
