import type { DisplayMode } from './types'

export function injectTranslation(
  paragraphId: string,
  translation: string,
  mode: DisplayMode,
): void {
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const translated = document.createElement(original.tagName)
  translated.textContent = translation
  translated.setAttribute('data-contexta', 'translation')
  translated.setAttribute('data-contexta-for', paragraphId)

  original.insertAdjacentElement('afterend', translated)

  if (mode === 'target-only') {
    ;(original as HTMLElement).style.display = 'none'
  }
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
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const loading = document.createElement('div')
  loading.setAttribute('data-contexta', 'loading')
  loading.setAttribute('data-contexta-for', paragraphId)
  loading.style.cssText = 'color:#94a3b8;font-size:13px;padding:4px 0;'
  loading.textContent = '翻译中...'

  original.insertAdjacentElement('afterend', loading)
}

export function removeLoading(paragraphId: string): void {
  const loading = document.querySelector(`[data-contexta="loading"][data-contexta-for="${paragraphId}"]`)
  loading?.remove()
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
}

export function switchDisplayMode(mode: DisplayMode): void {
  const originals = document.querySelectorAll('[data-contexta-id]')
  originals.forEach((el) => {
    ;(el as HTMLElement).style.display = mode === 'target-only' ? 'none' : ''
  })

  const translations = document.querySelectorAll('[data-contexta="translation"]')
  translations.forEach((el) => {
    ;(el as HTMLElement).style.display = ''
  })
}
