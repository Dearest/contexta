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

  it('preserves span with style attribute', () => {
    const el = document.createElement('p')
    el.innerHTML = '<span style="color:red">colored</span> text'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('<span1>colored</span1> text')
    expect(result.tagMap).toHaveLength(1)
    expect(result.tagMap[0]).toEqual({ placeholder: 'span1', tag: 'span', attrs: { style: 'color:red' } })
  })

  it('preserves span with class attribute', () => {
    const el = document.createElement('p')
    el.innerHTML = '<span class="mainlink">title</span> desc'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('<span1>title</span1> desc')
    expect(result.tagMap[0].attrs).toEqual({ class: 'mainlink' })
  })

  it('passes through bare span without style or class', () => {
    const el = document.createElement('p')
    el.innerHTML = '<span>plain</span> text'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('plain text')
    expect(result.tagMap).toEqual([])
  })

  it('preserves inline code tags', () => {
    const el = document.createElement('p')
    el.innerHTML = 'Use <code>npm install</code> to install'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Use <code1>npm install</code1> to install')
    expect(result.tagMap[0]).toEqual({ placeholder: 'code1', tag: 'code', attrs: {} })
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

  it('skips button content entirely', () => {
    const el = document.createElement('div')
    el.innerHTML = '<button><svg viewBox="0 0 24 24"></svg><span>469</span></button>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('')
    expect(result.tagMap).toEqual([])
  })

  it('skips SVG elements', () => {
    const el = document.createElement('div')
    el.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 2"></path></svg> text'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('text')
    expect(result.tagMap).toEqual([])
  })

  it('skips textarea and select elements', () => {
    const el = document.createElement('div')
    el.innerHTML = 'Label: <textarea>draft</textarea> <select><option>A</option></select>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Label:')
    expect(result.tagMap).toEqual([])
  })

  it('extracts text alongside buttons (action bar pattern)', () => {
    const el = document.createElement('div')
    el.innerHTML = 'Posted by <a href="/user">Alice</a> <button>Reply</button> <button>Like</button>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Posted by <a1>Alice</a1>')
    expect(result.tagMap).toHaveLength(1)
    expect(result.tagMap[0].tag).toBe('a')
  })

  it('preserves inline code but skips block pre>code', () => {
    const el = document.createElement('div')
    el.innerHTML = 'Use <code>npm</code> but skip <pre><code>block</code></pre>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('Use <code1>npm</code1> but skip')
    expect(result.tagMap).toHaveLength(1)
    expect(result.tagMap[0].tag).toBe('code')
  })

  it('handles complex nested structure with mixed preserved/skipped tags', () => {
    const el = document.createElement('p')
    el.innerHTML = '<span class="title"><a href="/post"><em>Title</em></a></span> — description <button>Share</button>'
    const result = extractInlineHtml(el)
    expect(result.text).toBe('<span1><a1><em1>Title</em1></a1></span1> — description')
    expect(result.tagMap).toHaveLength(3)
    expect(result.tagMap[0].tag).toBe('span')
    expect(result.tagMap[1].tag).toBe('a')
    expect(result.tagMap[2].tag).toBe('em')
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

  it('uses fallback extraction for non-semantic DOM (div+span)', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div><div><span>Tweet text here with enough content</span></div></div>
      <div><div><span>Reply text here with enough content</span></div></div>
    `
    const paragraphs = extractParagraphs(container)
    expect(paragraphs.length).toBeGreaterThan(0)
    expect(paragraphs.some(p => p.plainText.includes('Tweet text'))).toBe(true)
    expect(paragraphs.some(p => p.plainText.includes('Reply text'))).toBe(true)
  })

  it('fallback excludes button-only containers', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <div><span>Actual content to translate</span></div>
      <div><button><svg viewBox="0 0 24 24"></svg><span>137</span></button></div>
      <div><button><svg viewBox="0 0 24 24"></svg><span>469</span></button></div>
    `
    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].plainText).toBe('Actual content to translate')
  })

  it('preserves tagMap through extractParagraphs', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Click <a href="https://example.com">here</a> for details</p>'
    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].text).toBe('Click <a1>here</a1> for details')
    expect(paragraphs[0].plainText).toBe('Click here for details')
    expect(paragraphs[0].tagMap).toEqual([
      { placeholder: 'a1', tag: 'a', attrs: { href: 'https://example.com' } },
    ])
  })

  it('sets tagMap to undefined when no inline tags', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Plain text only</p>'
    const paragraphs = extractParagraphs(container)
    expect(paragraphs[0].tagMap).toBeUndefined()
  })

  it('assigns unique IDs', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>A</p><p>B</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs[0].id).not.toBe(paragraphs[1].id)
  })
})
