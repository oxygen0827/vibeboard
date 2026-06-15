export const HUANGSHAN_REPO_LOCAL_ROOT = 'hardware/huangshan'
export const HUANGSHAN_HOME_WORKSPACE_ROOT = 'huangshan-pi-workspace'

export const HUANGSHAN_SOURCE_DIR_NAMES = {
  workspace: 'huangshan-pi-sf32-dev',
  sdk: 'sifli-sdk',
  examples: 'lckfb-hspi-ulp_example',
}

export const HUANGSHAN_ENV_VARS = {
  workspace: 'HUANGSHAN_WORKSPACE',
  sdk: 'SIFLI_SDK_PATH',
  examples: 'HUANGSHAN_EXAMPLES_PATH',
}

export const HUANGSHAN_REPO_SOURCE_PATHS = {
  workspace: `${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.workspace}`,
  sdk: `${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.sdk}`,
  examples: `${HUANGSHAN_REPO_LOCAL_ROOT}/${HUANGSHAN_SOURCE_DIR_NAMES.examples}`,
}

export function createHuangshanSourcePaths(env = {}) {
  return {
    workspace: env?.[HUANGSHAN_ENV_VARS.workspace] || HUANGSHAN_REPO_SOURCE_PATHS.workspace,
    sdk: env?.[HUANGSHAN_ENV_VARS.sdk] || HUANGSHAN_REPO_SOURCE_PATHS.sdk,
    examples: env?.[HUANGSHAN_ENV_VARS.examples] || HUANGSHAN_REPO_SOURCE_PATHS.examples,
  }
}
