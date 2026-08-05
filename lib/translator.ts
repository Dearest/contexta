import { generateText, streamText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { Provider, Paragraph, ArticleMetadata, TranslationPreset, TestResult } from './types'
import { buildSystemPrompt, buildUserPrompt, buildSummaryPrompt, buildQuotesPrompt, buildSelectionSystemPrompt } from './prompts'
import { BUILTIN_PRESETS } from './constants'

interface TranslateOptions {
  provider: Provider
  modelId: string
  paragraph: Paragraph
  metadata: ArticleMetadata
  targetLang: string
  preset: TranslationPreset
}

/**
 * Some OpenAI-compatible gateways default to SSE when `stream` is absent from
 * the body, which breaks `generateText()` (it expects a plain JSON response and
 * fails with "invalid json response"). The AI SDK omits `stream` entirely on
 * non-streaming calls, so we explicitly pin it to `false` when it's missing.
 */
const nonStreamFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body)
      if (body && typeof body === 'object' && !('stream' in body)) {
        init = { ...init, body: JSON.stringify({ ...body, stream: false }) }
      }
    } catch {
      // Not JSON — pass through untouched
    }
  }
  return fetch(input, init)
}

function createProvider(provider: Provider) {
  return createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl.replace(/\/$/, ''),
    apiKey: provider.apiKey,
    fetch: nonStreamFetch,
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

/**
 * Stream a selection translation. Selection translation is judged on latency,
 * so this streams rather than waiting for the full completion like
 * translateParagraph() does — perceived speed is dominated by time-to-first-token.
 */
export async function streamSelection(
  provider: Provider,
  modelId: string,
  text: string,
  targetLang: string,
  onChunk: (chunk: string) => void,
  onReasoning?: () => void,
): Promise<void> {
  const llm = createProvider(provider)
  const result = streamText({
    model: llm(modelId),
    system: buildSelectionSystemPrompt(targetLang),
    prompt: text,
  })

  // fullStream rather than textStream: reasoning models emit nothing on
  // textStream while they think, which looks identical to a hang. Surfacing
  // reasoning deltas lets the UI say "思考中" instead of showing a dead caret.
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      onChunk(part.text)
    } else if (part.type === 'reasoning-delta') {
      onReasoning?.()
    } else if (part.type === 'error') {
      throw part.error
    }
  }
}

/**
 * Send a minimal real completion to verify the provider actually works.
 * Catches what a `/models` call cannot: wrong model id, missing upstream
 * credentials, gateways that only speak SSE, and quota errors.
 */
export async function testProvider(
  provider: Provider,
  modelId: string,
): Promise<TestResult> {
  if (!provider.baseUrl.trim()) return { ok: false, error: '请先填写 Base URL' }
  if (!provider.apiKey.trim()) return { ok: false, error: '请先填写 API Key' }
  if (!modelId.trim()) return { ok: false, error: '请先填写模型名称' }

  try {
    const llm = createProvider(provider)
    const { text } = await generateText({
      model: llm(modelId.trim()),
      prompt: 'Reply with exactly: OK',
    })
    const reply = text.trim()
    return reply
      ? { ok: true, detail: `模型回复：${reply.slice(0, 40)}` }
      : { ok: false, error: '模型返回了空内容' }
  } catch (err) {
    return { ok: false, error: explainError(err) }
  }
}

/**
 * Collect every message the error chain has to offer. AI SDK wraps failures:
 * RetryError's own message is "Failed after 3 attempts. Last error: <inner>",
 * and when the inner error has no message that reads as an empty error. The
 * actionable detail (status code, response body) lives on the wrapped
 * APICallError, so walk the chain instead of trusting the top-level message.
 */
function collectErrorText(err: unknown, depth = 0): string[] {
  if (depth > 4 || err == null) return []
  if (typeof err === 'string') return [err]
  if (typeof err !== 'object') return [String(err)]

  const e = err as Record<string, unknown>
  const parts: string[] = []

  if (typeof e.statusCode === 'number') parts.push(String(e.statusCode))
  if (typeof e.responseBody === 'string' && e.responseBody) parts.push(e.responseBody)
  if (typeof e.message === 'string' && e.message) parts.push(e.message)

  parts.push(...collectErrorText(e.lastError, depth + 1))
  parts.push(...collectErrorText(e.cause, depth + 1))
  if (Array.isArray(e.errors)) {
    for (const inner of e.errors) parts.push(...collectErrorText(inner, depth + 1))
  }

  return parts
}

/** Turn AI SDK / fetch errors into something a user can act on. */
export function explainError(err: unknown): string {
  const collected = collectErrorText(err)
  const raw = collected.join(' | ') || (err instanceof Error ? err.message : String(err))

  if (/invalid json response|JSON parsing failed/i.test(raw)) {
    return '服务端返回的不是合法 JSON（部分网关默认走 SSE 流式响应）'
  }
  if (/Failed to fetch|NetworkError|ENOTFOUND/i.test(raw)) {
    return '无法连接服务端，请检查 Base URL 和网络'
  }
  if (/401|Unauthorized|invalid api key/i.test(raw)) {
    return 'API Key 无效或已过期'
  }
  if (/404|model_not_found|does not exist/i.test(raw)) {
    return '模型不存在，或该服务商未开通此模型'
  }
  if (/429|rate limit|quota/i.test(raw)) {
    return '触发限流或额度不足'
  }
  if (/\b50[023]\b|bad gateway|service unavailable/i.test(raw)) {
    return '服务端错误（该模型的上游可能暂时不可用，换个模型试试）'
  }

  // Dedupe: the same message often appears at several levels of the chain
  const unique = [...new Set(collected.map((s) => s.trim()).filter(Boolean))].join(' | ')
  const message = unique || raw
  return message.length > 200 ? `${message.slice(0, 200)}…` : message
}

export function resolvePreset(
  presetId: string,
  customPresets: TranslationPreset[],
): TranslationPreset {
  const all = [...BUILTIN_PRESETS, ...customPresets]
  return all.find((p) => p.id === presetId) ?? BUILTIN_PRESETS[0]
}

/**
 * Check if text is already in the target language by character ratio.
 * CJK ratio > 0.3 → Chinese; Latin ratio > 0.5 → English.
 * CJK threshold is lower because Chinese text often mixes English terms.
 */
export function isAlreadyTargetLang(text: string, targetLang: string): boolean {
  const stripped = text.replace(/[\s\d\p{P}\p{S}]/gu, '')
  if (stripped.length === 0) return false

  if (targetLang === 'zh-CN' || targetLang === 'zh-TW') {
    const cjk = stripped.replace(/[^\u4e00-\u9fff]/g, '').length
    return cjk / stripped.length > 0.3
  }

  if (targetLang === 'en') {
    const latin = stripped.replace(/[^a-zA-Z]/g, '').length
    return latin / stripped.length > 0.5
  }

  return false
}
