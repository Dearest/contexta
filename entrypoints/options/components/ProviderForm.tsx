import { useState } from 'react'
import type { Provider, ActiveModel } from '@/lib/types'

interface Props {
  provider: Provider
  activeModel: ActiveModel | null
  onUpdate: (provider: Provider) => void
  onSetActive: (providerId: string, modelId: string) => void
  onDelete?: (providerId: string) => void
}

export default function ProviderForm({ provider, activeModel, onUpdate, onSetActive, onDelete }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [fetchError, setFetchError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [manualModel, setManualModel] = useState(
    activeModel?.providerId === provider.id ? activeModel.modelId : ''
  )

  const isActive = activeModel?.providerId === provider.id

  async function handleFetchModels() {
    setFetching(true)
    setFetchError('')
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetch-models',
        providerId: provider.id,
      })
      if (response?.error) {
        setFetchError(response.error)
        setModels([])
      } else if (response?.models) {
        setModels(response.models)
        setFetchError('')
      }
    } catch (e) {
      setFetchError('获取失败，请检查 API Key 和网络')
      setModels([])
    } finally {
      setFetching(false)
    }
  }

  function handleSetActive() {
    if (!manualModel.trim()) return
    onSetActive(provider.id, manualModel.trim())
  }

  return (
    <div className={`border rounded-xl p-5 mb-4 ${isActive ? 'border-primary bg-primary-light/50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-gray-800">{provider.name}</span>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="text-xs text-primary bg-primary-light px-2 py-0.5 rounded-full">
              使用中
            </span>
          )}
          {!provider.isPreset && onDelete && (
            <button
              className="text-xs text-red-500 bg-transparent border-none cursor-pointer hover:text-red-700"
              onClick={() => onDelete(provider.id)}
            >
              删除
            </button>
          )}
        </div>
      </div>

      {!provider.isPreset && (
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">Base URL</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={provider.baseUrl}
            onChange={(e) => onUpdate({ ...provider, baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
          />
        </div>
      )}

      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">API Key</label>
        <input
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
          type="password"
          value={provider.apiKey}
          onChange={(e) => onUpdate({ ...provider, apiKey: e.target.value })}
          placeholder="sk-..."
        />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">模型</label>
          <button
            className="text-xs text-primary bg-transparent border-none cursor-pointer hover:text-primary-dark disabled:opacity-50"
            onClick={handleFetchModels}
            disabled={fetching || !provider.apiKey}
          >
            {fetching ? '获取中...' : '获取列表'}
          </button>
        </div>

        <input
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
          type="text"
          value={manualModel}
          onChange={(e) => setManualModel(e.target.value)}
          placeholder="输入模型名称，如 glm-4.7-flash"
        />

        {models.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {models.map((m) => (
              <button
                key={m.id}
                className={`px-2 py-1 rounded-md text-xs border-none cursor-pointer transition-colors ${
                  manualModel === m.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setManualModel(m.id)}
              >
                {m.name || m.id}
              </button>
            ))}
          </div>
        )}

        {fetchError && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      <button
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm border-none cursor-pointer hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSetActive}
        disabled={!manualModel.trim()}
      >
        设为当前使用
      </button>
    </div>
  )
}
