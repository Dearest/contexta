import { TARGET_LANGUAGES } from '@/lib/constants'

interface Props { targetLang: string; onChange: (lang: string) => void }

export default function LanguageSelector({ targetLang, onChange }: Props) {
  return (
    <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 bg-primary-light rounded-lg border border-primary-border">
      <div className="flex-1 text-center">
        <div className="text-[11px] text-primary-dark/70 mb-0.5">源语言</div>
        <div className="text-[13px] font-medium text-primary-dark">自动检测</div>
      </div>
      <div className="text-primary text-base">→</div>
      <div className="flex-1 text-center">
        <div className="text-[11px] text-primary-dark/70 mb-0.5">目标语言</div>
        <select value={targetLang} onChange={(e) => onChange(e.target.value)} className="text-[13px] font-medium text-primary-dark bg-transparent border-none outline-none cursor-pointer text-center">
          {TARGET_LANGUAGES.map((lang) => (<option key={lang.code} value={lang.code}>{lang.name}</option>))}
        </select>
      </div>
    </div>
  )
}
