import type { DisplayMode } from '@/lib/types'

interface Props { mode: DisplayMode; onModeChange: (mode: DisplayMode) => void; onTranslate: () => void; isTranslating: boolean; progress?: { current: number; total: number } }

export default function TranslateBar({ mode, onModeChange, onTranslate, isTranslating, progress }: Props) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex bg-primary-light border border-primary-border rounded-lg overflow-hidden flex-shrink-0">
        <button onClick={() => onModeChange('bilingual')} className={`px-2.5 py-2.5 text-[11px] font-semibold border-none cursor-pointer transition-colors ${mode === 'bilingual' ? 'bg-primary-dark text-white' : 'bg-transparent text-primary-dark'}`}>双语</button>
        <button onClick={() => onModeChange('target-only')} className={`px-2.5 py-2.5 text-[11px] font-semibold border-none cursor-pointer transition-colors ${mode === 'target-only' ? 'bg-primary-dark text-white' : 'bg-transparent text-primary-dark'}`}>译文</button>
      </div>
      <button onClick={onTranslate} disabled={isTranslating} className="flex-1 py-2.5 bg-gradient-to-r from-primary-dark to-primary text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer shadow-md shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity">
        {isTranslating && progress ? `翻译中 ${progress.current}/${progress.total}` : '✨ AI 翻译'}
      </button>
    </div>
  )
}
