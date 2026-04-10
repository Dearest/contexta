import { describe, it, expect } from 'vitest'
import { buildFrontmatterAndCallouts } from '../lib/obsidian'
import type { ArticleMetadata } from '../lib/types'

const mockMetadata: ArticleMetadata = {
  title: 'Test Article',
  author: 'John Doe',
  published: '2026-04-09',
  url: 'https://example.com/article',
}

describe('buildFrontmatterAndCallouts', () => {
  it('generates frontmatter with metadata', () => {
    const result = buildFrontmatterAndCallouts(mockMetadata)
    expect(result).toContain('title: "Test Article"')
    expect(result).toContain('author: "John Doe"')
    expect(result).toContain('source: "https://example.com/article"')
    expect(result).toContain('date: 2026-04-09')
    expect(result).toContain('translated: true')
  })

  it('omits author when not provided', () => {
    const result = buildFrontmatterAndCallouts({ title: 'No Author', url: 'https://example.com' })
    expect(result).not.toContain('author:')
  })

  it('includes summary callout when provided', () => {
    const result = buildFrontmatterAndCallouts(mockMetadata, '这是一篇关于测试的文章。')
    expect(result).toContain('> [!abstract] 摘要')
    expect(result).toContain('> 这是一篇关于测试的文章。')
  })

  it('includes quotes callout when provided', () => {
    const result = buildFrontmatterAndCallouts(mockMetadata, undefined, '- "精彩句子一"\n- "精彩句子二"')
    expect(result).toContain('> [!quote] 金句')
    expect(result).toContain('> - "精彩句子一"')
  })

  it('includes separator when callouts exist', () => {
    const result = buildFrontmatterAndCallouts(mockMetadata, '摘要内容')
    expect(result).toMatch(/---\n$/)
  })

  it('omits summary/quotes sections when not provided', () => {
    const result = buildFrontmatterAndCallouts(mockMetadata)
    expect(result).not.toContain('[!abstract]')
    expect(result).not.toContain('[!quote]')
  })
})
