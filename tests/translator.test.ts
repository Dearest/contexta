import { describe, it, expect } from 'vitest'
import { explainError, isAlreadyTargetLang } from '../lib/translator'

describe('explainError', () => {
  it('explains the SSE-instead-of-JSON case gateways cause', () => {
    const msg = explainError(new Error('Invalid JSON response'))
    expect(msg).toContain('SSE')
  })

  it('explains network failures', () => {
    expect(explainError(new TypeError('Failed to fetch'))).toContain('无法连接')
  })

  it('explains auth failures', () => {
    expect(explainError(new Error('401 Unauthorized'))).toContain('API Key')
  })

  it('explains missing models', () => {
    expect(explainError(new Error('model_not_found'))).toContain('模型不存在')
  })

  it('explains rate limits', () => {
    expect(explainError(new Error('429 rate limit exceeded'))).toContain('限流')
  })

  it('explains upstream gateway failures', () => {
    expect(explainError(new Error('error code: 502'))).toContain('上游')
  })

  it('passes through unrecognized messages', () => {
    expect(explainError(new Error('something odd'))).toBe('something odd')
  })

  it('digs the real error out of a RetryError wrapper', () => {
    // AI SDK shape: the useful detail is on lastError, not the outer message
    const inner = Object.assign(new Error(''), {
      statusCode: 502,
      responseBody: 'error code: 502',
    })
    const outer = Object.assign(new Error('Failed after 3 attempts. Last error: '), {
      lastError: inner,
      errors: [inner],
    })

    const msg = explainError(outer)
    expect(msg).toContain('上游')
    expect(msg).not.toBe('Failed after 3 attempts. Last error: ')
  })

  it('surfaces a wrapped response body when nothing else matches', () => {
    const outer = Object.assign(new Error('Failed after 3 attempts. Last error: '), {
      lastError: Object.assign(new Error(''), { responseBody: 'model is cold, retry later' }),
    })

    expect(explainError(outer)).toContain('model is cold, retry later')
  })

  it('does not repeat identical messages from several chain levels', () => {
    const inner = new Error('boom')
    const outer = Object.assign(new Error('boom'), { cause: inner })

    expect(explainError(outer)).toBe('boom')
  })

  it('truncates very long unrecognized messages', () => {
    const msg = explainError(new Error('x'.repeat(500)))
    expect(msg.length).toBeLessThanOrEqual(201)
    expect(msg.endsWith('…')).toBe(true)
  })
})

describe('isAlreadyTargetLang', () => {
  it('detects Chinese text as already translated', () => {
    expect(isAlreadyTargetLang('这是一段中文内容', 'zh-CN')).toBe(true)
  })

  it('does not skip English text when targeting Chinese', () => {
    expect(isAlreadyTargetLang('This is English text', 'zh-CN')).toBe(false)
  })

  it('still detects Chinese that mixes in a few English terms', () => {
    expect(isAlreadyTargetLang('我们使用大语言模型 LLM 来做翻译工作', 'zh-CN')).toBe(true)
  })

  it('treats mostly-English text with a few Chinese words as untranslated', () => {
    // CJK ratio falls under the 0.3 threshold, so it still gets translated
    expect(isAlreadyTargetLang('使用 Large Language Model 做翻译', 'zh-CN')).toBe(false)
  })

  it('returns false for punctuation-only text', () => {
    expect(isAlreadyTargetLang('...!!! ???', 'zh-CN')).toBe(false)
  })
})
