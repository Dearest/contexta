import { describe, it, expect } from 'vitest'
import { extractParagraphs, shouldSkipNode, extractInlineHtml } from '../lib/extractor'

describe('shouldSkipNode', () => {
  it('skips pre elements', () => {
    const el = document.createElement('pre')
    el.textContent = 'code here'
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips code elements', () => {
    const el = document.createElement('code')
    el.textContent = 'inline code'
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips input elements', () => {
    const el = document.createElement('input')
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips elements with data-contexta attribute', () => {
    const el = document.createElement('p')
    el.setAttribute('data-contexta', 'translation')
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips empty text nodes', () => {
    const el = document.createElement('p')
    el.textContent = '   '
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('does not skip paragraph with text', () => {
    const el = document.createElement('p')
    el.textContent = 'Hello world'
    expect(shouldSkipNode(el)).toBe(false)
  })
})

describe('extractInlineHtml', () => {
  it('returns plain text when no inline tags', () => {
    const el = document.createElement('p')
    el.textContent = 'Hello world'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Hello world')
    expect(result.plainText).toBe('Hello world')
    expect(result.tagMap).toEqual([])
  })

  it('replaces a single link with placeholder', () => {
    const el = document.createElement('p')
    el.innerHTML = 'Click <a href="https://example.com" title="Example">here</a> to continue'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Click <a1>here</a1> to continue')
    expect(result.plainText).toBe('Click here to continue')
    expect(result.tagMap).toEqual([
      { placeholder: 'a1', tag: 'a', attrs: { href: 'https://example.com', title: 'Example' } },
    ])
  })

  it('handles nested tags: a > em', () => {
    const el = document.createElement('p')
    el.innerHTML = '<a href="url"><em>React Apps</em></a> on Salesforce'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('<a1><em1>React Apps</em1></a1> on Salesforce')
    expect(result.plainText).toBe('React Apps on Salesforce')
    expect(result.tagMap).toHaveLength(2)
    expect(result.tagMap[0]).toEqual({ placeholder: 'a1', tag: 'a', attrs: { href: 'url' } })
    expect(result.tagMap[1]).toEqual({ placeholder: 'em1', tag: 'em', attrs: {} })
  })

  it('numbers multiple same-type tags', () => {
    const el = document.createElement('p')
    el.innerHTML = '<a href="u1">first</a> and <a href="u2">second</a>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('<a1>first</a1> and <a2>second</a2>')
    expect(result.tagMap).toHaveLength(2)
    expect(result.tagMap[0].placeholder).toBe('a1')
    expect(result.tagMap[1].placeholder).toBe('a2')
  })

  it('passes through non-preserved inline tags (span)', () => {
    const el = document.createElement('p')
    el.innerHTML = '<span style="color:red">colored</span> text'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('colored text')
    expect(result.tagMap).toEqual([])
  })

  it('preserves strong and b tags', () => {
    const el = document.createElement('p')
    el.innerHTML = 'This is <strong>important</strong> and <b>bold</b>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('This is <strong1>important</strong1> and <b1>bold</b1>')
    expect(result.tagMap).toHaveLength(2)
  })

  it('converts br to newline', () => {
    const el = document.createElement('p')
    el.innerHTML = 'Line one<br>Line two'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Line one\nLine two')
  })

  it('handles mark tag', () => {
    const el = document.createElement('p')
    el.innerHTML = 'This is <mark>highlighted</mark> text'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('This is <mark1>highlighted</mark1> text')
    expect(result.tagMap[0]).toEqual({ placeholder: 'mark1', tag: 'mark', attrs: {} })
  })
})

describe('extractParagraphs', () => {
  it('extracts paragraphs from a container', () => {
    const container = document.createElement('div')
    container.innerHTML = '<h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0].plainText).toBe('Title')
    expect(paragraphs[0].tagName).toBe('H1')
    expect(paragraphs[1].plainText).toBe('First paragraph.')
    expect(paragraphs[1].prev).toBe('Title')
    expect(paragraphs[1].next).toBe('Second paragraph.')
  })

  it('skips code blocks', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Before code.</p><pre><code>const x = 1;</code></pre><p>After code.</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].plainText).toBe('Before code.')
    expect(paragraphs[1].plainText).toBe('After code.')
  })

  it('assigns unique IDs', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>A</p><p>B</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs[0].id).not.toBe(paragraphs[1].id)
  })
})
