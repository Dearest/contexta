import { useState, useMemo } from 'react'
import type { Provider, ActiveModel, ModelInfo, TestResult } from '@/lib/types'

interface Props {
  provider: Provider
  activeModel: ActiveModel | null
  quickModel: ActiveModel | null
  onUpdate: (provider: Provider) => void
  onSetActive: (providerId: string, modelId: string) => void
  onSetQuick: (providerId: string, modelId: string) => void
  onDelete?: (providerId: string) => void
  onFlush: () => Promise<void>
  expanded: boolean
  onToggle: () => void
}

const MODEL_LIST_LIMIT = 40

export default function ProviderForm({ provider, activeModel, quickModel, onUpdate, onSetActive, onSetQuick, onDelete, onFlush, expanded, onToggle }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelFilter, setModelFilter] = useState('')
  /** Which field the fetched model list currently fills in */
  const [pickerTarget, setPickerTarget] = useState<'main' | 'quick' | null>(null)
  const [fetchError, setFetchError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Model name lives on the provider, so it survives switching between
  // providers and page reloads without needing to be "activated" first.
  const modelId = provider.modelId ?? ''
  const quickModelId = provider.quickModelId ?? ''
  /** Selection translation falls back to the main model when left blank */
  const effectiveQuickId = (quickModelId.trim() || modelId.trim())

  const isActive = activeModel?.providerId === provider.id
  const isActiveWithThisModel = isActive && activeModel?.modelId === modelId.trim()
  const isQuick = quickModel?.providerId === provider.id
  const isQuickWithThisModel = isQuick && quickModel?.modelId === effectiveQuickId

  // Collapsed rows need to convey config state at a glance
  const summary = !provider.apiKey.trim()
    ? '未配置'
    : modelId.trim() || '未设置模型'

  const filteredModels = useMemo(() => {
    const q = modelFilter.trim().toLowerCase()
    return q ? models.filter((m) => m.id.toLowerCase().includes(q)) : models
  }, [models, modelFilter])

  function setModelId(value: string) {
    setTestResult(null)
    onUpdate({ ...provider, modelId: value })
  }

  function setQuickModelId(value: string) {
    onUpdate({ ...provider, quickModelId: value })
  }

  interface ModelFieldProps {
    label: string
    hint: string
    target: 'main' | 'quick'
    value: string
    onChange: (value: string) => void
    placeholder: string
  }

  /** Both model fields share one fetched list; pickerTarget says which one the
   *  chips write into. */
  function renderModelField({ label, hint, target, value, onChange, placeholder }: ModelFieldProps) {
    const listOpen = pickerTarget === target && models.length > 0
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">{label}</label>
          <button
            className="text-xs text-primary bg-transparent border-none cursor-pointer hover:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => (listOpen ? setPickerTarget(null) : handleFetchModels(target))}
            disabled={fetching || !provider.apiKey.trim() || !provider.baseUrl.trim()}
          >
            {fetching && pickerTarget === target ? '获取中...' : listOpen ? '收起' : '选择模型'}
          </button>
        </div>

        <input
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-gray-400 mt-1">{hint}</p>

        {listOpen && (
          <div className="mt-2">
            <input
              className="w-full px-2 py-1 mb-1.5 border border-gray-200 rounded-md text-xs outline-none focus:border-primary"
              type="text"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder={`搜索 ${models.length} 个模型`}
            />
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {filteredModels.slice(0, MODEL_LIST_LIMIT).map((m) => (
                <button
                  key={m.id}
                  className={`px-2 py-1 rounded-md text-xs border-none cursor-pointer transition-colors ${
                    value === m.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => { onChange(m.id); setPickerTarget(null) }}
                >
                  {m.id}
                </button>
              ))}
            </div>
            {filteredModels.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">没有匹配的模型</p>
            )}
            {filteredModels.length > MODEL_LIST_LIMIT && (
              <p className="text-xs text-gray-400 mt-1">
                还有 {filteredModels.length - MODEL_LIST_LIMIT} 个，请用上方搜索缩小范围
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  async function handleFetchModels(target: 'main' | 'quick') {
    setFetching(true)
    setFetchError('')
    setPickerTarget(target)
    setModelFilter('')
    try {
      await onFlush()
      const response = await chrome.runtime.sendMessage({
        action: 'fetch-models',
        providerId: provider.id,
      })
      if (response?.error) {
        setFetchError(response.error)
        setModels([])
        setPickerTarget(null)
      } else {
        setModels(response?.models ?? [])
        setFetchError('')
      }
    } catch {
      setFetchError('获取失败，请检查 API Key 和网络')
      setModels([])
      setPickerTarget(null)
    } finally {
      setFetching(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await onFlush()
      const result = await chrome.runtime.sendMessage({
        action: 'test-provider',
        providerId: provider.id,
        modelId,
      })
      setTestResult(result ?? { ok: false, error: '未收到响应' })
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  function handleSetActive() {
    if (!modelId.trim()) return
    onSetActive(provider.id, modelId.trim())
  }

  return (
    <div className={`border rounded-xl mb-2 overflow-hidden ${isActive ? 'border-primary bg-primary-light/40' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className={`text-gray-400 text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="font-medium text-gray-800 text-sm flex-shrink-0">{provider.name}</span>
          <span className="text-xs text-gray-400 truncate">{summary}</span>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive && (
            <span className="text-xs text-primary bg-primary-light px-2 py-0.5 rounded-full">
              使用中
            </span>
          )}
          {isQuick && (
            <span
              className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"
              title={`划词翻译使用 ${quickModel?.modelId}`}
            >
              划词
            </span>
          )}
          {!provider.isPreset && onDelete && (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">确认删除？</span>
                <button
                  className="text-red-600 bg-transparent border-none cursor-pointer hover:underline"
                  onClick={() => onDelete(provider.id)}
                >
                  删除
                </button>
                <button
                  className="text-gray-500 bg-transparent border-none cursor-pointer hover:underline"
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                className="text-xs text-red-500 bg-transparent border-none cursor-pointer hover:text-red-700"
                onClick={() => setConfirmDelete(true)}
              >
                删除
              </button>
            )
          )}
        </div>
      </div>

      {!expanded ? null : (
      <div className="px-4 pb-4 pt-1 border-t border-gray-100">
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">Base URL</label>
        {provider.isPreset ? (
          <p className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-500 break-all">
            {provider.baseUrl}
          </p>
        ) : (
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={provider.baseUrl}
            onChange={(e) => onUpdate({ ...provider, baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
          />
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">API Key</label>
          {provider.apiKey && (
            <button
              className="text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-600"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          )}
        </div>
        <input
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
          type={showKey ? 'text' : 'password'}
          value={provider.apiKey}
          onChange={(e) => onUpdate({ ...provider, apiKey: e.target.value })}
          placeholder="sk-..."
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {renderModelField({
        label: '翻译模型',
        hint: '整页翻译使用',
        target: 'main',
        value: modelId,
        onChange: setModelId,
        placeholder: '输入模型名称，如 glm-4.7-flash',
      })}

      {renderModelField({
        label: '划词模型',
        hint: modelId.trim()
          ? `留空则与翻译模型相同（${modelId.trim()}）`
          : '留空则与翻译模型相同',
        target: 'quick',
        value: quickModelId,
        onChange: setQuickModelId,
        placeholder: '建议填一个更快的模型',
      })}

      {fetchError && <p className="text-xs text-red-500 mb-2 break-all">{fetchError}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm border-none cursor-pointer hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleSetActive}
          disabled={!modelId.trim() || isActiveWithThisModel}
        >
          {isActiveWithThisModel ? '当前使用中' : '设为当前使用'}
        </button>
        <button
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm border-none cursor-pointer hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onSetQuick(provider.id, effectiveQuickId)}
          disabled={!effectiveQuickId || isQuickWithThisModel}
          title="用上方的划词模型处理划词翻译"
        >
          {isQuickWithThisModel ? '划词启用中' : '启用划词'}
        </button>
        <button
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm border-none cursor-pointer hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleTest}
          disabled={testing || !modelId.trim() || !provider.apiKey.trim()}
          title="用翻译模型发一条最小请求"
        >
          {testing ? '测试中...' : '测试连接'}
        </button>
      </div>

      {testResult && (
        <p className={`text-xs mt-2 break-all ${testResult.ok ? 'text-primary' : 'text-red-500'}`}>
          {testResult.ok ? `✓ ${testResult.detail ?? '连接正常'}` : `✗ ${testResult.error}`}
        </p>
      )}
      </div>
      )}
    </div>
  )
}
