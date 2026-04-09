import { onMessage, sendToTab } from '@/lib/messages'
import { getStorage } from '@/lib/storage'
import { translateParagraph, generateSummary, generateQuotes, resolvePreset } from '@/lib/translator'
import { resolveActiveProvider, fetchModels } from '@/lib/providers'
import type { Message, ExtractedArticle } from '@/lib/types'
import { buildObsidianMarkdown, exportToObsidian } from '@/lib/obsidian'

// Store translation results for export
let lastArticle: ExtractedArticle | null = null
let lastTranslations: Map<string, string> = new Map()

export default defineBackground(() => {
  onMessage(async (message, sender) => {
    switch (message.action) {
      case 'translate':
        return handleTranslate(message)
      case 'extract-result':
        return handleExtractResult(message, sender)
      case 'fetch-models':
        return handleFetchModels(message)
      case 'export-obsidian':
        return handleExport(message)
      case 'retry-paragraph':
        return handleRetry(message, sender)
    }
  })
})

async function handleTranslate(
  message: Extract<Message, { action: 'translate' }>,
) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  // Store settings for translation
  await chrome.storage.local.set({
    _pendingTranslation: {
      mode: message.mode,
      targetLang: message.targetLang,
      presetId: message.presetId,
      tabId: tab.id,
    },
  })

  // Clear previous translations on the page
  await sendToTab(tab.id, { action: 'clear-translations' })

  // Ask content script to extract
  await sendToTab(tab.id, { action: 'extract' })
}

async function handleExtractResult(
  message: Extract<Message, { action: 'extract-result' }>,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (!tabId) return

  const pending = (await chrome.storage.local.get('_pendingTranslation'))._pendingTranslation
  if (!pending) return

  const { mode, targetLang, presetId } = pending
  const { article } = message

  lastArticle = article
  lastTranslations = new Map()

  const [providers, customPresets] = await Promise.all([
    getStorage('providers'),
    getStorage('customPresets'),
  ])
  const activeModel = await getStorage('activeModel')
  const resolved = resolveActiveProvider(providers, activeModel)
  if (!resolved) {
    await sendToTab(tabId, {
      action: 'translation-error',
      paragraphId: '',
      error: '请先在设置中配置服务商和模型',
    })
    return
  }

  const preset = resolvePreset(presetId, customPresets)
  const { paragraphs } = article
  const total = paragraphs.length

  // Translate paragraphs sequentially
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]

    await sendToTab(tabId, {
      action: 'translation-progress',
      current: i + 1,
      total,
    })

    try {
      const translation = await translateParagraph({
        provider: resolved.provider,
        modelId: resolved.modelId,
        paragraph,
        metadata: article.metadata,
        targetLang,
        preset,
      })

      lastTranslations.set(paragraph.id, translation)

      await sendToTab(tabId, {
        action: 'translation-result',
        paragraphId: paragraph.id,
        translation,
      })
    } catch (err) {
      await sendToTab(tabId, {
        action: 'translation-error',
        paragraphId: paragraph.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  await sendToTab(tabId, { action: 'translation-complete' })
}

async function handleRetry(
  message: Extract<Message, { action: 'retry-paragraph' }>,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (!tabId || !lastArticle) return

  const paragraph = lastArticle.paragraphs.find((p) => p.id === message.paragraphId)
  if (!paragraph) return

  const [providers, customPresets, activeModel, targetLang, presetId] = await Promise.all([
    getStorage('providers'),
    getStorage('customPresets'),
    getStorage('activeModel'),
    getStorage('targetLang'),
    getStorage('activePresetId'),
  ])

  const resolved = resolveActiveProvider(providers, activeModel)
  if (!resolved) return

  const preset = resolvePreset(presetId, customPresets)

  try {
    const translation = await translateParagraph({
      provider: resolved.provider,
      modelId: resolved.modelId,
      paragraph,
      metadata: lastArticle.metadata,
      targetLang,
      preset,
    })

    lastTranslations.set(paragraph.id, translation)

    await sendToTab(tabId, {
      action: 'translation-result',
      paragraphId: paragraph.id,
      translation,
    })
  } catch (err) {
    await sendToTab(tabId, {
      action: 'translation-error',
      paragraphId: paragraph.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function handleFetchModels(
  message: Extract<Message, { action: 'fetch-models' }>,
) {
  const providers = await getStorage('providers')
  const provider = providers.find((p) => p.id === message.providerId)
  if (!provider) return { action: 'fetch-models-result', models: [], error: 'Provider not found' }

  try {
    const models = await fetchModels(provider)
    return { action: 'fetch-models-result', models }
  } catch (err) {
    return { action: 'fetch-models-result', models: [], error: String(err) }
  }
}

async function handleExport(
  message: Extract<Message, { action: 'export-obsidian' }>,
) {
  if (!lastArticle || lastTranslations.size === 0) {
    return { action: 'export-result', success: false, error: '没有可导出的翻译内容' }
  }

  try {
    const [obsidianConfig, providers, activeModel] = await Promise.all([
      getStorage('obsidianConfig'),
      getStorage('providers'),
      getStorage('activeModel'),
    ])

    const resolved = resolveActiveProvider(providers, activeModel)
    const { options } = message

    let summary: string | undefined
    let quotes: string | undefined

    if (resolved && (options.includeSummary || options.includeQuotes)) {
      const translatedContent = lastArticle.paragraphs
        .map((p) => lastTranslations.get(p.id) ?? '')
        .filter(Boolean)
        .join('\n\n')

      if (options.includeSummary) {
        summary = await generateSummary(resolved.provider, resolved.modelId, translatedContent)
      }
      if (options.includeQuotes) {
        quotes = await generateQuotes(resolved.provider, resolved.modelId, translatedContent)
      }
    }

    const markdown = buildObsidianMarkdown({
      article: lastArticle,
      translations: lastTranslations,
      format: options.format,
      summary,
      quotes,
    })

    await exportToObsidian(obsidianConfig, lastArticle.metadata.title, markdown)
    return { action: 'export-result', success: true }
  } catch (err) {
    return { action: 'export-result', success: false, error: String(err) }
  }
}
