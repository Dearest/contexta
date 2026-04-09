import { onMessage } from '@/lib/messages'
import { extractParagraphs } from '@/lib/extractor'
import {
  injectTranslation,
  injectError,
  injectLoading,
  removeLoading,
  removeError,
  clearAllTranslations,
  switchDisplayMode,
} from '@/lib/injector'
import type { Message, DisplayMode } from '@/lib/types'

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let currentMode: DisplayMode = 'bilingual'

    // Load saved display mode
    const stored = await chrome.storage.local.get('displayMode')
    if (stored.displayMode) currentMode = stored.displayMode

    onMessage(async (message) => {
      switch (message.action) {
        case 'extract':
          return handleExtract()
        case 'translation-result':
          return handleTranslationResult(message)
        case 'translation-error':
          return handleTranslationError(message)
        case 'translation-progress':
          return handleProgress(message)
        case 'translation-complete':
          removeAllLoadingIndicators()
          return
        case 'clear-translations':
          clearAllTranslations()
          return
        case 'switch-mode':
          currentMode = message.mode
          switchDisplayMode(currentMode)
          return
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
      const clonedDoc = document.cloneNode(true) as Document
      const result = new Defuddle(clonedDoc).parse()

      // Find the content area in the real DOM
      const contentContainer = findContentContainer(result.content)
      if (!contentContainer) {
        chrome.runtime.sendMessage({
          action: 'translation-error',
          paragraphId: '',
          error: '无法识别正文区域',
        })
        return
      }

      const paragraphs = extractParagraphs(contentContainer)

      chrome.runtime.sendMessage({
        action: 'extract-result',
        article: {
          paragraphs,
          metadata: {
            title: result.title || document.title,
            author: result.author || undefined,
            published: result.published || undefined,
            url: location.href,
          },
        },
      })
    }

    function handleTranslationResult(message: Extract<Message, { action: 'translation-result' }>) {
      removeLoading(message.paragraphId)
      removeError(message.paragraphId)
      injectTranslation(message.paragraphId, message.translation, currentMode)
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
      // Parse Defuddle output to get text snippets for matching
      const temp = document.createElement('div')
      temp.innerHTML = defuddleHtml
      const snippets = Array.from(temp.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
        .map((el) => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 20)
        .slice(0, 5)

      if (snippets.length === 0) return document.body

      // Find elements containing these snippets in the real DOM
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

      // Find common ancestor
      let ancestor = candidates[0]
      for (const candidate of candidates.slice(1)) {
        while (ancestor && !ancestor.contains(candidate)) {
          ancestor = ancestor.parentElement!
        }
      }

      return ancestor ?? document.body
    }
  },
})
