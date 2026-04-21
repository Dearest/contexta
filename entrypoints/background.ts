import { onMessage, sendToTab } from '@/lib/messages'
import { getStorage } from '@/lib/storage'
import { translateParagraph, generateSummary, generateQuotes, resolvePreset, isAlreadyTargetLang } from '@/lib/translator'
import { resolveActiveProvider, fetchModels } from '@/lib/providers'
import type { Message, ExtractedArticle } from '@/lib/types'
import { buildFrontmatterAndCallouts, exportToObsidian, openInObsidian } from '@/lib/obsidian'

// lastArticle kept for retry (paragraph prev/next context for LLM prompt)
let lastArticle: ExtractedArticle | null = null

async function saveArticle() {
  await chrome.storage.session.set({ _lastArticle: lastArticle })
}

async function loadArticle() {
  if (lastArticle) return
  const data = await chrome.storage.session.get('_lastArticle')
  if (data._lastArticle) lastArticle = data._lastArticle
}

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
      case 'open-in-obsidian':
        return handleOpenInObsidian(message)
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
  await saveArticle()

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

    // Skip paragraphs already in the target language
    if (isAlreadyTargetLang(paragraph.plainText, targetLang)) {
      continue
    }

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

      await sendToTab(tabId, {
        action: 'translation-result',
        paragraphId: paragraph.id,
        translation,
        tagMap: paragraph.tagMap,
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
  await loadArticle()
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

    await sendToTab(tabId, {
      action: 'translation-result',
      paragraphId: paragraph.id,
      translation,
      tagMap: paragraph.tagMap,
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
  const pending = (await chrome.storage.local.get('_pendingTranslation'))._pendingTranslation
  const tabId = pending?.tabId
  if (!tabId) {
    return { action: 'export-result', success: false, error: '找不到翻译页面' }
  }

  try {
    // Content script reads translations from DOM and builds markdown
    const { markdown: contentMarkdown, translatedText, metadata } = await sendToTab(tabId, {
      action: 'build-export-markdown',
      format: message.options.format,
    }) as { markdown: string; translatedText: string; metadata: { title: string; author?: string; published?: string; url: string } }

    if (!contentMarkdown) {
      return { action: 'export-result', success: false, error: '没有可导出的翻译内容' }
    }

    const [obsidianConfig, providers, activeModel] = await Promise.all([
      getStorage('obsidianConfig'),
      getStorage('providers'),
      getStorage('activeModel'),
    ])

    const resolved = resolveActiveProvider(providers, activeModel)
    const { options } = message

    let summary: string | undefined
    let quotes: string | undefined

    if (resolved && translatedText && (options.includeSummary || options.includeQuotes)) {
      if (options.includeSummary) {
        summary = await generateSummary(resolved.provider, resolved.modelId, translatedText)
      }
      if (options.includeQuotes) {
        quotes = await generateQuotes(resolved.provider, resolved.modelId, translatedText)
      }
    }

    const header = buildFrontmatterAndCallouts(metadata, summary, quotes)
    const fullMarkdown = header + contentMarkdown

    const filePath = await exportToObsidian(obsidianConfig, metadata.title, fullMarkdown)
    return { action: 'export-result', success: true, filePath }
  } catch (err) {
    return { action: 'export-result', success: false, error: String(err) }
  }
}

async function handleOpenInObsidian(
  message: Extract<Message, { action: 'open-in-obsidian' }>,
) {
  try {
    const obsidianConfig = await getStorage('obsidianConfig')
    await openInObsidian(obsidianConfig, message.filePath)
    return { action: 'open-in-obsidian-result', success: true }
  } catch (err) {
    return { action: 'open-in-obsidian-result', success: false, error: String(err) }
  }
}
