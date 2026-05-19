
export const audioSkill = {
  id: 'audio',
  label: '音频 (ES8311/ES7210)',
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

### Init (MP3 playback)
\`\`\`c
bsp_i2c_init(); pca9557_init(); bsp_lvgl_start();
bsp_spiffs_mount();
bsp_codec_init();
mp3_player_init();
\`\`\`

### mp3_player_init() pattern
\`\`\`c
player_config.mute_fn    = _audio_player_mute_fn;
player_config.write_fn   = _audio_player_write_fn;
player_config.clk_set_fn = _audio_player_std_clock;
audio_player_new(player_config);
audio_player_callback_register(_audio_player_callback, NULL);
\`\`\`

### pa_en(1) — in PLAYING callback only
\`\`\`c
case AUDIO_PLAYER_CALLBACK_EVENT_PLAYING: pa_en(1); break;
case AUDIO_PLAYER_CALLBACK_EVENT_PAUSE:   pa_en(0); break;
\`\`\`

### ES8311 MCLK
\`\`\`c
#define EXAMPLE_MCLK_MULTIPLE 384  // NOT 256
\`\`\`

### Pitfalls
- ES7210 addr = 0x41 NOT 0x40 — silent failure if wrong
- pa_en(1) in PLAYING callback, not at init
- ES8311 MCLK_MULTIPLE=384 not 256
- MP3 files must be 32000Hz; speech recognition locks I2S to 16kHz
- spiffs_create_partition_image(storage ../spiffs FLASH_IN_PROJECT) in CMakeLists`,
}
