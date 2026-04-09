import type { DisplayMode } from './types'

// Inline spinner CSS (injected once)
let styleInjected = false
function ensureStyles() {
  if (styleInjected) return
  const style = document.createElement('style')
  style.setAttribute('data-contexta', 'styles')
  style.textContent = `
    @keyframes contexta-spin {
      to { transform: rotate(360deg); }
    }
    [data-contexta="spinner"] {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #a7f3d0;
      border-top-color: #059669;
      border-radius: 50%;
      animation: contexta-spin 0.6s linear infinite;
      margin-left: 6px;
      vertical-align: middle;
    }
    [data-contexta="translation"][data-contexta-bilingual] {
      border-top: 1px dashed #a7f3d0;
      padding-top: 4px;
      margin-top: 2px;
    }
  `
  document.head.appendChild(style)
  styleInjected = true
}

export function injectTranslation(
  paragraphId: string,
  translation: string,
  mode: DisplayMode,
): void {
  ensureStyles()
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const translated = document.createElement(original.tagName)
  translated.textContent = translation
  translated.setAttribute('data-contexta', 'translation')
  translated.setAttribute('data-contexta-for', paragraphId)

  original.insertAdjacentElement('afterend', translated)

  applyModeToElement(original as HTMLElement, translated, mode)
}

export function injectError(paragraphId: string, error: string): void {
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const existingError = document.querySelector(`[data-contexta="error"][data-contexta-for="${paragraphId}"]`)
  existingError?.remove()

  const errorEl = document.createElement('div')
  errorEl.setAttribute('data-contexta', 'error')
  errorEl.setAttribute('data-contexta-for', paragraphId)
  errorEl.style.cssText = 'color:#dc2626;font-size:13px;padding:4px 0;display:flex;align-items:center;gap:8px;'
  errorEl.innerHTML = `<span>翻译失败: ${error}</span><button data-contexta-retry="${paragraphId}" style="color:#059669;cursor:pointer;border:none;background:none;text-decoration:underline;font-size:13px;">重试</button>`

  original.insertAdjacentElement('afterend', errorEl)
}

export function injectLoading(paragraphId: string): void {
  ensureStyles()
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  // Don't add duplicate spinners
  if (original.querySelector('[data-contexta="spinner"]')) return

  const spinner = document.createElement('span')
  spinner.setAttribute('data-contexta', 'spinner')
  spinner.setAttribute('data-contexta-for', paragraphId)
  original.appendChild(spinner)
}

export function removeLoading(paragraphId: string): void {
  // Remove inline spinner from paragraph
  const spinner = document.querySelector(`[data-contexta="spinner"][data-contexta-for="${paragraphId}"]`)
  spinner?.remove()
}

export function removeError(paragraphId: string): void {
  const error = document.querySelector(`[data-contexta="error"][data-contexta-for="${paragraphId}"]`)
  error?.remove()
}

export function clearAllTranslations(): void {
  document.querySelectorAll('[data-contexta]').forEach((el) => el.remove())
  document.querySelectorAll('[data-contexta-id]').forEach((el) => {
    ;(el as HTMLElement).style.display = ''
    el.removeAttribute('data-contexta-id')
  })
  styleInjected = false
}

export function switchDisplayMode(mode: DisplayMode): void {
  document.querySelectorAll('[data-contexta-id]').forEach((el) => {
    const id = el.getAttribute('data-contexta-id')!
    const translated = document.querySelector(`[data-contexta="translation"][data-contexta-for="${id}"]`) as HTMLElement | null
    applyModeToElement(el as HTMLElement, translated, mode)
  })
}

function applyModeToElement(
  original: HTMLElement,
  translated: HTMLElement | null,
  mode: DisplayMode,
): void {
  switch (mode) {
    case 'source-only':
      original.style.display = ''
      if (translated) {
        translated.style.display = 'none'
        translated.removeAttribute('data-contexta-bilingual')
      }
      break
    case 'bilingual':
      original.style.display = ''
      if (translated) {
        translated.style.display = ''
        translated.setAttribute('data-contexta-bilingual', '')
      }
      break
    case 'target-only':
      original.style.display = 'none'
      if (translated) {
        translated.style.display = ''
        translated.removeAttribute('data-contexta-bilingual')
      }
      break
  }
}
