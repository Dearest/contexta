import { useState, useEffect } from 'react'
import ProviderManager from './components/ProviderManager'
import PresetManager from './components/PresetManager'
import ObsidianConfig from './components/ObsidianConfig'
import { getStorage, setStorage } from '@/lib/storage'
import type { Provider, ActiveModel, TranslationPreset, ObsidianConfig as ObsidianConfigType } from '@/lib/types'

export default function App() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [activeModel, setActiveModel] = useState<ActiveModel | null>(null)
  const [customPresets, setCustomPresets] = useState<TranslationPreset[]>([])
  const [obsidianConfig, setObsidianConfig] = useState<ObsidianConfigType>({ apiUrl: 'http://localhost:27123', apiToken: '', vaultPath: 'Inbox/Contexta/' })
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const [p, am, cp, oc] = await Promise.all([
      getStorage('providers'), getStorage('activeModel'),
      getStorage('customPresets'), getStorage('obsidianConfig'),
    ])
    setProviders(p); setActiveModel(am); setCustomPresets(cp); setObsidianConfig(oc)
  }

  async function handleProvidersChange(updated: Provider[]) {
    setProviders(updated); await setStorage('providers', updated); flashSaved()
  }
  async function handleActiveModelChange(active: ActiveModel) {
    setActiveModel(active); await setStorage('activeModel', active); flashSaved()
  }
  async function handlePresetsChange(presets: TranslationPreset[]) {
    setCustomPresets(presets); await setStorage('customPresets', presets); flashSaved()
  }
  async function handleObsidianChange(config: ObsidianConfigType) {
    setObsidianConfig(config); await setStorage('obsidianConfig', config); flashSaved()
  }
  function flashSaved() { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-dark to-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
          <h1 className="text-2xl font-semibold text-gray-800">Contexta 设置</h1>
        </div>
        {saved && <span className="text-sm text-primary">已保存 ✓</span>}
      </div>
      <div className="space-y-10">
        <ProviderManager providers={providers} activeModel={activeModel} onProvidersChange={handleProvidersChange} onActiveModelChange={handleActiveModelChange} />
        <PresetManager customPresets={customPresets} onChange={handlePresetsChange} />
        <ObsidianConfig config={obsidianConfig} onChange={handleObsidianChange} />
      </div>
    </div>
  )
}
