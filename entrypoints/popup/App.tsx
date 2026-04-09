import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import LanguageSelector from './components/LanguageSelector'
import StyleSelector from './components/StyleSelector'
import TranslateBar from './components/TranslateBar'
import StatusBar from './components/StatusBar'
import ExportDialog from './components/ExportDialog'
import { getStorage, setStorage } from '@/lib/storage'
import { sendToBackground, sendToActiveTab } from '@/lib/messages'
import { getProviderById } from '@/lib/providers'
import type { DisplayMode, ExportFormat, TranslationPreset } from '@/lib/types'

export default function App() {
  const [targetLang, setTargetLang] = useState('zh-CN')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bilingual')
  const [activePresetId, setActivePresetId] = useState('tech-blog')
  const [customPresets, setCustomPresets] = useState<TranslationPreset[]>([])
  const [providerName, setProviderName] = useState('')
  const [modelId, setModelId] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [showExport, setShowExport] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const [tl, dm, apId, cp, providers, activeModel] = await Promise.all([
      getStorage('targetLang'), getStorage('displayMode'), getStorage('activePresetId'),
      getStorage('customPresets'), getStorage('providers'), getStorage('activeModel'),
    ])
    setTargetLang(tl); setDisplayMode(dm); setActivePresetId(apId); setCustomPresets(cp)
    if (activeModel) {
      const provider = getProviderById(providers, activeModel.providerId)
      if (provider) { setProviderName(provider.name); setModelId(activeModel.modelId) }
    }
  }

  const handleTargetLangChange = useCallback(async (lang: string) => {
    setTargetLang(lang); await setStorage('targetLang', lang)
  }, [])

  const handlePresetChange = useCallback(async (id: string) => {
    setActivePresetId(id); await setStorage('activePresetId', id)
  }, [])

  const handleModeChange = useCallback(async (mode: DisplayMode) => {
    setDisplayMode(mode); await setStorage('displayMode', mode)
    sendToActiveTab({ action: 'switch-mode', mode }).catch(() => {})
  }, [])

  const handleTranslate = useCallback(async () => {
    setIsTranslating(true); setProgress(undefined); setStatus(undefined)
    const listener = (message: { action: string; current?: number; total?: number }) => {
      if (message.action === 'translation-progress') setProgress({ current: message.current!, total: message.total! })
      if (message.action === 'translation-complete') { setIsTranslating(false); setProgress(undefined); setStatus('翻译完成') }
    }
    chrome.runtime.onMessage.addListener(listener)
    try {
      await sendToBackground({ action: 'translate', mode: displayMode, targetLang, presetId: activePresetId })
    } catch { setIsTranslating(false); setStatus('翻译失败') }
  }, [displayMode, targetLang, activePresetId])

  const handleExport = useCallback(async (format: ExportFormat, includeSummary: boolean, includeQuotes: boolean) => {
    setIsExporting(true)
    try {
      const result = await sendToBackground({ action: 'export-obsidian', options: { format, includeSummary, includeQuotes } }) as { success: boolean; error?: string }
      if (result?.success) { setShowExport(false); setStatus('导出成功') }
      else setStatus(`导出失败: ${result?.error ?? '未知错误'}`)
    } catch { setStatus('导出失败') }
    finally { setIsExporting(false) }
  }, [])

  return (
    <div className="w-[360px] p-5 font-sans">
      <Header />
      <LanguageSelector targetLang={targetLang} onChange={handleTargetLangChange} />
      <StyleSelector activePresetId={activePresetId} customPresets={customPresets} onChange={handlePresetChange} />
      <TranslateBar mode={displayMode} onModeChange={handleModeChange} onTranslate={handleTranslate} isTranslating={isTranslating} progress={progress} />
      <StatusBar providerName={providerName} modelId={modelId} status={status} />
      <div className="mt-4 pt-3 border-t border-gray-100">
        <button onClick={() => setShowExport(true)} className="w-full py-2.5 bg-primary-light border border-primary-border rounded-lg text-[13px] text-primary-dark cursor-pointer hover:bg-primary-border/30">📤 导出到 Obsidian</button>
      </div>
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} onExport={handleExport} isExporting={isExporting} />
    </div>
  )
}
