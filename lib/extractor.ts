import type { Paragraph, ArticleMetadata, ExtractedArticle } from './types'

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

export function shouldSkipNode(el: Element): boolean {
  if (el.hasAttribute('data-contexta')) return true
  if (SKIP_TAGS.has(el.tagName)) return true
  if (el.closest('pre, code')) return true
  const text = el.textContent?.trim() ?? ''
  if (text.length === 0) return true
  return false
}

function getTextPreservingBreaks(el: Element): string {
  let text = ''
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element
      if (childEl.tagName === 'BR') {
        text += '\n'
      } else {
        text += getTextPreservingBreaks(childEl)
      }
    }
  }
  return text
}

function isLeafTextBlock(el: Element): boolean {
  for (const child of el.children) {
    if (INLINE_TAGS.has(child.tagName) || SKIP_TAGS.has(child.tagName)) continue
    if ((child.textContent?.trim() ?? '').length > 0) return false
  }
  return true
}

export function extractParagraphs(container: Element): Paragraph[] {
  const nodes: { el: Element; text: string; tagName: string }[] = []

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
    const text = getTextPreservingBreaks(el).trim()
    if (text.length === 0) continue
    nodes.push({ el, text, tagName: el.tagName })
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
      const text = getTextPreservingBreaks(el).trim()
      if (text.length === 0) continue
      nodes.push({ el, text, tagName: el.tagName })
    }
    console.log(`[Contexta] Fallback extracted ${nodes.length} leaf text blocks`)
  }

  return nodes.map((n, i) => {
    const id = `ctx-${i}-${Date.now()}`
    n.el.setAttribute('data-contexta-id', id)
    return {
      id,
      text: n.text,
      tagName: n.tagName,
      prev: i > 0 ? nodes[i - 1].text : undefined,
      next: i < nodes.length - 1 ? nodes[i + 1].text : undefined,
    }
  })
}
