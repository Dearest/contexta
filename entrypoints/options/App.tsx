import { useState, useEffect, useRef, useCallback } from 'react'
import ProviderManager from './components/ProviderManager'
import PresetManager from './components/PresetManager'
import ObsidianConfig from './components/ObsidianConfig'
import { getStorage, setStorage } from '@/lib/storage'
import { DEFAULT_OBSIDIAN_CONFIG } from '@/lib/constants'
import type { Provider, ActiveModel, TranslationPreset, ObsidianConfig as ObsidianConfigType } from '@/lib/types'

const SAVE_DEBOUNCE_MS = 500

const SECTIONS = [
  { id: 'providers', label: 'AI 服务商' },
  { id: 'presets', label: '翻译规则' },
  { id: 'obsidian', label: 'Obsidian 导出' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export default function App() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [activeModel, setActiveModel] = useState<ActiveModel | null>(null)
  const [customPresets, setCustomPresets] = useState<TranslationPreset[]>([])
  const [obsidianConfig, setObsidianConfig] = useState<ObsidianConfigType>(DEFAULT_OBSIDIAN_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [section, setSection] = useState<SectionId>('providers')

  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Mirrors of the latest state, so flushSave() doesn't need them as deps
  const providersRef = useRef<Provider[]>([])
  const obsidianRef = useRef<ObsidianConfigType>(DEFAULT_OBSIDIAN_CONFIG)

  useEffect(() => {
    loadSettings()
    return () => {
      // Flush nothing on unmount, but stop timers from firing into a dead tree
      debounceTimers.current.forEach(clearTimeout)
      clearTimeout(savedTimer.current)
    }
  }, [])

  const flashSaved = useCallback(() => {
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }, [])

  /** Text fields fire on every keystroke — coalesce writes so storage isn't
   *  hammered and the "已保存" badge doesn't strobe. */
  const debouncedSave = useCallback(
    <K extends 'providers' | 'obsidianConfig'>(key: K, value: Parameters<typeof setStorage<K>>[1]) => {
      clearTimeout(debounceTimers.current.get(key))
      debounceTimers.current.set(
        key,
        setTimeout(async () => {
          await setStorage(key, value)
          flashSaved()
        }, SAVE_DEBOUNCE_MS),
      )
    },
    [flashSaved],
  )

  /** Write any pending debounced changes immediately. Must be awaited before
   *  asking Background to do anything that reads settings from storage. */
  const flushSave = useCallback(async () => {
    debounceTimers.current.forEach(clearTimeout)
    debounceTimers.current.clear()
    await Promise.all([
      setStorage('providers', providersRef.current),
      setStorage('obsidianConfig', obsidianRef.current),
    ])
  }, [])

  async function loadSettings() {
    const [p, am, cp, oc] = await Promise.all([
      getStorage('providers'), getStorage('activeModel'),
      getStorage('customPresets'), getStorage('obsidianConfig'),
    ])
    // Migration: modelId used to live only on activeModel. Backfill it onto the
    // provider so the field isn't blank for users upgrading from an older build.
    const loadedProviders = (p ?? []).map((provider) =>
      provider.modelId === undefined && am?.providerId === provider.id
        ? { ...provider, modelId: am.modelId }
        : provider,
    )
    // Merge over defaults so a partial/legacy stored object can't turn the
    // controlled inputs into uncontrolled ones.
    const loadedObsidian = { ...DEFAULT_OBSIDIAN_CONFIG, ...(oc ?? {}) }

    setProviders(loadedProviders)
    setActiveModel(am ?? null)
    setCustomPresets(cp ?? [])
    setObsidianConfig(loadedObsidian)
    providersRef.current = loadedProviders
    obsidianRef.current = loadedObsidian
    setLoading(false)
  }

  function handleProvidersChange(updated: Provider[]) {
    setProviders(updated)
    providersRef.current = updated
    debouncedSave('providers', updated)
  }
  async function handleActiveModelChange(active: ActiveModel | null) {
    setActiveModel(active)
    await setStorage('activeModel', active)
    flashSaved()
  }
  async function handlePresetsChange(presets: TranslationPreset[]) {
    setCustomPresets(presets)
    await setStorage('customPresets', presets)
    flashSaved()
  }
  function handleObsidianChange(config: ObsidianConfigType) {
    setObsidianConfig(config)
    obsidianRef.current = config
    debouncedSave('obsidianConfig', config)
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 flex gap-10 items-start">
      <nav className="w-44 flex-shrink-0 sticky top-10">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-dark to-primary rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <span className="font-semibold text-gray-800">Contexta</span>
        </div>
        <ul className="list-none p-0 m-0 space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                className={`w-full text-left px-3 py-2 rounded-lg text-sm border-none cursor-pointer transition-colors ${
                  section === s.id
                    ? 'bg-primary-light text-primary-dark font-medium'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <p className={`text-xs text-primary mt-6 px-3 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
          已保存 ✓
        </p>
      </nav>

      <main className="flex-1 min-w-0">
        {loading ? (
          <p className="text-sm text-gray-400">加载中...</p>
        ) : section === 'providers' ? (
          <ProviderManager providers={providers} activeModel={activeModel} onProvidersChange={handleProvidersChange} onActiveModelChange={handleActiveModelChange} onFlush={flushSave} />
        ) : section === 'presets' ? (
          <PresetManager customPresets={customPresets} onChange={handlePresetsChange} />
        ) : (
          <ObsidianConfig config={obsidianConfig} onChange={handleObsidianChange} onFlush={flushSave} />
        )}
      </main>
    </div>
  )
}
