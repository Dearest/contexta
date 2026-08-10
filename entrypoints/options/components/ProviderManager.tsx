import { useState, useEffect } from 'react'
import type { Provider, ActiveModel } from '@/lib/types'
import ProviderForm from './ProviderForm'

interface Props {
  providers: Provider[]
  activeModel: ActiveModel | null
  quickModel: ActiveModel | null
  onProvidersChange: (providers: Provider[]) => void
  onActiveModelChange: (active: ActiveModel | null) => void
  onQuickModelChange: (quick: ActiveModel | null) => void
  selectionEnabled: boolean
  onSelectionEnabledChange: (enabled: boolean) => void
  inputPolishEnabled: boolean
  onInputPolishEnabledChange: (enabled: boolean) => void
  /** Persist pending debounced edits before Background reads them */
  onFlush: () => Promise<void>
}

function FeatureToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border border-gray-200 rounded-xl px-4 py-3 mb-3 bg-white">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={`relative w-10 h-6 rounded-full border-none cursor-pointer flex-shrink-0 transition-colors ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export default function ProviderManager({ providers, activeModel, quickModel, onProvidersChange, onActiveModelChange, onQuickModelChange, selectionEnabled, onSelectionEnabledChange, inputPolishEnabled, onInputPolishEnabledChange, onFlush }: Props) {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [addError, setAddError] = useState('')
  const [addingProvider, setAddingProvider] = useState(false)
  // Accordion: only one provider's form is open at a time
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Open the provider in use once settings finish loading
  useEffect(() => {
    if (activeModel?.providerId) setExpandedId(activeModel.providerId)
  }, [activeModel?.providerId])

  function handleUpdate(updated: Provider) {
    onProvidersChange(providers.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleSetActive(providerId: string, modelId: string) {
    onActiveModelChange({ providerId, modelId })
  }

  function handleSetQuick(providerId: string, modelId: string) {
    onQuickModelChange({ providerId, modelId })
  }

  function handleDelete(providerId: string) {
    onProvidersChange(providers.filter((p) => p.id !== providerId))
    // Otherwise the stored reference dangles and translation fails with an
    // opaque error instead of a clear "not configured" message
    if (activeModel?.providerId === providerId) onActiveModelChange(null)
    if (quickModel?.providerId === providerId) onQuickModelChange(null)
  }

  function handleAddProvider() {
    const name = newName.trim()
    const baseUrl = newUrl.trim()
    if (!name || !baseUrl) return

    if (!/^https?:\/\/.+/i.test(baseUrl)) {
      setAddError('Base URL 需以 http:// 或 https:// 开头')
      return
    }
    if (providers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setAddError('已存在同名服务商')
      return
    }

    const newProvider: Provider = {
      id: `custom-${Date.now()}`,
      name,
      baseUrl,
      apiKey: '',
      isPreset: false,
      modelId: '',
    }
    onProvidersChange([...providers, newProvider])
    setNewName('')
    setNewUrl('')
    setAddError('')
    setAddingProvider(false)
    setExpandedId(newProvider.id) // jump straight into filling in the API key
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">AI 服务商</h2>
        <p className="text-sm text-gray-400 mt-1">配置翻译使用的模型服务，点击展开编辑</p>
      </div>

      <FeatureToggle
        title="划词翻译"
        description={
          quickModel
            ? `选中网页文字后点绿点翻译，使用 ${quickModel.modelId}`
            : '选中网页文字后点绿点翻译。未指定划词模型，将使用当前模型 — 建议单独指定一个快的'
        }
        checked={selectionEnabled}
        onChange={onSelectionEnabledChange}
      />

      <div className="mb-4">
        <FeatureToggle
          title="写作润色"
          description="在任意输入框连按三下空格，把内容改写成地道英文。中英混写时，中文部分会被补全为英文"
          checked={inputPolishEnabled}
          onChange={onInputPolishEnabledChange}
        />
      </div>

      {providers.map((provider) => (
        <ProviderForm
          key={provider.id}
          provider={provider}
          activeModel={activeModel}
          quickModel={quickModel}
          onUpdate={handleUpdate}
          onSetActive={handleSetActive}
          onSetQuick={handleSetQuick}
          onDelete={handleDelete}
          onFlush={onFlush}
          expanded={expandedId === provider.id}
          onToggle={() => setExpandedId((id) => (id === provider.id ? null : provider.id))}
        />
      ))}

      {!addingProvider ? (
        <button
          className="w-full px-4 py-3 mt-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 bg-transparent cursor-pointer hover:border-primary hover:text-primary transition-colors"
          onClick={() => setAddingProvider(true)}
        >
          + 添加自定义服务商
        </button>
      ) : (
      <div className="border border-dashed border-gray-300 rounded-xl p-5 mt-2">
        <p className="text-sm font-medium text-gray-700 mb-3">添加自定义服务商</p>
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">服务商名称</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setAddError('') }}
            placeholder="如：DeepSeek"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Base URL</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={newUrl}
            onChange={(e) => { setNewUrl(e.target.value); setAddError('') }}
            placeholder="https://api.deepseek.com/v1"
          />
        </div>
        {addError && <p className="text-xs text-red-500 mb-3">{addError}</p>}
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs border-none cursor-pointer hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleAddProvider}
            disabled={!newName.trim() || !newUrl.trim()}
          >
            添加
          </button>
          <button
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs border-none cursor-pointer hover:bg-gray-200"
            onClick={() => { setAddingProvider(false); setAddError(''); setNewName(''); setNewUrl('') }}
          >
            取消
          </button>
        </div>
      </div>
      )}
    </section>
  )
}
