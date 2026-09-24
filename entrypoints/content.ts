import { onMessage } from '@/lib/messages'
import { extractParagraphs } from '@/lib/extractor'
import { getSiteRule } from '@/lib/site-rules'
import {
  injectTranslation,
  injectError,
  injectLoading,
  removeLoading,
  removeError,
  clearAllTranslations,
  switchDisplayMode,
} from '@/lib/injector'
import {
  initSelectionTranslation,
  handleSelectionChunk,
  handleSelectionReasoning,
  handleSelectionDone,
  handleSelectionError,
} from '@/lib/selection'
import {
  initInputPolish,
  handlePolishChunk,
  handlePolishReasoning,
  handlePolishDone,
  handlePolishError,
} from '@/lib/input-polish'
import type { Message, DisplayMode, ExportFormat, ArticleMetadata } from '@/lib/types'

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let currentMode: DisplayMode = 'bilingual'
    let lastDefuddleHtml: string | null = null
    let lastMetadata: ArticleMetadata | null = null

    // Feed pages (site rules) keep adding content after the first extract:
    // infinite scroll, "show more replies", and X virtualizing cells — a tweet
    // scrolled far away is unmounted and comes back as a fresh, untranslated
    // node. The cache replays those without another LLM call.
    let feedObserver: MutationObserver | null = null
    let feedTimer: ReturnType<typeof setTimeout> | undefined
    const idToText = new Map<string, string>()
    const translationCache = new Map<string, string>()

    // Load saved display mode
    const stored = (await chrome.storage.local.get([
      'displayMode',
      'selectionEnabled',
      'inputPolishEnabled',
    ])) as {
      displayMode?: DisplayMode
      selectionEnabled?: boolean
      inputPolishEnabled?: boolean
    }
    if (stored.displayMode) currentMode = stored.displayMode
    let selectionEnabled = stored.selectionEnabled !== false
    let inputPolishEnabled = stored.inputPolishEnabled !== false

    onMessage((message) => {
      switch (message.action) {
        case 'extract':
          handleExtract().catch(console.error)
          return
        case 'translation-result':
          handleTranslationResult(message)
          return
        case 'translation-error':
          handleTranslationError(message)
          return
        case 'translation-progress':
          handleProgress(message)
          return
        case 'translation-complete':
          removeAllLoadingIndicators()
          return
        case 'clear-translations':
          stopFeedWatch()
          idToText.clear()
          translationCache.clear()
          clearAllTranslations()
          return
        case 'switch-mode':
          currentMode = message.mode
          switchDisplayMode(currentMode)
          return
        case 'selection-chunk':
          handleSelectionChunk(message.requestId, message.chunk)
          return
        case 'selection-reasoning':
          handleSelectionReasoning(message.requestId)
          return
        case 'selection-done':
          handleSelectionDone(message.requestId)
          return
        case 'selection-error':
          handleSelectionError(message.requestId, message.error)
          return
        case 'polish-chunk':
          handlePolishChunk(message.requestId, message.chunk)
          return
        case 'polish-reasoning':
          handlePolishReasoning(message.requestId)
          return
        case 'polish-done':
          handlePolishDone(message.requestId)
          return
        case 'polish-error':
          handlePolishError(message.requestId, message.error)
          return
        case 'build-export-markdown':
          // Returns Promise — onMessage wrapper will use sendResponse
          return buildExportMarkdown(message.format)
      }
    })

    initSelectionTranslation(() => selectionEnabled)
    initInputPolish(() => inputPolishEnabled)

    // Keep the toggles live so turning one off in Options takes effect without
    // reloading every open tab
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return
      if (changes.selectionEnabled) {
        selectionEnabled = changes.selectionEnabled.newValue !== false
      }
      if (changes.inputPolishEnabled) {
        inputPolishEnabled = changes.inputPolishEnabled.newValue !== false
      }
    })

    // Handle retry button clicks (event delegation)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const retryId = target.getAttribute('data-contexta-retry')
      if (retryId) {
        removeError(retryId)
        injectLoading(retryId)
        chrome.runtime.sendMessage({ action: 'retry-paragraph', paragraphId: retryId })
      }
    })

    async function handleExtract() {
      const { default: Defuddle } = await import('defuddle')
      const result = new Defuddle(document).parse()

      // Store for export
      lastDefuddleHtml = result.content

      console.log('[Contexta] Defuddle result:', {
        title: result.title,
        contentLength: result.content?.length,
        contentPreview: result.content?.substring(0, 200),
      })

      // Find the content area in the real DOM. A site rule names the content
      // blocks directly, so the whole page is the search scope.
      const siteRule = getSiteRule(location.hostname)
      const contentContainer = siteRule ? document.body : findContentContainer(result.content)
      if (!contentContainer) {
        chrome.runtime.sendMessage({
          action: 'translation-error',
          paragraphId: '',
          error: '无法识别正文区域',
        })
        return
      }

      console.log('[Contexta] Content container:', {
        tagName: contentContainer.tagName,
        className: (contentContainer as HTMLElement).className,
        id: contentContainer.id,
        childElementCount: contentContainer.childElementCount,
        textLength: contentContainer.textContent?.length,
      })

      const paragraphs = extractParagraphs(contentContainer, siteRule?.paragraphSelector)
      for (const p of paragraphs) idToText.set(p.id, p.plainText)
      if (siteRule) startFeedWatch(siteRule.paragraphSelector)

      lastMetadata = {
        title: result.title || document.title,
        author: result.author || undefined,
        published: result.published || undefined,
        url: location.href,
      }

      console.log('[Contexta] Extracted paragraphs:', paragraphs.length, paragraphs.map(p => ({
        id: p.id,
        tag: p.tagName,
        text: p.text.substring(0, 60),
      })))

      chrome.runtime.sendMessage({
        action: 'extract-result',
        article: {
          paragraphs,
          contentHtml: result.content,
          metadata: lastMetadata,
        },
      })
    }

    function startFeedWatch(selector: string) {
      stopFeedWatch()
      // Scoped to the page the user asked for: an SPA navigation shouldn't
      // silently keep spending tokens on every page they browse afterwards
      const startUrl = location.href
      feedObserver = new MutationObserver(() => {
        if (location.href !== startUrl) {
          stopFeedWatch()
          return
        }
        clearTimeout(feedTimer)
        feedTimer = setTimeout(() => translateNewParagraphs(selector), 500)
      })
      feedObserver.observe(document.body, { childList: true, subtree: true })
    }

    function stopFeedWatch() {
      feedObserver?.disconnect()
      feedObserver = null
      clearTimeout(feedTimer)
    }

    function translateNewParagraphs(selector: string) {
      // Our own injections also trigger the observer; they extract to nothing
      const fresh = extractParagraphs(document.body, selector)
      const toTranslate = []
      for (const p of fresh) {
        idToText.set(p.id, p.plainText)
        const cached = translationCache.get(p.plainText)
        if (cached !== undefined) {
          injectTranslation(p.id, cached, currentMode, p.tagMap)
        } else {
          toTranslate.push(p)
        }
      }
      if (toTranslate.length === 0) return
      console.log('[Contexta] Feed: translating', toTranslate.length, 'new paragraphs')
      chrome.runtime.sendMessage({ action: 'extract-more', paragraphs: toTranslate })
    }

    function handleTranslationResult(message: Extract<Message, { action: 'translation-result' }>) {
      const text = idToText.get(message.paragraphId)
      if (text !== undefined) translationCache.set(text, message.translation)
      removeLoading(message.paragraphId)
      removeError(message.paragraphId)
      injectTranslation(message.paragraphId, message.translation, currentMode, message.tagMap)
    }

    function handleTranslationError(message: Extract<Message, { action: 'translation-error' }>) {
      removeLoading(message.paragraphId)
      if (message.paragraphId) {
        injectError(message.paragraphId, message.error)
      }
    }

    function handleProgress(message: Extract<Message, { action: 'translation-progress' }>) {
      const { current } = message
      const article = document.querySelectorAll('[data-contexta-id]')
      if (current <= article.length) {
        const currentEl = article[current - 1]
        const id = currentEl.getAttribute('data-contexta-id')
        if (id && !document.querySelector(`[data-contexta-for="${id}"]`)) {
          injectLoading(id)
        }
      }
    }

    function removeAllLoadingIndicators() {
      document.querySelectorAll('[data-contexta="loading"]').forEach((el) => el.remove())
    }

    function findContentContainer(defuddleHtml: string): Element | null {
      // Prefer semantic <article> element — most blogs have exactly one
      const articles = document.querySelectorAll('article')
      console.log('[Contexta] Found <article> elements:', articles.length, Array.from(articles).map(a => ({
        className: (a as HTMLElement).className?.substring(0, 80),
        id: a.id,
        textLength: a.textContent?.length,
      })))
      if (articles.length === 1) return articles[0]

      // Multiple <article> elements: find the one containing Defuddle's content,
      // then expand to include sibling articles (thread/timeline pattern)
      if (articles.length > 1) {
        const temp = document.createElement('div')
        temp.innerHTML = defuddleHtml
        const snippet = Array.from(temp.querySelectorAll('p'))
          .map((el) => el.textContent?.trim())
          .find((t) => t && t.length > 30)
        let matchedArticle: Element | null = null
        if (snippet) {
          for (const article of articles) {
            if (article.textContent?.includes(snippet)) {
              matchedArticle = article
              break
            }
          }
        }

        // Use matched article or first article as starting point for expansion
        const startArticle = matchedArticle ?? articles[0]

        // Walk up to find ancestor containing multiple articles (e.g., Twitter thread)
        // Stop at section boundaries to avoid going too broad (e.g., blog sidebar)
        const SECTION_BOUNDARY = new Set(['MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'BODY'])
        let parent = startArticle.parentElement
        for (let i = 0; i < 8 && parent && !SECTION_BOUNDARY.has(parent.tagName); i++) {
          if (parent.querySelectorAll('article').length > 1) {
            console.log('[Contexta] Expanded container to include sibling articles:', {
              tagName: parent.tagName,
              articleCount: parent.querySelectorAll('article').length,
            })
            return parent
          }
          parent = parent.parentElement
        }
        return startArticle
      }

      // Fallback: heuristic matching via Defuddle snippets
      const temp = document.createElement('div')
      temp.innerHTML = defuddleHtml
      const snippets = Array.from(temp.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
        .map((el) => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 20)
        .slice(0, 5)

      if (snippets.length === 0) return document.body

      const candidates: Element[] = []
      for (const snippet of snippets) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let node: Node | null
        while ((node = walker.nextNode())) {
          if (node.textContent?.includes(snippet)) {
            const parent = node.parentElement?.closest('article, main, [role="main"], .post-content, .article-content, .entry-content, .content')
              ?? node.parentElement?.closest('div')
            if (parent) {
              candidates.push(parent)
              break
            }
          }
        }
      }

      if (candidates.length === 0) return document.body

      let ancestor = candidates[0]
      for (const candidate of candidates.slice(1)) {
        while (ancestor && !ancestor.contains(candidate)) {
          ancestor = ancestor.parentElement!
        }
      }

      return ancestor ?? document.body
    }

    async function buildExportMarkdown(
      format: ExportFormat,
    ): Promise<{ markdown: string; translatedText: string; metadata: ArticleMetadata | null }> {
      if (!lastDefuddleHtml || !lastMetadata) {
        return { markdown: '', translatedText: '', metadata: null }
      }

      const TurndownService = (await import('turndown')).default
      const { gfm } = await import('turndown-plugin-gfm')
      const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
      })
      turndown.use(gfm)

      // Read translations directly from the DOM
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
      const textMap = new Map<string, string>()
      const translatedParts: string[] = []

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

      const parser = new DOMParser()
      const doc = parser.parseFromString(lastDefuddleHtml, 'text/html')

      if (format !== 'source-only') {
        const TEXT_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, figcaption, dt, dd'
        const elements = doc.body.querySelectorAll(TEXT_SELECTOR)
        const processed = new Set<Element>()

        for (const el of elements) {
          // Skip descendants of already-processed blocks. Extractor captures both
          // outer cells (th/td) and inner blocks (p) when they nest, so the same
          // text lives at two depths. Replacing/injecting at both creates duplicate
          // or column-mismatched output. The outer block wins (documented order).
          let ancestor = el.parentElement
          let nested = false
          while (ancestor) {
            if (processed.has(ancestor)) { nested = true; break }
            ancestor = ancestor.parentElement
          }
          if (nested) continue

          const key = normalize(el.textContent || '')
          const translation = textMap.get(key)
          if (!translation) continue

          if (format === 'target-only') {
            el.innerHTML = translation
          } else {
            const tEl = doc.createElement(el.tagName)
            tEl.innerHTML = translation
            el.parentNode?.insertBefore(tEl, el.nextSibling)
          }
          processed.add(el)
        }
      }

      return {
        markdown: turndown.turndown(doc.body),
        translatedText: translatedParts.join('\n\n'),
        metadata: lastMetadata,
      }
    }
  },
})
