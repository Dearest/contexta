import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  beginSelectionRequest,
  handleSelectionChunk,
  handleSelectionReasoning,
  handleSelectionDone,
  handleSelectionError,
  getSelectionUIState,
} from '../lib/selection'

describe('selection popup streaming', () => {
  beforeEach(() => {
    document.getElementById('contexta-selection-host')?.remove()
  })

  it('accumulates chunks in order', () => {
    beginSelectionRequest('r1')
    handleSelectionChunk('r1', '计算机')
    handleSelectionChunk('r1', '科学')

    const state = getSelectionUIState()
    expect(state.body).toBe('计算机科学')
    expect(state.streaming).toBe(true)
    expect(state.status).toBe('翻译中…')
  })

  it('marks the result final when done', () => {
    beginSelectionRequest('r1')
    handleSelectionChunk('r1', '译文内容')
    handleSelectionDone('r1')

    const state = getSelectionUIState()
    expect(state.streaming).toBe(false)
    expect(state.status).toBe('译文')
  })

  it('ignores chunks from a superseded request', () => {
    beginSelectionRequest('r1')
    handleSelectionChunk('r1', 'first')
    beginSelectionRequest('r2')
    handleSelectionChunk('r1', ' stale')
    handleSelectionChunk('r2', 'second')

    expect(getSelectionUIState().body).toBe('second')
  })

  it('says the model is thinking without nagging about model choice', () => {
    beginSelectionRequest('r1')
    handleSelectionReasoning('r1')

    const state = getSelectionUIState()
    expect(state.status).toBe('模型思考中…')
    // Most reasoning models finish in 2-3s; suggesting a swap here is noise
    expect(state.isHint).toBe(false)
  })

  it('keeps the thinking status until real output arrives', () => {
    beginSelectionRequest('r1')
    handleSelectionReasoning('r1')
    handleSelectionChunk('r1', '真正的译文')

    const state = getSelectionUIState()
    expect(state.isHint).toBe(false)
    expect(state.body).toBe('真正的译文')
    expect(state.status).toBe('翻译中…')
  })

  it('suggests a faster model only after prolonged silence', async () => {
    vi.useFakeTimers()
    try {
      beginSelectionRequest('r1')
      handleSelectionReasoning('r1')
      expect(getSelectionUIState().isHint).toBe(false)

      vi.advanceTimersByTime(5000)

      const state = getSelectionUIState()
      expect(state.isHint).toBe(true)
      expect(state.body).toContain('更快')
      // A blinking caret over hint text would read as broken output
      expect(state.streaming).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not suggest a faster model once output has started', () => {
    vi.useFakeTimers()
    try {
      beginSelectionRequest('r1')
      handleSelectionChunk('r1', '已经有输出了')
      vi.advanceTimersByTime(10000)

      const state = getSelectionUIState()
      expect(state.isHint).toBe(false)
      expect(state.body).toBe('已经有输出了')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire a stale slow hint after the request is superseded', () => {
    vi.useFakeTimers()
    try {
      beginSelectionRequest('r1')
      beginSelectionRequest('r2')
      handleSelectionChunk('r2', '新的译文')
      vi.advanceTimersByTime(10000)

      expect(getSelectionUIState().body).toBe('新的译文')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not show the reasoning hint after text has started', () => {
    beginSelectionRequest('r1')
    handleSelectionChunk('r1', '已经开始输出')
    handleSelectionReasoning('r1')

    expect(getSelectionUIState().body).toBe('已经开始输出')
  })

  it('ignores a reasoning notice from a superseded request', () => {
    beginSelectionRequest('r1')
    beginSelectionRequest('r2')
    handleSelectionReasoning('r1')

    expect(getSelectionUIState().isHint).toBe(false)
  })

  it('renders errors', () => {
    beginSelectionRequest('r1')
    handleSelectionError('r1', 'API Key 无效')

    const state = getSelectionUIState()
    expect(state.isError).toBe(true)
    expect(state.body).toBe('API Key 无效')
    expect(state.streaming).toBe(false)
  })

  it('ignores errors from a superseded request', () => {
    beginSelectionRequest('r1')
    beginSelectionRequest('r2')
    handleSelectionError('r1', '过期的错误')

    expect(getSelectionUIState().isError).toBe(false)
  })
})
