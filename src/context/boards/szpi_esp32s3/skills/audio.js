
export const audioSkill = {
  id: 'audio',
  label: '音频 (ES8311/ES7210)',
  driverContractIds: ['audio.codec-playback', 'audio.mic-feed'],
  projectConfig: {
    srcs: [],
    sdkconfig: [
      'CONFIG_SPIRAM=y',
      'CONFIG_SPIRAM_MODE_OCT=y',
      'CONFIG_SPIRAM_SPEED_80M=y',
      'CONFIG_ESP_DEFAULT_CPU_FREQ_MHZ_240=y',
      'CONFIG_ESP32S3_INSTRUCTION_CACHE_32KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_64KB=y',
      'CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y',
      'CONFIG_LV_COLOR_16_SWAP=y',
      'CONFIG_LV_MEM_CUSTOM=y',
      'CONFIG_LV_FONT_MONTSERRAT_20=y',
      'CONFIG_LV_FONT_MONTSERRAT_24=y',
      'CONFIG_LV_FONT_MONTSERRAT_32=y',
      'CONFIG_SPIFFS_OBJ_NAME_LEN=128',
      'CONFIG_PARTITION_TABLE_CUSTOM=y',
    ],
    idfComponents: [
      'lvgl/lvgl: "~8.3.0"',
      'espressif/esp_lvgl_port: "~1.4.0"',
      'espressif/esp_lcd_touch_ft5x06: "~1.0.6"',
      'chmorgan/esp-audio-player: "~1.0.7"',
      'chmorgan/esp-file-iterator: "1.0.0"',
      'espressif/esp_codec_dev: "~1.3.0"',
    ],
    partitions: [
      '# Name,   Type, SubType, Offset,  Size, Flags',
      'nvs,      data, nvs,     0x9000,  24k',
      'phy_init, data, phy,     0xf000,  4k',
      'factory,  app,  factory, ,        3M',
      'storage,  data, spiffs,  ,        3M,',
    ],
    spiffs: true,
  },
  systemPrompt: `## Audio — ES8311 (DAC/Speaker) + ES7210 (ADC/4-Mic)

### Addresses
- ES8311: I2C 0x18,  ES7210: I2C 0x41 (NOT 0x40)
- ES8311 is output-only on this board. ES7210 is input-only.
- ES7210 MIC1/MIC2 capture human voice; MIC3 is wired to ES8311 output for echo reference.

### Init (MP3 playback)
\`\`\`c
ESP_ERROR_CHECK(bsp_i2c_init()); ESP_ERROR_CHECK(pca9557_init()); ESP_ERROR_CHECK(bsp_lvgl_start());
bsp_spiffs_mount();
bsp_codec_init();
mp3_player_init();
\`\`\`

### mp3_player_init() pattern
Use unique static callback function names. Do NOT define functions named \`audio_player_mute_fn\`, \`audio_player_write_fn\`, or \`audio_player_std_clock\`; those can collide with esp-audio-player symbols.
\`\`\`c
static esp_err_t _vibeboard_audio_mute_cb(AUDIO_PLAYER_MUTE_SETTING setting) { ... }
static esp_err_t _vibeboard_audio_write_cb(void *audio_buffer, size_t len, size_t *bytes_written, uint32_t timeout_ms) { return bsp_i2s_write(audio_buffer, len, bytes_written, timeout_ms); }
static esp_err_t _vibeboard_audio_clock_cb(uint32_t rate, uint32_t bits_cfg, i2s_slot_mode_t ch) { return bsp_codec_set_fs(rate, bits_cfg, ch); }

player_config.mute_fn    = _vibeboard_audio_mute_cb;
player_config.write_fn   = _vibeboard_audio_write_cb;
player_config.clk_set_fn = _vibeboard_audio_clock_cb;
audio_player_new(player_config);
audio_player_callback_register(_audio_player_callback, NULL);
\`\`\`

Include \`esp_check.h\` if using \`ESP_RETURN_ON_ERROR\`, \`ESP_GOTO_ON_ERROR\`, or \`ESP_RETURN_ON_FALSE\`.

### pa_en(1) — in PLAYING callback only
\`\`\`c
case AUDIO_PLAYER_CALLBACK_EVENT_PLAYING: pa_en(1); break;
case AUDIO_PLAYER_CALLBACK_EVENT_PAUSE:   pa_en(0); break;
\`\`\`

### ES8311 MCLK
\`\`\`c
#define EXAMPLE_MCLK_MULTIPLE 384  // NOT 256
\`\`\`

### ES8311 output contract
- I2S STD mode, 16000 Hz for tutorial PCM examples.
- Pins: MCLK=GPIO38, BCLK=GPIO14, WS=GPIO13, DOUT=GPIO45, DIN=-1 for output-only examples.
- PA_EN is PCA9557 P1. Use pa_en(1) only while actively playing and pa_en(0) on pause/idle.

### ES7210 input contract
- I2S TDM mode, 48000 Hz, 16-bit, I2S_MCLK_MULTIPLE_256.
- Pins: MCLK=GPIO38, BCLK=GPIO14, WS=GPIO13, DIN=GPIO12, DOUT=-1 for input-only examples.
- Board voice capture uses MIC1/MIC2: TDM slot mask should be SLOT0 | SLOT1, channel count 2.
- SD recording examples use 1-bit SDMMC: CLK=GPIO47, CMD=GPIO48, D0=GPIO21, mount /sdcard.

### Pitfalls
- ES7210 addr = 0x41 NOT 0x40 — silent failure if wrong
- pa_en(1) in PLAYING callback, not at init
- ES8311 MCLK_MULTIPLE=384 not 256
- MP3 files must be 32000Hz; speech recognition locks I2S to 16kHz
- Use bsp_i2s_write(), bsp_codec_set_fs(), bsp_codec_mute_set(), and bsp_codec_volume_set() from esp32_s3_szp.h instead of inventing raw I2S helpers
- Do not initialize a second I2C bus for ES8311/ES7210; use shared BSP_I2C_NUM after bsp_i2c_init()
- spiffs_create_partition_image(storage ../spiffs FLASH_IN_PROJECT) in CMakeLists`,
}
