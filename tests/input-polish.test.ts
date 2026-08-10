import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  beginPolishRequest,
  handlePolishChunk,
  handlePolishDone,
  handlePolishError,
  handlePolishReasoning,
  getPolishUIState,
  replaceFieldContent,
  resolveField,
} from '../lib/input-polish'

/**
 * happy-dom has no execCommand, and the real one can't be exercised headlessly
 * anyway. The stub mirrors what a well-behaved editor does: replace the current
 * selection with the text.
 */
function stubExecCommand(behaviour: (text: string) => boolean) {
  const fn = vi.fn((_cmd: string, _ui: boolean, text: string) => behaviour(text))
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true })
  return fn
}

function makeTextarea(value: string): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  el.value = value
  document.body.appendChild(el)
  return el
}

describe('input polish panel', () => {
  let field: HTMLTextAreaElement

  beforeEach(() => {
    document.getElementById('contexta-polish-host')?.remove()
    document.body.innerHTML = ''
    field = makeTextarea('I want to 确保 this feature 正常工作')
    stubExecCommand((text) => {
      field.value = text
      return true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces the field as soon as the separator arrives', () => {
    beginPolishRequest('p1', field)
    handlePolishChunk('p1', 'I want to ensure this feature works properly\n---\n')

    // Applied without waiting for any of the explanations
    expect(field.value).toBe('I want to ensure this feature works properly')
    expect(getPolishUIState().changeCount).toBe(0)
  })

  it('renders gaps and corrections as separate visual tiers', () => {
    beginPolishRequest('p1', field)
    handlePolishChunk(
      'p1',
      [
        'polished text',
        '---',
        '确保 | ensure | 语气更确定',
        '正常工作 | works properly | 英文用副词',
        '~ can work | works | 去掉情态动词',
        '',
      ].join('\n'),
    )
    handlePolishDone('p1')

    const state = getPolishUIState()
    expect(state.newCount).toBe(2)
    expect(state.fixCount).toBe(1)
    // The status counts only gaps — corrections are shown but not tallied
    expect(state.status).toBe('已替换 · 2 个新表达')
  })

  it('ignores chunks from a superseded request', () => {
    beginPolishRequest('p1', field)
    handlePolishChunk('p1', 'first version\n---\n确保 | ensure | 理由\n')

    beginPolishRequest('p2', field)
    handlePolishChunk('p1', '正常工作 | works | 过期内容\n')
    handlePolishChunk('p2', 'second version\n---\n')
    handlePolishDone('p2')

    expect(field.value).toBe('second version')
    expect(getPolishUIState().changeCount).toBe(0)
  })

  it('falls back to the clipboard when the editor refuses the edit', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    stubExecCommand(() => false)

    beginPolishRequest('p1', field)
    handlePolishChunk('p1', 'polished result\n---\n')

    expect(writeText).toHaveBeenCalledWith('polished result')
    expect(getPolishUIState().foot).toContain('已复制到剪贴板')
  })

  it('detects a silent no-op from an editor that accepts but ignores the command', () => {
    // Some editors return true and change nothing; trusting the return value
    // would leave the user staring at unchanged text with a success message
    stubExecCommand(() => true)

    expect(replaceFieldContent(field, 'brand new text')).toBe(false)
  })

  it('surfaces errors instead of leaving the panel spinning', () => {
    beginPolishRequest('p1', field)
    handlePolishError('p1', 'API Key 无效')

    const state = getPolishUIState()
    expect(state.status).toBe('API Key 无效')
    expect(state.visible).toBe(true)
  })

  it('explains the wait while a reasoning model is still thinking', () => {
    beginPolishRequest('p1', field)
    handlePolishReasoning('p1')

    expect(getPolishUIState().status).toBe('模型思考中…')
  })

  it('offers a recall dot after the panel fades', () => {
    vi.useFakeTimers()
    beginPolishRequest('p1', field)
    handlePolishChunk('p1', 'polished\n---\n确保 | ensure | 更正式\n')
    handlePolishDone('p1')

    expect(getPolishUIState().recallVisible).toBe(false)
    vi.advanceTimersByTime(30_000)
    expect(getPolishUIState().recallVisible).toBe(true)
  })

  it('still replaces text when the model omits the separator entirely', () => {
    beginPolishRequest('p1', field)
    handlePolishChunk('p1', 'a polished sentence with no change list')
    handlePolishDone('p1')

    expect(field.value).toBe('a polished sentence with no change list')
    expect(getPolishUIState().status).toBe('已替换 · 无修改说明')
  })
})

describe('field eligibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('accepts textareas and text-like inputs', () => {
    const textarea = document.createElement('textarea')
    const text = document.createElement('input')
    text.type = 'text'
    const search = document.createElement('input')
    search.type = 'search'

    expect(resolveField(textarea)).toBe(textarea)
    expect(resolveField(text)).toBe(text)
    expect(resolveField(search)).toBe(search)
  })

  it('stays out of password and non-text inputs', () => {
    const password = document.createElement('input')
    password.type = 'password'
    const number = document.createElement('input')
    number.type = 'number'

    expect(resolveField(password)).toBeNull()
    expect(resolveField(number)).toBeNull()
  })

  it('ignores ordinary page elements', () => {
    expect(resolveField(document.createElement('div'))).toBeNull()
    expect(resolveField(null)).toBeNull()
  })
})
