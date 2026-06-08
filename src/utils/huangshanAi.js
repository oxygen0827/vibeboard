import { createHuangshanAiBuilderMessages, extractHuangshanBuilderConfigFromAiText } from '../domain/huangshan/aiBuilder'
import { completeChat } from './aiApi'

export async function generateHuangshanBuilderConfig({
  settings,
  userPrompt,
  displayName,
  description,
}) {
  if (!settings?.baseUrl || !settings?.apiKey || !settings?.model) {
    throw new Error('请先配置 AI API。')
  }

  const messages = createHuangshanAiBuilderMessages({ userPrompt, displayName, description })
  const rawText = await completeChat({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages,
  })

  return {
    rawText,
    config: extractHuangshanBuilderConfigFromAiText(rawText, { displayName, description }),
  }
}
