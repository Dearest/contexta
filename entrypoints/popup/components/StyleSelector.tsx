import { BUILTIN_PRESETS } from '@/lib/constants'
import type { TranslationPreset } from '@/lib/types'

interface Props { activePresetId: string; customPresets: TranslationPreset[]; onChange: (id: string) => void }

export default function StyleSelector({ activePresetId, customPresets, onChange }: Props) {
  const allPresets = [...BUILTIN_PRESETS, ...customPresets]
  return (
    <div className="mb-4">
      <select value={activePresetId} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-primary-light border border-primary-border rounded-lg text-[13px] text-primary-dark outline-none cursor-pointer">
        {allPresets.map((preset) => (<option key={preset.id} value={preset.id}>{preset.name}</option>))}
      </select>
    </div>
  )
}
