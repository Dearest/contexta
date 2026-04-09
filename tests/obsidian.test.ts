import { describe, it, expect } from 'vitest'
import { buildObsidianMarkdown } from '../lib/obsidian'
import type { ExtractedArticle } from '../lib/types'

const mockArticle: ExtractedArticle = {
  paragraphs: [
    { id: '1', text: 'Hello world', tagName: 'P' },
    { id: '2', text: 'Second paragraph', tagName: 'P', prev: 'Hello world' },
  ],
  metadata: {
    title: 'Test Article',
    author: 'John Doe',
    published: '2026-04-09',
    url: 'https://example.com/article',
  },
}

const mockTranslations = new Map([
  ['1', '你好世界'],
  ['2', '第二段'],
])

describe('buildObsidianMarkdown', () => {
  it('generates frontmatter with metadata', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
    })
    expect(result).toContain('title: "Test Article"')
    expect(result).toContain('author: "John Doe"')
    expect(result).toContain('source: "https://example.com/article"')
  })

  it('generates target-only format', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
    })
    expect(result).toContain('你好世界')
    expect(result).toContain('第二段')
    expect(result).not.toContain('Hello world')
  })

  it('generates bilingual format', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'bilingual',
    })
    expect(result).toContain('Hello world')
    expect(result).toContain('你好世界')
  })

  it('generates source-only format', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'source-only',
    })
    expect(result).toContain('Hello world')
    expect(result).not.toContain('你好世界')
  })

  it('includes summary callout when provided', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
      summary: '这是一篇关于测试的文章。',
    })
    expect(result).toContain('> [!abstract] 摘要')
    expect(result).toContain('> 这是一篇关于测试的文章。')
  })

  it('includes quotes callout when provided', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
      quotes: '- "精彩句子一"\n- "精彩句子二"',
    })
    expect(result).toContain('> [!quote] 金句')
    expect(result).toContain('> - "精彩句子一"')
  })

  it('omits summary/quotes sections when not provided', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
    })
    expect(result).not.toContain('[!abstract]')
    expect(result).not.toContain('[!quote]')
  })
})
