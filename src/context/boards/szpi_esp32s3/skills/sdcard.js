
export const sdcardSkill = {
  id: 'sdcard',
  label: '存储 (SD卡/SPIFFS)',
  projectConfig: {
    srcs: [],
    sdkconfig: [
      'CONFIG_FATFS_LFN_HEAP=y',
      'CONFIG_FATFS_CODEPAGE_936=y',
      'CONFIG_FATFS_API_ENCODING_UTF_8=y',
      'CONFIG_FATFS_VFS_FSTAT_BLKSIZE=4096',
    ],
    idfComponents: [],
    partitions: null,
    spiffs: false,
  },
  systemPrompt: `## Storage

### SD Card (SDMMC 1-bit)
\`\`\`c
// Pins: CLK=GPIO47, CMD=GPIO48, D0=GPIO21
sdmmc_host_t host = SDMMC_HOST_DEFAULT();
sdmmc_slot_config_t slot = SDMMC_SLOT_CONFIG_DEFAULT();
slot.width = 1;
slot.clk = 47; slot.cmd = 48; slot.d0 = 21;
slot.flags |= SDMMC_SLOT_FLAG_INTERNAL_PULLUP;
esp_vfs_fat_sdmmc_mount_config_t cfg = {
    .format_if_mount_failed = true,
    .max_files = 5,
    .allocation_unit_size = 16 * 1024,
};
sdmmc_card_t *card;
esp_vfs_fat_sdmmc_mount("/sdcard", &host, &slot, &cfg, &card);
\`\`\`

### SPIFFS
\`\`\`c
bsp_spiffs_mount(); // mounts at /spiffs, partition label "storage"
\`\`\`

### Pitfalls
- SD card 1-bit mode (slot.width=1), NOT 4-bit
- SDMMC_SLOT_FLAG_INTERNAL_PULLUP required
- SPIFFS partition label must be "storage" in partitions.csv
- SD=/sdcard, SPIFFS=/spiffs`,
}
