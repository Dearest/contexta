import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { Provider, Paragraph, ArticleMetadata, TranslationPreset } from './types'
import { buildSystemPrompt, buildUserPrompt, buildSummaryPrompt, buildQuotesPrompt } from './prompts'
import { BUILTIN_PRESETS } from './constants'

interface TranslateOptions {
  provider: Provider
  modelId: string
  paragraph: Paragraph
  metadata: ArticleMetadata
  targetLang: string
  preset: TranslationPreset
}

function createProvider(provider: Provider) {
  return createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl.replace(/\/$/, ''),
    apiKey: provider.apiKey,
  })
}

export async function translateParagraph(options: TranslateOptions): Promise<string> {
  const { provider, modelId, paragraph, metadata, targetLang, preset } = options

  const llm = createProvider(provider)
  const systemPrompt = buildSystemPrompt(targetLang, preset.rules)
  const userPrompt = buildUserPrompt({
    title: metadata.title,
    current: paragraph.text,
    prev: paragraph.prev,
    next: paragraph.next,
  })

  const { text } = await generateText({
    model: llm(modelId),
    system: systemPrompt,
    prompt: userPrompt,
  })

  return text.trim()
}

export async function generateSummary(
  provider: Provider,
  modelId: string,
  translatedContent: string,
): Promise<string> {
  const llm = createProvider(provider)
  const { text } = await generateText({
    model: llm(modelId),
    prompt: buildSummaryPrompt(translatedContent),
  })
  return text.trim()
}

export async function generateQuotes(
  provider: Provider,
  modelId: string,
  translatedContent: string,
): Promise<string> {
  const llm = createProvider(provider)
  const { text } = await generateText({
    model: llm(modelId),
    prompt: buildQuotesPrompt(translatedContent),
  })
  return text.trim()
}

export function resolvePreset(
  presetId: string,
  customPresets: TranslationPreset[],
): TranslationPreset {
  const all = [...BUILTIN_PRESETS, ...customPresets]
  return all.find((p) => p.id === presetId) ?? BUILTIN_PRESETS[0]
}
