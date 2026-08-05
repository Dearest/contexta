/**
 * Selection translation UI: a green dot appears next to the selection, and
 * clicking it opens a popup that fills in as the translation streams.
 *
 * Everything lives inside a Shadow DOM so host page CSS can't reach it — sites
 * like GitHub and Medium have aggressive global styles that would otherwise
 * wreck the popup.
 */

const HOST_ID = 'contexta-selection-host'
const MIN_SELECTION_LENGTH = 2
const MAX_SELECTION_LENGTH = 5000
/** Repeated selections of the same text shouldn't cost another round trip */
const cache = new Map<string, string>()
const CACHE_LIMIT = 50

interface SelectionUI {
  host: HTMLElement
  root: ShadowRoot
  dot: HTMLElement
  popup: HTMLElement
  body: HTMLElement
  status: HTMLElement
  copyBtn: HTMLElement
}

let ui: SelectionUI | null = null
let pendingText = ''
let currentRequestId = ''
let accumulated = ''

const STYLE = `
:host { all: initial; }
.dot {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #059669;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.28);
  cursor: pointer;
  transition: transform .12s ease;
  z-index: 2147483647;
}
.dot:hover { transform: scale(1.25); }
.popup {
  position: absolute;
  /* Wide enough that Chinese text doesn't wrap every few characters */
  width: max-content;
  max-width: min(420px, calc(100vw - 24px));
  min-width: 320px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,.16);
  font: 14px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
        "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: #1f2937;
  z-index: 2147483647;
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  background: #f9fafb;
}
.status { font-size: 12px; color: #6b7280; }
.close {
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
}
.close:hover { background: #e5e7eb; color: #4b5563; }
.body {
  padding: 12px;
  max-height: 320px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.body.error { color: #dc2626; font-size: 13px; }
.body.hint { color: #9ca3af; font-size: 12px; font-style: normal; }
.foot {
  padding: 6px 12px 10px;
  display: flex;
  justify-content: flex-end;
}
.copy {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.copy:hover { background: #f3f4f6; color: #059669; }
.hidden { display: none !important; }
.caret::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 1em;
  background: #059669;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 1s steps(2, start) infinite;
}
@keyframes blink { to { visibility: hidden; } }
`

function buildUI(): SelectionUI {
  const host = document.createElement('div')
  host.id = HOST_ID
  // Fixed 0x0 anchor: children position themselves in page coordinates
  host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;'
  const root = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = STYLE

  const dot = document.createElement('div')
  dot.className = 'dot hidden'
  dot.title = '翻译选中内容'

  const popup = document.createElement('div')
  popup.className = 'popup hidden'
  popup.innerHTML = `
    <div class="head">
      <span class="status"></span>
      <button class="close" title="关闭">✕</button>
    </div>
    <div class="body"></div>
    <div class="foot"><button class="copy">复制译文</button></div>
  `

  root.append(style, dot, popup)
  document.documentElement.appendChild(host)

  return {
    host,
    root,
    dot,
    popup,
    body: popup.querySelector('.body') as HTMLElement,
    status: popup.querySelector('.status') as HTMLElement,
    copyBtn: popup.querySelector('.copy') as HTMLElement,
  }
}

function getUI(): SelectionUI {
  if (!ui || !ui.host.isConnected) ui = buildUI()
  return ui
}

function hideAll() {
  if (!ui) return
  ui.dot.classList.add('hidden')
  ui.popup.classList.add('hidden')
  currentRequestId = ''
}

/** Keep the popup inside the viewport horizontally */
function clampLeft(left: number, width: number): number {
  const max = window.scrollX + document.documentElement.clientWidth - width - 8
  return Math.max(window.scrollX + 8, Math.min(left, max))
}

function showDot(rect: DOMRect) {
  const u = getUI()
  u.popup.classList.add('hidden')
  u.dot.style.left = `${window.scrollX + rect.right + 6}px`
  u.dot.style.top = `${window.scrollY + rect.bottom + 4}px`
  u.dot.classList.remove('hidden')
}

function showPopup(rect: DOMRect) {
  const u = getUI()
  u.dot.classList.add('hidden')
  u.popup.classList.remove('hidden')
  u.body.classList.remove('error')
  u.popup.style.left = `${clampLeft(window.scrollX + rect.left, 420)}px`
  u.popup.style.top = `${window.scrollY + rect.bottom + 8}px`
}

function isInsideOwnUI(target: EventTarget | null): boolean {
  return target instanceof Node && !!ui?.host.contains(target)
}

/** Editing fields: users select text there to edit it, not to translate it */
function isEditable(node: Node | null): boolean {
  let el: Element | null = node instanceof Element ? node : (node?.parentElement ?? null)
  while (el) {
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true
    if (el instanceof HTMLElement && el.isContentEditable) return true
    el = el.parentElement
  }
  return false
}

function rememberInCache(text: string, translation: string) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(text, translation)
}

function renderResult(text: string, streaming: boolean) {
  const u = getUI()
  u.body.textContent = text
  u.body.classList.remove('hint') // real output supersedes the reasoning notice
  u.body.classList.toggle('caret', streaming)
  u.status.textContent = streaming ? '翻译中…' : '译文'
}

/**
 * Reasoning models stay silent on the text stream while they think. Without
 * this the popup shows a blinking caret over an empty box, which reads as a
 * hang — and the wait can be 20s+.
 */
export function handleSelectionReasoning(requestId: string) {
  if (requestId !== currentRequestId || accumulated) return
  const u = getUI()
  u.status.textContent = '模型思考中…'
  u.body.classList.remove('caret')
  u.body.textContent = '该模型会先推理再输出，建议在设置中把划词模型换成不带思考的快速模型'
  u.body.classList.add('hint')
}

export function handleSelectionChunk(requestId: string, chunk: string) {
  if (requestId !== currentRequestId) return // a newer request superseded this one
  accumulated += chunk
  renderResult(accumulated, true)
}

export function handleSelectionDone(requestId: string) {
  if (requestId !== currentRequestId) return
  renderResult(accumulated, false)
  if (accumulated.trim()) rememberInCache(pendingText, accumulated)
}

export function handleSelectionError(requestId: string, error: string) {
  if (requestId !== currentRequestId) return
  const u = getUI()
  u.body.classList.remove('caret')
  u.body.classList.add('error')
  u.body.textContent = error
  u.status.textContent = ''
}

function translate(rect: DOMRect, text: string) {
  showPopup(rect)
  pendingText = text

  const cached = cache.get(text)
  if (cached) {
    currentRequestId = ''
    accumulated = cached
    renderResult(cached, false)
    return
  }

  const requestId = `sel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  beginSelectionRequest(requestId)
  chrome.runtime.sendMessage({ action: 'translate-selection', requestId, text })
}

/** Marks a request as the live one; later chunks for other ids are ignored. */
export function beginSelectionRequest(requestId: string) {
  currentRequestId = requestId
  accumulated = ''
  renderResult('', true)
}

/** Test seam: read what the popup is currently showing. */
export function getSelectionUIState() {
  const u = getUI()
  return {
    status: u.status.textContent ?? '',
    body: u.body.textContent ?? '',
    isHint: u.body.classList.contains('hint'),
    isError: u.body.classList.contains('error'),
    streaming: u.body.classList.contains('caret'),
  }
}

export function initSelectionTranslation(isEnabled: () => boolean) {
  let lastRect: DOMRect | null = null

  document.addEventListener('mouseup', (e) => {
    if (!isEnabled() || isInsideOwnUI(e.target)) return

    // Let the browser finish updating the selection first
    setTimeout(() => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''

      if (
        !sel ||
        sel.isCollapsed ||
        text.length < MIN_SELECTION_LENGTH ||
        text.length > MAX_SELECTION_LENGTH ||
        isEditable(sel.anchorNode)
      ) {
        hideAll()
        return
      }

      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      lastRect = rect
      pendingText = text
      showDot(rect)
    }, 0)
  })

  document.addEventListener('mousedown', (e) => {
    if (isInsideOwnUI(e.target)) return
    hideAll()
  })

  // The popup is absolutely positioned in page coordinates, so scrolling keeps
  // it anchored to the text; only a resize can misplace it.
  window.addEventListener('resize', hideAll)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAll()
  })

  const u = getUI()

  u.dot.addEventListener('click', (e) => {
    e.stopPropagation()
    if (lastRect && pendingText) translate(lastRect, pendingText)
  })

  u.popup.querySelector('.close')?.addEventListener('click', hideAll)

  u.copyBtn.addEventListener('click', async () => {
    if (!accumulated) return
    await navigator.clipboard.writeText(accumulated).catch(() => {})
    u.copyBtn.textContent = '已复制'
    setTimeout(() => { u.copyBtn.textContent = '复制译文' }, 1200)
  })
}
