import { useState } from 'react'
import type { TranslationPreset } from '@/lib/types'

interface Props {
  customPresets: TranslationPreset[]
  onChange: (presets: TranslationPreset[]) => void
}

export default function PresetManager({ customPresets, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRules, setEditRules] = useState('')
  const [newName, setNewName] = useState('')
  const [newRules, setNewRules] = useState('')

  function handleEdit(preset: TranslationPreset) {
    setEditingId(preset.id)
    setEditName(preset.name)
    setEditRules(preset.rules)
  }

  function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    onChange(
      customPresets.map((p) =>
        p.id === id ? { ...p, name: editName.trim(), rules: editRules } : p
      )
    )
    setEditingId(null)
  }

  function handleCancelEdit() {
    setEditingId(null)
  }

  function handleDelete(id: string) {
    onChange(customPresets.filter((p) => p.id !== id))
  }

  function handleAdd() {
    if (!newName.trim()) return
    const newPreset: TranslationPreset = {
      id: `custom-preset-${Date.now()}`,
      name: newName.trim(),
      rules: newRules,
      isBuiltin: false,
    }
    onChange([...customPresets, newPreset])
    setNewName('')
    setNewRules('')
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">自定义翻译规则</h2>

      {customPresets.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">暂无自定义规则，在下方添加</p>
      )}

      {customPresets.map((preset) =>
        editingId === preset.id ? (
          <div key={preset.id} className="border border-primary rounded-xl p-5 mb-4 bg-primary-light/30">
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">规则名称</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">翻译规则</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
                rows={4}
                value={editRules}
                onChange={(e) => setEditRules(e.target.value)}
                placeholder="描述翻译风格和规则..."
              />
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm border-none cursor-pointer hover:bg-primary-dark"
                onClick={() => handleSaveEdit(preset.id)}
              >
                保存
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm border-none cursor-pointer hover:bg-gray-200"
                onClick={handleCancelEdit}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div key={preset.id} className="border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{preset.name}</p>
                <p className="text-xs text-gray-500 mt-1 whitespace-pre-line line-clamp-2">{preset.rules || '暂无规则描述'}</p>
              </div>
              <div className="flex gap-2 ml-3 flex-shrink-0">
                <button
                  className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs border-none cursor-pointer hover:bg-gray-200"
                  onClick={() => handleEdit(preset)}
                >
                  编辑
                </button>
                <button
                  className="px-3 py-1 bg-transparent text-red-500 rounded-lg text-xs border border-red-200 cursor-pointer hover:bg-red-50"
                  onClick={() => handleDelete(preset.id)}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )
      )}

      <div className="border border-dashed border-gray-300 rounded-xl p-5 mt-2">
        <p className="text-sm font-medium text-gray-700 mb-3">添加自定义规则</p>
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">规则名称</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="如：技术文档"
          />
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">翻译规则</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
            rows={3}
            value={newRules}
            onChange={(e) => setNewRules(e.target.value)}
            placeholder="描述翻译风格、术语偏好等规则..."
          />
        </div>
        <button
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          + 添加
        </button>
      </div>
    </section>
  )
}
