/**
 * Input polish: three spaces in a text field rewrite it into idiomatic English.
 *
 * The target case is mixed writing — English where the user is confident,
 * Chinese where they aren't — so this is closer to "finish my sentence" than
 * to grammar checking. See docs/input-polish.md for the full design.
 *
 * Lives in its own Shadow DOM host rather than sharing selection.ts's: the
 * anchoring rules and the panel contents have nothing in common, and sharing
 * would entangle two independent lifecycles. Colors are kept in sync by hand.
 */

import type { InputContext, PolishChange } from './types'
import { createPolishParser, type PolishParser } from './polish-parse'

const HOST_ID = 'contexta-polish-host'
const MIN_TEXT_LENGTH = 2
const MAX_TEXT_LENGTH = 5000

/** Three spaces must land inside this window to count as a trigger. */
const TAP_WINDOW_MS = 400
const TAP_COUNT = 3

/** Panel dwell time, extended a little for each change the user has to read. */
const FADE_BASE_MS = 6000
const FADE_PER_CHANGE_MS = 1500
const FADE_MAX_MS = 12000

const PANEL_WIDTH = 460

interface PolishUI {
  host: HTMLElement
  root: ShadowRoot
  panel: HTMLElement
  status: HTMLElement
  list: HTMLElement
  foot: HTMLElement
  recall: HTMLElement
}

interface ActiveRequest {
  requestId: string
  field: HTMLElement
  parser: PolishParser
  changes: PolishChange[]
  applied: boolean
  host: string
}

let ui: PolishUI | null = null
let active: ActiveRequest | null = null
/** Last completed result, for the recall dot — never triggers a new request. */
let lastResult: { field: HTMLElement; changes: PolishChange[] } | null = null
let fadeTimer: ReturnType<typeof setTimeout> | undefined

const STYLE = `
:host { all: initial; }
.panel {
  position: absolute;
  width: max-content;
  max-width: min(${PANEL_WIDTH}px, calc(100vw - 24px));
  min-width: 280px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,.16);
  font: 13px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
        "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: #1f2937;
  z-index: 2147483647;
  overflow: hidden;
  transition: opacity .25s ease;
}
.panel.leaving { opacity: 0; }
.status {
  padding: 8px 12px;
  font-size: 12px;
  color: #6b7280;
  border-bottom: 1px solid #f3f4f6;
  background: #f9fafb;
}
.status.error { color: #dc2626; background: #fef2f2; border-bottom-color: #fee2e2; }
.shimmer {
  height: 8px;
  border-radius: 4px;
  margin: 12px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: sweep 1.2s linear infinite;
}
.shimmer + .shimmer { width: 60%; }
@keyframes sweep { to { background-position: -200% 0; } }
.list { padding: 10px 12px; max-height: 300px; overflow-y: auto; }
.list:empty { display: none; }
.chg { margin-bottom: 10px; }
.chg:last-child { margin-bottom: 0; }
.pair { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.why { color: #6b7280; margin-top: 1px; }

/* New vocabulary — what the user could not write. Visually dominant on
   purpose: it carries the learning value. */
.chg.new .pair { font-size: 15px; }
.chg.new .src { color: #1f2937; font-weight: 500; }
.chg.new .tgt { color: #059669; font-weight: 600; }
.chg.new .why { font-size: 13px; }

/* Corrections to English the user did write. Present, but quieter. */
.chg.fix .pair { font-size: 13px; }
.chg.fix .src, .chg.fix .tgt, .chg.fix .arrow { color: #9ca3af; }
.chg.fix .tgt { color: #6b7280; font-weight: 500; }
.chg.fix .why { font-size: 12px; }

.arrow { color: #9ca3af; }
.divider { border-top: 1px solid #f3f4f6; margin: 10px 0; }
.foot {
  padding: 6px 12px 8px;
  font-size: 11px;
  color: #9ca3af;
  border-top: 1px solid #f3f4f6;
}
.foot:empty { display: none; }
.recall {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a7f3d0;
  cursor: pointer;
  z-index: 2147483647;
  transition: background .12s ease, transform .12s ease;
}
.recall::before { content: ''; position: absolute; inset: -8px; border-radius: 50%; }
.recall:hover { background: #059669; transform: scale(1.3); }
.hidden { display: none !important; }
`

function buildUI(): PolishUI {
  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;'
  const root = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = STYLE

  const panel = document.createElement('div')
  panel.className = 'panel hidden'
  panel.innerHTML = `
    <div class="status"></div>
    <div class="list"></div>
    <div class="foot"></div>
  `

  const recall = document.createElement('div')
  recall.className = 'recall hidden'
  recall.title = '再看一次上次的修改'

  root.append(style, panel, recall)
  document.documentElement.appendChild(host)

  // Keep focus in the text field when our UI is clicked, otherwise the blur
  // handler tears the UI down before the click can be handled.
  host.addEventListener('mousedown', (e) => e.preventDefault())

  return {
    host,
    root,
    panel,
    status: panel.querySelector('.status') as HTMLElement,
    list: panel.querySelector('.list') as HTMLElement,
    foot: panel.querySelector('.foot') as HTMLElement,
    recall,
  }
}

function getUI(): PolishUI {
  if (!ui || !ui.host.isConnected) ui = buildUI()
  return ui
}

// === Field handling ===

const ALLOWED_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', ''])

function isTextInput(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
}

/** The editable element a keystroke belongs to, or null if we should stay out. */
export function resolveField(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (target instanceof HTMLTextAreaElement) return target
  if (target instanceof HTMLInputElement) {
    return ALLOWED_INPUT_TYPES.has(target.type) ? target : null
  }
  if (target.isContentEditable) return target
  return null
}

function fieldText(el: HTMLElement): string {
  return isTextInput(el) ? el.value : (el.innerText ?? '')
}

/** Select everything in the field so execCommand replaces rather than inserts. */
function selectAll(el: HTMLElement) {
  el.focus()
  if (isTextInput(el)) {
    el.setSelectionRange(0, el.value.length)
    return
  }
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/**
 * Replace the field's contents, preserving the browser's native undo stack.
 *
 * `execCommand('insertText')` rather than `setRangeText`/`.value = …` for two
 * reasons that both matter here:
 *   1. It is the only path that keeps ⌘Z working. Cheap undo is what lets this
 *      feature skip a confirmation step and replace text outright.
 *   2. It dispatches a trusted `input` event, so controlled components (React,
 *      Vue, Lexical, ProseMirror) actually observe the change — assigning
 *      `.value` directly leaves React's state stale.
 *
 * Returns false when the editor refused the edit, so the caller can fall back
 * to the clipboard instead of silently doing nothing.
 */
export function replaceFieldContent(el: HTMLElement, text: string): boolean {
  selectAll(el)
  let ok = false
  try {
    ok = document.execCommand('insertText', false, text)
  } catch {
    ok = false
  }
  if (!ok) return false

  // Some editors accept the command but drop the payload; verify rather than trust
  const after = fieldText(el).replace(/\s+/g, ' ').trim()
  return after === text.replace(/\s+/g, ' ').trim()
}

function collectContext(el: HTMLElement, text: string): InputContext {
  const maxLength = isTextInput(el) && el.maxLength > 0 ? el.maxLength : null
  return {
    host: location.host,
    path: location.pathname,
    placeholder:
      (isTextInput(el) ? el.placeholder : el.getAttribute('aria-label')) ||
      el.getAttribute('data-placeholder') ||
      undefined,
    charsLeft: maxLength === null ? null : Math.max(0, maxLength - text.length),
  }
}

// === Panel rendering ===

function hidePanel(keepRecall = false) {
  clearTimeout(fadeTimer)
  if (!ui) return
  ui.panel.classList.add('hidden')
  ui.panel.classList.remove('leaving')
  if (!keepRecall) ui.recall.classList.add('hidden')
}

function teardown() {
  hidePanel()
  active = null
  lastResult = null
}

function pageRectOf(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return {
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    right: r.right + window.scrollX,
    bottom: r.bottom + window.scrollY,
  }
}

/**
 * Anchor above the field, aligned to its left edge — not to the caret, which
 * moves with every keystroke and would make the panel jitter.
 */
function positionPanel(field: HTMLElement) {
  const u = getUI()
  const rect = pageRectOf(field)
  const panelHeight = u.panel.offsetHeight || 120
  const maxLeft = window.scrollX + document.documentElement.clientWidth - PANEL_WIDTH - 8
  u.panel.style.left = `${Math.max(window.scrollX + 8, Math.min(rect.left, maxLeft))}px`

  const above = rect.top - panelHeight - 8
  // Flip below only when there genuinely isn't room above
  u.panel.style.top = above >= window.scrollY + 8 ? `${above}px` : `${rect.bottom + 8}px`
}

function positionRecall(field: HTMLElement) {
  const u = getUI()
  const rect = pageRectOf(field)
  u.recall.style.left = `${rect.right - 12}px`
  u.recall.style.top = `${rect.bottom - 12}px`
}

function showPending(field: HTMLElement) {
  const u = getUI()
  u.recall.classList.add('hidden')
  u.status.textContent = '润色中…'
  u.status.classList.remove('error')
  u.list.innerHTML = '<div class="shimmer"></div><div class="shimmer"></div>'
  u.foot.textContent = ''
  u.panel.classList.remove('hidden', 'leaving')
  positionPanel(field)
}

function renderChanges(changes: PolishChange[], streaming: boolean) {
  const u = getUI()
  u.list.innerHTML = ''

  // Gaps first and loud, corrections after and quiet. Both are shown — the
  // ordering steers attention without deciding for the user what to skip.
  const gaps = changes.filter((c) => c.kind !== 'fix')
  const fixes = changes.filter((c) => c.kind === 'fix')

  const append = (change: PolishChange) => {
    const row = document.createElement('div')
    row.className = `chg ${change.kind === 'fix' ? 'fix' : 'new'}`

    const pair = document.createElement('div')
    pair.className = 'pair'
    if (change.source) {
      const src = document.createElement('span')
      src.className = 'src'
      src.textContent = change.source
      const arrow = document.createElement('span')
      arrow.className = 'arrow'
      arrow.textContent = '→'
      pair.append(src, arrow)
    } else {
      const arrow = document.createElement('span')
      arrow.className = 'arrow'
      arrow.textContent = '+'
      pair.append(arrow)
    }
    const tgt = document.createElement('span')
    tgt.className = 'tgt'
    tgt.textContent = change.target
    pair.append(tgt)
    row.append(pair)

    if (change.reason) {
      const why = document.createElement('div')
      why.className = 'why'
      why.textContent = change.reason
      row.append(why)
    }
    u.list.append(row)
  }

  gaps.forEach(append)
  if (gaps.length && fixes.length) {
    const divider = document.createElement('div')
    divider.className = 'divider'
    u.list.append(divider)
  }
  fixes.forEach(append)

  if (streaming) {
    u.status.textContent = '润色中…'
  } else if (changes.length) {
    const n = gaps.length
    u.status.textContent = n ? `已替换 · ${n} 个新表达` : '已替换'
  } else {
    u.status.textContent = '已替换 · 无修改说明'
  }
}

function showError(message: string) {
  const u = getUI()
  u.status.textContent = message
  u.status.classList.add('error')
  u.list.innerHTML = ''
  u.foot.textContent = ''
  u.panel.classList.remove('hidden')
  scheduleFade(0)
}

/**
 * Dwell timing starts when the stream ends, not when the panel opens —
 * otherwise half the countdown burns while content is still arriving.
 */
function scheduleFade(changeCount: number) {
  clearTimeout(fadeTimer)
  const delay = Math.min(FADE_BASE_MS + changeCount * FADE_PER_CHANGE_MS, FADE_MAX_MS)
  fadeTimer = setTimeout(() => {
    const u = getUI()
    u.panel.classList.add('leaving')
    setTimeout(() => {
      u.panel.classList.add('hidden')
      u.panel.classList.remove('leaving')
      if (lastResult?.field) {
        positionRecall(lastResult.field)
        u.recall.classList.remove('hidden')
      }
    }, 250)
  }, delay)
}

// === Message handlers (called from the content script) ===

export function handlePolishReasoning(requestId: string) {
  if (!active || active.requestId !== requestId) return
  getUI().status.textContent = '模型思考中…'
}

export function handlePolishChunk(requestId: string, chunk: string) {
  if (!active || active.requestId !== requestId) return
  const { bodyDone, changes } = active.parser.push(chunk)

  // Apply as soon as the separator arrives, without waiting for explanations
  if (bodyDone !== undefined && !active.applied) applyBody(bodyDone)

  if (changes.length) {
    active.changes.push(...changes)
    renderChanges(active.changes, true)
  }
}

export function handlePolishDone(requestId: string) {
  if (!active || active.requestId !== requestId) return
  const { bodyDone, changes } = active.parser.finish()
  if (bodyDone !== undefined && !active.applied) applyBody(bodyDone)
  if (changes.length) active.changes.push(...changes)

  renderChanges(active.changes, false)
  positionPanel(active.field)
  lastResult = { field: active.field, changes: active.changes }

  recordGaps(active)
  scheduleFade(active.changes.length)
  active = null
}

export function handlePolishError(requestId: string, error: string) {
  if (!active || active.requestId !== requestId) return
  showError(error)
  active = null
}

function applyBody(body: string) {
  if (!active || !body.trim()) return
  active.applied = true

  const ok = replaceFieldContent(active.field, body)
  if (ok) return

  // The editor rejected the edit — hand the text over rather than lose it
  navigator.clipboard.writeText(body).catch(() => {})
  const u = getUI()
  u.foot.textContent = '此输入框不支持直接替换，结果已复制到剪贴板'
}

function recordGaps(req: ActiveRequest) {
  if (!req.changes.length) return
  // The messaging API disappears when the extension reloads while a page stays
  // open. Logging is the last thing that should surface such a failure.
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return

  const date = new Date().toISOString().slice(0, 10)
  // Fire-and-forget: a logging failure must never interrupt writing
  chrome.runtime
    .sendMessage({
      action: 'record-gap',
      entries: req.changes.map((c) => ({
        date,
        kind: c.kind,
        source: c.source,
        target: c.target,
        reason: c.reason,
        host: req.host,
      })),
    })
    .catch(() => {})
}

// === Trigger ===

/** Marks a request as the live one; chunks for any other id are dropped. */
export function beginPolishRequest(requestId: string, field: HTMLElement) {
  active = {
    requestId,
    field,
    parser: createPolishParser(),
    changes: [],
    applied: false,
    host: location.host,
  }
  lastResult = null
  showPending(field)
}

function trigger(field: HTMLElement) {
  // The two spaces that slipped through before the third are noise
  const text = fieldText(field).replace(/\s+$/, '')
  if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH) return

  const requestId = `pol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  beginPolishRequest(requestId, field)

  chrome.runtime.sendMessage({
    action: 'polish-input',
    requestId,
    text,
    context: collectContext(field, text),
  })
}

export function initInputPolish(isEnabled: () => boolean) {
  let taps: number[] = []

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        hidePanel(true)
        return
      }

      if (e.key !== ' ') {
        taps = []
        // Any other keystroke means the user has moved on; the panel has served
        // its purpose. This is a better signal than any timer.
        if (!active) hidePanel(true)
        return
      }

      // An IME composing spaces is selecting candidates, not typing separators.
      // Without this the feature fires constantly for Chinese-input users.
      if (e.isComposing || e.keyCode === 229) {
        taps = []
        return
      }

      if (!isEnabled()) return
      const field = resolveField(e.target)
      if (!field) {
        taps = []
        return
      }

      const now = performance.now()
      taps = taps.filter((t) => now - t < TAP_WINDOW_MS)
      taps.push(now)
      if (taps.length < TAP_COUNT) return

      taps = []
      e.preventDefault()
      trigger(field)
    },
    true,
  )

  document.addEventListener(
    'blur',
    (e) => {
      if (resolveField(e.target)) teardown()
    },
    true,
  )

  window.addEventListener('resize', () => hidePanel())

  const u = getUI()

  // Hovering means "I'm still reading" — hold the panel until the pointer leaves
  u.panel.addEventListener('mouseenter', () => clearTimeout(fadeTimer))
  u.panel.addEventListener('mouseleave', () => {
    if (!active && lastResult) scheduleFade(lastResult.changes.length)
  })

  u.recall.addEventListener('click', () => {
    if (!lastResult) return
    renderChanges(lastResult.changes, false)
    u.foot.textContent = ''
    u.recall.classList.add('hidden')
    u.panel.classList.remove('hidden', 'leaving')
    positionPanel(lastResult.field)
    scheduleFade(lastResult.changes.length)
  })
}

/** Test seam: what the panel is currently showing. */
export function getPolishUIState() {
  const u = getUI()
  return {
    status: u.status.textContent ?? '',
    visible: !u.panel.classList.contains('hidden'),
    changeCount: u.list.querySelectorAll('.chg').length,
    newCount: u.list.querySelectorAll('.chg.new').length,
    fixCount: u.list.querySelectorAll('.chg.fix').length,
    foot: u.foot.textContent ?? '',
    recallVisible: !u.recall.classList.contains('hidden'),
  }
}
