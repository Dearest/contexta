import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, buildSummaryPrompt, buildQuotesPrompt } from '../lib/prompts'

describe('buildSystemPrompt', () => {
  it('includes target language', () => {
    const result = buildSystemPrompt('简体中文', '- 保留术语')
    expect(result).toContain('精通简体中文')
  })

  it('includes preset rules', () => {
    const rules = '- 风格参考机器之心'
    const result = buildSystemPrompt('简体中文', rules)
    expect(result).toContain(rules)
  })

  it('includes core translation rules', () => {
    const result = buildSystemPrompt('简体中文', '')
    expect(result).toContain('技术术语、产品名、公司名保留英文原文')
    expect(result).toContain('仅输出译文')
    expect(result).toContain('先直译')
  })
})

describe('buildUserPrompt', () => {
  it('includes current paragraph', () => {
    const result = buildUserPrompt({
      title: 'Test Article',
      current: 'Hello world',
    })
    expect(result).toContain('[请翻译以下段落]')
    expect(result).toContain('Hello world')
  })

  it('includes context when provided', () => {
    const result = buildUserPrompt({
      title: 'Test',
      current: 'Middle paragraph',
      prev: 'Previous text',
      next: 'Next text',
    })
    expect(result).toContain('[上文')
    expect(result).toContain('Previous text')
    expect(result).toContain('[下文')
    expect(result).toContain('Next text')
  })

  it('omits context sections when not provided', () => {
    const result = buildUserPrompt({
      title: 'Test',
      current: 'Only paragraph',
    })
    expect(result).not.toContain('[上文')
    expect(result).not.toContain('[下文')
  })

  it('includes article title', () => {
    const result = buildUserPrompt({
      title: 'Attention Is All You Need',
      current: 'Some text',
    })
    expect(result).toContain('[文章标题] Attention Is All You Need')
  })
})

describe('buildSummaryPrompt', () => {
  it('asks for summary of translated content', () => {
    const result = buildSummaryPrompt('这是一篇关于 AI 的文章...')
    expect(result).toContain('摘要')
    expect(result).toContain('这是一篇关于 AI 的文章...')
  })
})

describe('buildQuotesPrompt', () => {
  it('asks for key quotes extraction', () => {
    const result = buildQuotesPrompt('文章内容...')
    expect(result).toContain('金句')
    expect(result).toContain('文章内容...')
  })
})
