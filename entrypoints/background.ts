import { onMessage, sendToTab } from '@/lib/messages'
import { getStorage } from '@/lib/storage'
import { translateParagraph, generateSummary, generateQuotes, resolvePreset, isAlreadyTargetLang, testProvider, explainError, streamSelection, streamPolish } from '@/lib/translator'
import { resolveActiveProvider, fetchModels } from '@/lib/providers'
import type { Message, ExtractedArticle, DisplayMode, GapEntry } from '@/lib/types'
import { appendGapEntries, buildFrontmatterAndCallouts, exportToObsidian, openInObsidian, testObsidian } from '@/lib/obsidian'

/** Bound on the local gap log kept when Obsidian isn't configured */
const GAP_LOG_LIMIT = 500

interface PendingTranslation {
  mode: DisplayMode
  targetLang: string
  presetId: string
  tabId: number
}

// lastArticle kept for retry (paragraph prev/next context for LLM prompt)
let lastArticle: ExtractedArticle | null = null

async function saveArticle() {
  await chrome.storage.session.set({ _lastArticle: lastArticle })
}

async function loadArticle() {
  if (lastArticle) return
  const data = (await chrome.storage.session.get('_lastArticle')) as {
    _lastArticle?: ExtractedArticle
  }
  if (data._lastArticle) lastArticle = data._lastArticle
}

async function getPendingTranslation(): Promise<PendingTranslation | undefined> {
  const stored = (await chrome.storage.local.get('_pendingTranslation')) as {
    _pendingTranslation?: PendingTranslation
  }
  return stored._pendingTranslation
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
      case 'test-provider':
        return handleTestProvider(message)
      case 'test-obsidian':
        return testObsidian(await getStorage('obsidianConfig'))
      case 'translate-selection':
        return handleTranslateSelection(message, sender)
      case 'polish-input':
        return handlePolishInput(message, sender)
      case 'record-gap':
        return handleRecordGap(message)
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

  const pending = await getPendingTranslation()
  if (!pending) return

  const { targetLang, presetId } = pending
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
        error: explainError(err),
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
  if (!provider) return { action: 'fetch-models-result', models: [], error: '找不到该服务商' }

  try {
    const models = await fetchModels(provider)
    return { action: 'fetch-models-result', models }
  } catch (err) {
    return { action: 'fetch-models-result', models: [], error: explainError(err) }
  }
}

async function handleTestProvider(
  message: Extract<Message, { action: 'test-provider' }>,
) {
  const providers = await getStorage('providers')
  const provider = providers.find((p) => p.id === message.providerId)
  if (!provider) return { ok: false, error: '找不到该服务商' }
  return testProvider(provider, message.modelId)
}

async function handleTranslateSelection(
  message: Extract<Message, { action: 'translate-selection' }>,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (!tabId) return

  const { requestId } = message
  const fail = (error: string) =>
    sendToTab(tabId, { action: 'selection-error', requestId, error })

  const [providers, activeModel, quickModel, targetLang] = await Promise.all([
    getStorage('providers'),
    getStorage('activeModel'),
    getStorage('quickModel'),
    getStorage('targetLang'),
  ])

  // Prefer the dedicated fast model, fall back to the main one
  const resolved =
    resolveActiveProvider(providers, quickModel) ??
    resolveActiveProvider(providers, activeModel)
  if (!resolved) {
    await fail('请先在设置中配置服务商和模型')
    return
  }

  let reasoningNotified = false
  try {
    await streamSelection(
      resolved.provider,
      resolved.modelId,
      message.text,
      targetLang,
      (chunk) => {
        // Fire-and-forget: awaiting each chunk would serialize the stream
        // behind message round-trips and defeat the point of streaming.
        sendToTab(tabId, { action: 'selection-chunk', requestId, chunk }).catch(() => {})
      },
      () => {
        if (reasoningNotified) return // one notification is enough
        reasoningNotified = true
        sendToTab(tabId, { action: 'selection-reasoning', requestId }).catch(() => {})
      },
    )
    await sendToTab(tabId, { action: 'selection-done', requestId })
  } catch (err) {
    await fail(explainError(err))
  }
}

async function handlePolishInput(
  message: Extract<Message, { action: 'polish-input' }>,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (!tabId) return

  const { requestId } = message
  const fail = (error: string) =>
    sendToTab(tabId, { action: 'polish-error', requestId, error })

  const [providers, activeModel, quickModel, polishModel] = await Promise.all([
    getStorage('providers'),
    getStorage('activeModel'),
    getStorage('quickModel'),
    getStorage('polishModel'),
  ])

  // Polish is latency-sensitive like selection translation, so it prefers the
  // fast models before falling back to the main one
  const resolved =
    resolveActiveProvider(providers, polishModel) ??
    resolveActiveProvider(providers, quickModel) ??
    resolveActiveProvider(providers, activeModel)
  if (!resolved) {
    await fail('请先在设置中配置服务商和模型')
    return
  }

  let reasoningNotified = false
  try {
    await streamPolish(
      resolved.provider,
      resolved.modelId,
      message.text,
      message.context,
      (chunk) => {
        sendToTab(tabId, { action: 'polish-chunk', requestId, chunk }).catch(() => {})
      },
      () => {
        if (reasoningNotified) return
        reasoningNotified = true
        sendToTab(tabId, { action: 'polish-reasoning', requestId }).catch(() => {})
      },
    )
    await sendToTab(tabId, { action: 'polish-done', requestId })
  } catch (err) {
    await fail(explainError(err))
  }
}

/**
 * Expression gaps are worth keeping for the aggregate picture ("14 of this
 * quarter's 47 gaps were state verbs"), not for re-reading line by line.
 *
 * Failures stay silent: this runs after the user has already been shown the
 * result, and a logging problem must never surface as a writing interruption.
 */
async function handleRecordGap(
  message: Extract<Message, { action: 'record-gap' }>,
) {
  if (!message.entries.length) return

  try {
    const [enabled, config, notePath] = await Promise.all([
      getStorage('gapRecordEnabled'),
      getStorage('obsidianConfig'),
      getStorage('gapNotePath'),
    ])

    if (enabled && config.apiToken && notePath) {
      await appendGapEntries(config, notePath, message.entries)
      return
    }

    // Not wired to Obsidian: keep a bounded local log so the data still exists
    const stored = (await chrome.storage.local.get('_gapLog')) as { _gapLog?: GapEntry[] }
    const log = [...(stored._gapLog ?? []), ...message.entries]
    await chrome.storage.local.set({ _gapLog: log.slice(-GAP_LOG_LIMIT) })
  } catch (err) {
    console.warn('[Contexta] 记录表达缺口失败', err)
  }
}

async function handleExport(
  message: Extract<Message, { action: 'export-obsidian' }>,
) {
  const pending = await getPendingTranslation()
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
