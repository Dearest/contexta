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

const PRESERVE_INLINE_TAGS = new Set(['A', 'EM', 'STRONG', 'B', 'I', 'MARK', 'CODE'])

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
    let result = ''
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as Element
        const tag = childEl.tagName

        if (SKIP_TAGS.has(tag) && !PRESERVE_INLINE_TAGS.has(tag)) {
          continue
        } else if (tag === 'BR') {
          result += '\n'
        } else if (PRESERVE_INLINE_TAGS.has(tag) || (tag === 'SPAN' && (childEl.hasAttribute('style') || childEl.hasAttribute('class')))) {
          const tagLower = tag.toLowerCase()
          counters[tagLower] = (counters[tagLower] || 0) + 1
          const placeholder = `${tagLower}${counters[tagLower]}`

          // Collect attributes
          const attrs: Record<string, string> = {}
          for (const attr of childEl.attributes) {
            attrs[attr.name] = attr.value
          }

          tagMap.push({ placeholder, tag: tagLower, attrs })
          const innerText = walk(childEl)
          result += `<${placeholder}>${innerText}</${placeholder}>`
        } else {
          // Non-preserved inline tags (SPAN, etc.): pass through child content
          result += walk(childEl)
        }
      }
    }
    return result
  }

  const text = walk(el).trim()
  const plainText = el.textContent?.trim() ?? ''

  return { text, plainText, tagMap }
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
    if (text.length === 0) continue
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
      if (text.length === 0) continue
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
