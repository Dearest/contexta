import { describe, it, expect, beforeEach } from 'vitest'
import { injectTranslation, clearAllTranslations, switchDisplayMode } from '../lib/injector'

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
