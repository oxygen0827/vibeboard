// Centralized AI provider defaults.
//
// SECURITY: No credentials are ever hardcoded in source. Default connection
// settings are injected at build time through Vite environment variables
// (see .env.example). If no env values are provided, the app starts with an
// empty key and prompts the user to configure a provider in Settings.
//
// Recommended deployment: instead of shipping a real provider key to the
// browser, point VITE_DEFAULT_BASE_URL at your own lightweight proxy endpoint
// that injects the upstream key server-side. The browser then never holds a
// real upstream credential.

import { providerKeyForBaseUrl } from '../utils/aiApi'

function readEnv(name) {
  // import.meta.env is statically replaced by Vite at build time.
  const value = import.meta.env?.[name]
  return typeof value === 'string' ? value.trim() : ''
}

const ENV_BASE_URL = readEnv('VITE_DEFAULT_BASE_URL')
const ENV_API_KEY = readEnv('VITE_DEFAULT_API_KEY')
const ENV_MODEL = readEnv('VITE_DEFAULT_MODEL')

// Hardcoded, credential-free fallbacks so a fresh checkout still boots with a
// sensible base URL and model. The user supplies the key in Settings.
const FALLBACK_BASE_URL = 'https://api.openai.com/v1'
const FALLBACK_MODEL = 'gpt-4o'

export const DEFAULT_BASE_URL = ENV_BASE_URL || FALLBACK_BASE_URL
export const DEFAULT_MODEL = ENV_MODEL || FALLBACK_MODEL
export const DEFAULT_API_KEY = ENV_API_KEY || ''

// True when the deployment shipped a default key via env (open-out-of-the-box).
export const HAS_BUNDLED_KEY = Boolean(DEFAULT_API_KEY)

export function buildDefaultSettings() {
  const providerKeys = {}
  if (DEFAULT_API_KEY) {
    providerKeys[providerKeyForBaseUrl(DEFAULT_BASE_URL)] = DEFAULT_API_KEY
  }
  return {
    baseUrl: DEFAULT_BASE_URL,
    apiKey: DEFAULT_API_KEY,
    model: DEFAULT_MODEL,
    providerKeys,
  }
}
