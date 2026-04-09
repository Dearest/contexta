import { useState } from 'react'
import type { Provider, ActiveModel } from '@/lib/types'
import ProviderForm from './ProviderForm'

interface Props {
  providers: Provider[]
  activeModel: ActiveModel | null
  onProvidersChange: (providers: Provider[]) => void
  onActiveModelChange: (active: ActiveModel) => void
}

export default function ProviderManager({ providers, activeModel, onProvidersChange, onActiveModelChange }: Props) {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  function handleUpdate(updated: Provider) {
    onProvidersChange(providers.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleSetActive(providerId: string, modelId: string) {
    onActiveModelChange({ providerId, modelId })
  }

  function handleDelete(providerId: string) {
    onProvidersChange(providers.filter((p) => p.id !== providerId))
  }

  function handleAddProvider() {
    const name = newName.trim()
    const baseUrl = newUrl.trim()
    if (!name || !baseUrl) return

    const id = `custom-${Date.now()}`
    const newProvider: Provider = {
      id,
      name,
      baseUrl,
      apiKey: '',
      isPreset: false,
    }
    onProvidersChange([...providers, newProvider])
    setNewName('')
    setNewUrl('')
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">AI 服务商</h2>

      {providers.map((provider) => (
        <ProviderForm
          key={provider.id}
          provider={provider}
          activeModel={activeModel}
          onUpdate={handleUpdate}
          onSetActive={handleSetActive}
          onDelete={handleDelete}
        />
      ))}

      <div className="border border-dashed border-gray-300 rounded-xl p-5 mt-2">
        <p className="text-sm font-medium text-gray-700 mb-3">添加自定义服务商</p>
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">服务商名称</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="如：DeepSeek"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Base URL</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
        </div>
        <button
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAddProvider}
          disabled={!newName.trim() || !newUrl.trim()}
        >
          + 添加
        </button>
      </div>
    </section>
  )
}
