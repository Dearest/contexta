# Inline Structure Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve inline HTML structure (links, bold, italic) in translations using placeholder tag mapping.

**Architecture:** Extractor replaces inline tags with numbered placeholders (`<a1>`, `<em1>`) and builds a `tagMap`. LLM translates text with placeholders. Injector restores real HTML from tagMap and sanitizes before innerHTML injection.

**Tech Stack:** TypeScript, Vitest (happy-dom), Chrome Extension MV3 (WXT)

**Spec:** `docs/superpowers/specs/2026-04-18-inline-structure-preservation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/types.ts` | Modify | Add `InlineTagMapping` interface, add `plainText` and `tagMap` to `Paragraph`, add `tagMap` to `translation-result` message |
| `lib/extractor.ts` | Modify | Replace `getTextPreservingBreaks` with `extractInlineHtml`, update `extractParagraphs` |
| `lib/prompts.ts` | Modify | Add placeholder preservation rule to `buildSystemPrompt` |
| `lib/injector.ts` | Modify | Add `restoreInlineTags`, `sanitizeHtml`, update `injectTranslation` signature |
| `entrypoints/background.ts` | Modify | Use `plainText` for language detection, pass `tagMap` in messages |
| `entrypoints/content.ts` | Modify | Pass `tagMap` to `injectTranslation`, update export to use `innerHTML` |
| `tests/extractor.test.ts` | Modify | Add tests for `extractInlineHtml` |
| `tests/injector.test.ts` | Modify | Add tests for `restoreInlineTags`, `sanitizeHtml`, tagMap injection |
| `tests/prompts.test.ts` | Modify | Add test for placeholder rule |

---

### Task 1: Types — Add `InlineTagMapping` and update `Paragraph` + Message

**Files:**
- Modify: `lib/types.ts:1-101`

- [ ] **Step 1: Add `InlineTagMapping` interface and update `Paragraph`**

In `lib/types.ts`, add the new interface after the `ActiveModel` interface (line 19), and update `Paragraph` (lines 36-41):

```typescript
// Add after line 19 (after ActiveModel interface)
export interface InlineTagMapping {
  placeholder: string
  tag: string
  attrs: Record<string, string>
}

// Replace the existing Paragraph interface (lines 36-41) with:
export interface Paragraph {
  id: string
  text: string
  plainText: string
  prev?: string
  next?: string
  tagName: string
  tagMap?: InlineTagMapping[]
}
```

- [ ] **Step 2: Update `translation-result` message type**

In the `Message` union (line 78), update the `translation-result` variant:

```typescript
// Replace line 78:
  | { action: 'translation-result'; paragraphId: string; translation: string; tagMap?: InlineTagMapping[] }
```

- [ ] **Step 3: Run type check**

Run: `npm run compile`
Expected: Type errors in extractor.ts, injector.ts, background.ts, content.ts (these files reference `Paragraph` and `translation-result` but don't yet supply the new fields). This is expected — we'll fix them in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add InlineTagMapping type and update Paragraph with plainText/tagMap"
```

---

### Task 2: Extractor — Replace text extraction with inline HTML extraction

**Files:**
- Modify: `lib/extractor.ts:1-110`
- Modify: `tests/extractor.test.ts:1-73`

- [ ] **Step 1: Write failing tests for `extractInlineHtml`**

Add to `tests/extractor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { extractParagraphs, shouldSkipNode, extractInlineHtml } from '../lib/extractor'

// Keep all existing tests, then add:

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/extractor.test.ts`
Expected: FAIL — `extractInlineHtml` is not exported

- [ ] **Step 3: Implement `extractInlineHtml` and update `extractParagraphs`**

Replace the contents of `lib/extractor.ts`:

```typescript
import type { Paragraph, ArticleMetadata, ExtractedArticle, InlineTagMapping } from './types'

const TEXT_BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION', 'DT', 'DD',
])

const SKIP_TAGS = new Set([
  'PRE', 'CODE', 'SCRIPT', 'STYLE', 'NOSCRIPT',
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
  'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME',
])

const INLINE_TAGS = new Set([
  'SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'U', 'BR', 'IMG',
  'SUB', 'SUP', 'MARK', 'ABBR', 'TIME', 'SMALL', 'S', 'DEL', 'INS',
])

const PRESERVE_INLINE_TAGS = new Set(['A', 'EM', 'STRONG', 'B', 'I', 'MARK'])

export function shouldSkipNode(el: Element): boolean {
  if (el.hasAttribute('data-contexta')) return true
  if (SKIP_TAGS.has(el.tagName)) return true
  if (el.closest('pre, code')) return true
  const text = el.textContent?.trim() ?? ''
  if (text.length === 0) return true
  return false
}

export function extractInlineHtml(el: Element): { text: string; plainText: string; tagMap: InlineTagMapping[] } {
  const tagMap: InlineTagMapping[] = []
  const counters: Record<string, number> = {}

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const childEl = node as Element
    const tag = childEl.tagName

    if (tag === 'BR') return '\n'

    if (PRESERVE_INLINE_TAGS.has(tag)) {
      const tagLower = tag.toLowerCase()
      counters[tagLower] = (counters[tagLower] || 0) + 1
      const placeholder = `${tagLower}${counters[tagLower]}`

      const attrs: Record<string, string> = {}
      for (const attr of childEl.attributes) {
        attrs[attr.name] = attr.value
      }

      tagMap.push({ placeholder, tag: tagLower, attrs })

      const inner = Array.from(childEl.childNodes).map(walk).join('')
      return `<${placeholder}>${inner}</${placeholder}>`
    }

    return Array.from(childEl.childNodes).map(walk).join('')
  }

  const text = Array.from(el.childNodes).map(walk).join('')
  const plainText = el.textContent?.trim() || ''

  return { text: text.trim(), plainText, tagMap }
}

function isLeafTextBlock(el: Element): boolean {
  for (const child of el.children) {
    if (INLINE_TAGS.has(child.tagName) || SKIP_TAGS.has(child.tagName)) continue
    if ((child.textContent?.trim() ?? '').length > 0) return false
  }
  return true
}

export function extractParagraphs(container: Element): Paragraph[] {
  const nodes: { el: Element; text: string; plainText: string; tagName: string; tagMap: InlineTagMapping[] }[] = []

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element
      if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT
      if (el.hasAttribute('data-contexta')) return NodeFilter.FILTER_REJECT
      if (TEXT_BLOCK_TAGS.has(el.tagName)) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_SKIP
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    const el = node as Element
    const { text, plainText, tagMap } = extractInlineHtml(el)
    if (plainText.length === 0) continue
    nodes.push({ el, text, plainText, tagName: el.tagName, tagMap })
  }

  // Fallback: sites like Twitter/X use div+span instead of semantic tags
  if (nodes.length === 0) {
    console.log('[Contexta] Semantic extraction empty, falling back to leaf text blocks')
    const fallbackWalker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const el = node as Element
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT
        if (el.hasAttribute('data-contexta')) return NodeFilter.FILTER_REJECT
        if (INLINE_TAGS.has(el.tagName)) return NodeFilter.FILTER_SKIP
        const text = el.textContent?.trim() ?? ''
        if (text.length === 0) return NodeFilter.FILTER_SKIP
        if (isLeafTextBlock(el)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      },
    })

    while ((node = fallbackWalker.nextNode())) {
      const el = node as Element
      const { text, plainText, tagMap } = extractInlineHtml(el)
      if (plainText.length === 0) continue
      nodes.push({ el, text, plainText, tagName: el.tagName, tagMap })
    }
    console.log(`[Contexta] Fallback extracted ${nodes.length} leaf text blocks`)
  }

  return nodes.map((n, i) => {
    const id = `ctx-${i}-${Date.now()}`
    n.el.setAttribute('data-contexta-id', id)
    return {
      id,
      text: n.text,
      plainText: n.plainText,
      tagName: n.tagName,
      tagMap: n.tagMap.length > 0 ? n.tagMap : undefined,
      prev: i > 0 ? nodes[i - 1].plainText : undefined,
      next: i < nodes.length - 1 ? nodes[i + 1].plainText : undefined,
    }
  })
}
```

- [ ] **Step 4: Update existing extractor tests for new `plainText` field**

The existing `extractParagraphs` tests reference `paragraphs[0].text` for plain text values. Now `text` may contain placeholders but `plainText` always has the plain text. Update the existing test that checks `.text`:

In `tests/extractor.test.ts`, in the `extractParagraphs` describe block, update the first test:

```typescript
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
```

Also update the `skips code blocks` test:

```typescript
  it('skips code blocks', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Before code.</p><pre><code>const x = 1;</code></pre><p>After code.</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].plainText).toBe('Before code.')
    expect(paragraphs[1].plainText).toBe('After code.')
  })
```

- [ ] **Step 5: Run all tests**

Run: `npm test -- tests/extractor.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/extractor.ts tests/extractor.test.ts
git commit -m "feat: extract inline HTML with placeholder tag mapping"
```

---

### Task 3: Prompts — Add placeholder preservation rule

**Files:**
- Modify: `lib/prompts.ts:1-35`
- Modify: `tests/prompts.test.ts:1-70`

- [ ] **Step 1: Write failing test**

Add to `tests/prompts.test.ts` inside the `buildSystemPrompt` describe block:

```typescript
  it('includes strict placeholder preservation rule', () => {
    const result = buildSystemPrompt('简体中文', '')
    expect(result).toContain('【严格】')
    expect(result).toContain('结构占位符')
    expect(result).toContain('原样保留')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/prompts.test.ts`
Expected: FAIL — prompt doesn't contain placeholder rule yet

- [ ] **Step 3: Update `buildSystemPrompt`**

In `lib/prompts.ts`, replace the `buildSystemPrompt` function:

```typescript
export function buildSystemPrompt(targetLang: string, presetRules: string): string {
  return `你是一位精通${targetLang}的专业翻译。翻译<source>标签内的文本为${targetLang}，仅输出译文。

规则：
- 技术术语、产品名、公司名保留英文原文
- 代码、变量名、命令、URL 不翻译
- 英文术语与中文之间加半角空格
- 仅输出译文，不要输出XML标签、解释或附加内容
- 【严格】文本中形如 <a1>...</a1>、<em1>...</em1> 的编号标签是结构占位符，必须原样保留在译文中。只翻译标签内外的文字，不得删除、修改、合并或新增任何占位符标签。占位符数量和嵌套关系必须与原文完全一致。
${presetRules ? '\n' + presetRules : ''}
<context>标签内是上下文，仅供参考，不要翻译。
策略：先直译确保完整，再意译使表达自然流畅。仅输出最终意译结果。`
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/prompts.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.ts
git commit -m "feat: add strict placeholder preservation rule to translation prompt"
```

---

### Task 4: Injector — Add `restoreInlineTags`, `sanitizeHtml`, update injection

**Files:**
- Modify: `lib/injector.ts:1-151`
- Modify: `tests/injector.test.ts:1-137`

- [ ] **Step 1: Write failing tests for `restoreInlineTags`**

Add to `tests/injector.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  injectTranslation,
  clearAllTranslations,
  switchDisplayMode,
  restoreInlineTags,
  sanitizeHtml,
} from '../lib/injector'
import type { InlineTagMapping } from '../lib/types'

// Keep all existing tests, then add:

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

  it('removes script tags and content', () => {
    const result = sanitizeHtml('safe <script>alert("xss")</script> text')
    expect(result).toBe('safe  text')
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/injector.test.ts`
Expected: FAIL — `restoreInlineTags` and `sanitizeHtml` not exported

- [ ] **Step 3: Implement `restoreInlineTags` and `sanitizeHtml`**

Add these functions to `lib/injector.ts` (before the `injectTranslation` function):

```typescript
import type { DisplayMode, InlineTagMapping } from './types'

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function restoreInlineTags(text: string, tagMap: InlineTagMapping[]): string {
  if (tagMap.length === 0) return text

  let html = text
  for (const { placeholder, tag, attrs } of tagMap) {
    const attrStr = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
      .join('')

    html = html.replace(new RegExp(`<${placeholder}>`, 'g'), `<${tag}${attrStr}>`)
    html = html.replace(new RegExp(`</${placeholder}>`, 'g'), `</${tag}>`)
  }
  return html
}

const ALLOWED_TAGS = new Set(['A', 'EM', 'STRONG', 'B', 'I', 'MARK', 'BR'])

export function sanitizeHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html

  function clean(parent: Node) {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element
        if (!ALLOWED_TAGS.has(el.tagName)) {
          el.replaceWith(...el.childNodes)
          continue
        }
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('on') || attr.value.startsWith('javascript:')) {
            el.removeAttribute(attr.name)
          }
        }
        clean(el)
      }
    }
  }

  clean(template.content)
  return template.innerHTML
}
```

- [ ] **Step 4: Run the new tests**

Run: `npm test -- tests/injector.test.ts`
Expected: `restoreInlineTags` and `sanitizeHtml` tests PASS, but existing `injectTranslation` tests may show type warnings (no failures yet since tagMap is optional)

- [ ] **Step 5: Update `injectTranslation` to accept and use `tagMap`**

Replace the `injectTranslation` function in `lib/injector.ts`:

```typescript
export function injectTranslation(
  paragraphId: string,
  translation: string,
  mode: DisplayMode,
  tagMap?: InlineTagMapping[],
): void {
  ensureStyles()
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const translated = document.createElement(original.tagName)
  if ((original as HTMLElement).className) {
    translated.className = (original as HTMLElement).className
  }

  if (tagMap && tagMap.length > 0) {
    const restored = restoreInlineTags(translation, tagMap)
    translated.innerHTML = sanitizeHtml(restored)
  } else if (translation.includes('\n')) {
    const safe = document.createElement('span')
    safe.textContent = translation
    translated.innerHTML = safe.innerHTML.replace(/\n/g, '<br>')
  } else {
    translated.textContent = translation
  }

  translated.setAttribute('data-contexta', 'translation')
  translated.setAttribute('data-contexta-for', paragraphId)

  original.insertAdjacentElement('afterend', translated)

  applyModeToElement(original as HTMLElement, translated, mode)
}
```

- [ ] **Step 6: Add test for `injectTranslation` with tagMap**

Add to the `injectTranslation` describe block in `tests/injector.test.ts`:

```typescript
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
```

Add the import for `InlineTagMapping` at the top of the test file (already done in step 1).

- [ ] **Step 7: Run all injector tests**

Run: `npm test -- tests/injector.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add lib/injector.ts tests/injector.test.ts
git commit -m "feat: add restoreInlineTags, sanitizeHtml, and tagMap support in injection"
```

---

### Task 5: Background — Use `plainText` for language detection, pass `tagMap`

**Files:**
- Modify: `entrypoints/background.ts:97-136`

- [ ] **Step 1: Update language detection to use `plainText`**

In `entrypoints/background.ts`, in `handleExtractResult` (line 101), change:

```typescript
    // Replace this line:
    if (isAlreadyTargetLang(paragraph.text, targetLang)) {
    // With:
    if (isAlreadyTargetLang(paragraph.plainText, targetLang)) {
```

- [ ] **Step 2: Pass `tagMap` in `translation-result` message**

In `handleExtractResult` (around line 120), update the sendToTab call:

```typescript
      await sendToTab(tabId, {
        action: 'translation-result',
        paragraphId: paragraph.id,
        translation,
        tagMap: paragraph.tagMap,
      })
```

- [ ] **Step 3: Pass `tagMap` in retry handler**

In `handleRetry` (around line 172), update the sendToTab call:

```typescript
      await sendToTab(tabId, {
        action: 'translation-result',
        paragraphId: paragraph.id,
        translation,
        tagMap: paragraph.tagMap,
      })
```

- [ ] **Step 4: Run type check**

Run: `npm run compile`
Expected: PASS (no type errors)

- [ ] **Step 5: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: use plainText for language detection and pass tagMap in messages"
```

---

### Task 6: Content Script — Wire up `tagMap` to injection and update export

**Files:**
- Modify: `entrypoints/content.ts:123-127` (handleTranslationResult)
- Modify: `entrypoints/content.ts:214-272` (buildExportMarkdown)

- [ ] **Step 1: Pass `tagMap` to `injectTranslation`**

In `entrypoints/content.ts`, update `handleTranslationResult` (line 123):

```typescript
    function handleTranslationResult(message: Extract<Message, { action: 'translation-result' }>) {
      removeLoading(message.paragraphId)
      removeError(message.paragraphId)
      injectTranslation(message.paragraphId, message.translation, currentMode, message.tagMap)
    }
```

- [ ] **Step 2: Update export to read `innerHTML` from translations**

In the `buildExportMarkdown` function, update the translation reading section (around line 233):

```typescript
      document.querySelectorAll('[data-contexta="translation"]').forEach(el => {
        const forId = el.getAttribute('data-contexta-for')
        if (!forId) return
        const translationHtml = (el as HTMLElement).innerHTML
        translatedParts.push(el.textContent || '')
        const origEl = document.querySelector(`[data-contexta-id="${forId}"]`)
        if (origEl) {
          textMap.set(normalize(origEl.textContent || ''), translationHtml)
        }
      })
```

- [ ] **Step 3: Update element replacement to use `innerHTML`**

In the same function, update the replacement logic (around line 256):

```typescript
          if (format === 'target-only') {
            el.innerHTML = translation
          } else {
            const tEl = doc.createElement(el.tagName)
            tEl.innerHTML = translation
            el.parentNode?.insertBefore(tEl, el.nextSibling)
          }
```

- [ ] **Step 4: Run type check**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add entrypoints/content.ts
git commit -m "feat: wire tagMap to injection and update export to preserve inline HTML"
```

---

### Task 7: Build verification and end-to-end smoke test

**Files:**
- No new files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npm run compile`
Expected: PASS with no errors

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds, output in `dist/chrome-mv3/`

- [ ] **Step 4: Commit any remaining changes**

If there are any uncommitted fixes from the build step:

```bash
git add -A
git commit -m "fix: address build issues"
```
