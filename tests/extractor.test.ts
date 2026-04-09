import { describe, it, expect } from 'vitest'
import { extractParagraphs, shouldSkipNode } from '../lib/extractor'

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

describe('extractParagraphs', () => {
  it('extracts paragraphs from a container', () => {
    const container = document.createElement('div')
    container.innerHTML = '<h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0].text).toBe('Title')
    expect(paragraphs[0].tagName).toBe('H1')
    expect(paragraphs[1].text).toBe('First paragraph.')
    expect(paragraphs[1].prev).toBe('Title')
    expect(paragraphs[1].next).toBe('Second paragraph.')
  })

  it('skips code blocks', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Before code.</p><pre><code>const x = 1;</code></pre><p>After code.</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].text).toBe('Before code.')
    expect(paragraphs[1].text).toBe('After code.')
  })

  it('assigns unique IDs', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>A</p><p>B</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs[0].id).not.toBe(paragraphs[1].id)
  })
})
