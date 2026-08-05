import { describe, it, expect, beforeEach } from 'vitest'
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

  it('shows a hint while a reasoning model is thinking', () => {
    beginSelectionRequest('r1')
    handleSelectionReasoning('r1')

    const state = getSelectionUIState()
    expect(state.status).toBe('模型思考中…')
    expect(state.isHint).toBe(true)
    expect(state.body).toContain('快速模型')
    // A blinking caret over hint text would read as broken output
    expect(state.streaming).toBe(false)
  })

  it('replaces the reasoning hint once real output arrives', () => {
    beginSelectionRequest('r1')
    handleSelectionReasoning('r1')
    handleSelectionChunk('r1', '真正的译文')

    const state = getSelectionUIState()
    expect(state.isHint).toBe(false)
    expect(state.body).toBe('真正的译文')
    expect(state.status).toBe('翻译中…')
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
