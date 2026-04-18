import { describe, it, expect, beforeEach } from 'vitest'
import {
  injectTranslation,
  clearAllTranslations,
  switchDisplayMode,
  restoreInlineTags,
  sanitizeHtml,
} from '../lib/injector'
import type { InlineTagMapping } from '../lib/types'

describe('injectTranslation', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
  })

  it('inserts translation node after original', () => {
    const p = document.createElement('p')
    p.textContent = 'Hello world'
    p.setAttribute('data-contexta-id', 'ctx-0')
    container.appendChild(p)

    injectTranslation('ctx-0', '你好世界', 'bilingual')

    const translated = container.querySelector('[data-contexta="translation"]')
    expect(translated).not.toBeNull()
    expect(translated!.textContent).toBe('你好世界')
    expect(translated!.tagName).toBe('P')
  })

  it('uses the same tag as the original element', () => {
    const h2 = document.createElement('h2')
    h2.textContent = 'Title'
    h2.setAttribute('data-contexta-id', 'ctx-1')
    container.appendChild(h2)

    injectTranslation('ctx-1', '标题', 'bilingual')

    const translated = container.querySelector('[data-contexta="translation"]')
    expect(translated!.tagName).toBe('H2')
  })

  it('in bilingual mode, both original and translation are visible', () => {
    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-2')
    container.appendChild(p)

    injectTranslation('ctx-2', '翻译', 'bilingual')

    expect(p.style.display).not.toBe('none')
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(translated.style.display).not.toBe('none')
  })

  it('in target-only mode, original is hidden', () => {
    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-3')
    container.appendChild(p)

    injectTranslation('ctx-3', '翻译', 'target-only')

    expect(p.style.display).toBe('none')
  })

  it('injects translation with restored inline HTML when tagMap provided', () => {
    const p = document.createElement('p')
    p.innerHTML = '<a href="https://example.com">Click here</a> to learn more'
    p.setAttribute('data-contexta-id', 'ctx-html')
    container.appendChild(p)

    const tagMap: InlineTagMapping[] = [
      { placeholder: 'a1', tag: 'a', attrs: { href: 'https://example.com' } },
    ]

    injectTranslation('ctx-html', '点击 <a1>这里</a1> 了解更多', 'bilingual', tagMap)

    const translated = container.querySelector('[data-contexta="translation"]')
    expect(translated).not.toBeNull()
    expect(translated!.innerHTML).toBe('点击 <a href="https://example.com">这里</a> 了解更多')
  })

  it('falls back to textContent when tagMap is undefined', () => {
    const p = document.createElement('p')
    p.textContent = 'Hello world'
    p.setAttribute('data-contexta-id', 'ctx-plain')
    container.appendChild(p)

    injectTranslation('ctx-plain', '你好世界', 'bilingual')

    const translated = container.querySelector('[data-contexta="translation"]')
    expect(translated!.textContent).toBe('你好世界')
  })
})

describe('clearAllTranslations', () => {
  it('removes all translation nodes and restores originals', () => {
    const container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)

    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-0')
    p.style.display = 'none'
    container.appendChild(p)

    const translated = document.createElement('p')
    translated.textContent = '翻译'
    translated.setAttribute('data-contexta', 'translation')
    translated.setAttribute('data-contexta-for', 'ctx-0')
    container.appendChild(translated)

    clearAllTranslations()

    expect(container.querySelector('[data-contexta="translation"]')).toBeNull()
    expect(p.style.display).not.toBe('none')
    expect(p.hasAttribute('data-contexta-id')).toBe(false)
  })
})

describe('switchDisplayMode', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)

    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-0')
    container.appendChild(p)

    const translated = document.createElement('p')
    translated.textContent = '翻译'
    translated.setAttribute('data-contexta', 'translation')
    translated.setAttribute('data-contexta-for', 'ctx-0')
    container.appendChild(translated)
  })

  it('bilingual mode shows both', () => {
    switchDisplayMode('bilingual')

    const original = container.querySelector('[data-contexta-id="ctx-0"]') as HTMLElement
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(original.style.display).not.toBe('none')
    expect(translated.style.display).not.toBe('none')
  })

  it('target-only mode hides originals', () => {
    switchDisplayMode('target-only')

    const original = container.querySelector('[data-contexta-id="ctx-0"]') as HTMLElement
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(original.style.display).toBe('none')
    expect(translated.style.display).not.toBe('none')
  })

  it('source-only mode hides translations', () => {
    switchDisplayMode('source-only')

    const original = container.querySelector('[data-contexta-id="ctx-0"]') as HTMLElement
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(original.style.display).not.toBe('none')
    expect(translated.style.display).toBe('none')
  })
})

describe('restoreInlineTags', () => {
  it('returns text unchanged with empty tagMap', () => {
    expect(restoreInlineTags('hello world', [])).toBe('hello world')
  })

  it('restores a single link', () => {
    const tagMap: InlineTagMapping[] = [
      { placeholder: 'a1', tag: 'a', attrs: { href: 'https://example.com' } },
    ]
    const result = restoreInlineTags('Click <a1>here</a1> to continue', tagMap)
    expect(result).toBe('Click <a href="https://example.com">here</a> to continue')
  })

  it('restores nested tags', () => {
    const tagMap: InlineTagMapping[] = [
      { placeholder: 'a1', tag: 'a', attrs: { href: 'url' } },
      { placeholder: 'em1', tag: 'em', attrs: {} },
    ]
    const result = restoreInlineTags('<a1><em1>React 应用</em1></a1> 在 Salesforce 上', tagMap)
    expect(result).toBe('<a href="url"><em>React 应用</em></a> 在 Salesforce 上')
  })

  it('restores multiple same-type tags', () => {
    const tagMap: InlineTagMapping[] = [
      { placeholder: 'a1', tag: 'a', attrs: { href: 'u1' } },
      { placeholder: 'a2', tag: 'a', attrs: { href: 'u2' } },
    ]
    const result = restoreInlineTags('<a1>第一</a1> 和 <a2>第二</a2>', tagMap)
    expect(result).toBe('<a href="u1">第一</a> 和 <a href="u2">第二</a>')
  })

  it('escapes HTML entities in attribute values', () => {
    const tagMap: InlineTagMapping[] = [
      { placeholder: 'a1', tag: 'a', attrs: { href: 'url?a=1&b=2', title: 'say "hello"' } },
    ]
    const result = restoreInlineTags('<a1>link</a1>', tagMap)
    expect(result).toBe('<a href="url?a=1&amp;b=2" title="say &quot;hello&quot;">link</a>')
  })
})

describe('sanitizeHtml', () => {
  it('allows whitelisted tags', () => {
    const html = '<a href="url">link</a> <em>italic</em> <strong>bold</strong>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('removes non-whitelisted tags but keeps content', () => {
    const result = sanitizeHtml('<div>text</div>')
    expect(result).toBe('text')
  })

  it('removes on* event attributes', () => {
    const result = sanitizeHtml('<a href="url" onclick="alert(1)">link</a>')
    expect(result).toBe('<a href="url">link</a>')
  })

  it('removes javascript: protocol', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>')
    expect(result).toBe('<a>link</a>')
  })

  it('allows br tags', () => {
    expect(sanitizeHtml('line1<br>line2')).toBe('line1<br>line2')
  })

  it('allows b, i, mark tags', () => {
    const html = '<b>bold</b> <i>italic</i> <mark>highlight</mark>'
    expect(sanitizeHtml(html)).toBe(html)
  })
})
