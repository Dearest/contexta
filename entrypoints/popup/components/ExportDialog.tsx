import { useState } from 'react'
import type { ExportFormat } from '@/lib/types'

interface Props { open: boolean; onClose: () => void; onExport: (format: ExportFormat, includeSummary: boolean, includeQuotes: boolean) => void; isExporting: boolean }

export default function ExportDialog({ open, onClose, onExport, isExporting }: Props) {
  const [format, setFormat] = useState<ExportFormat>('target-only')
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeQuotes, setIncludeQuotes] = useState(true)
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-5 w-[320px] shadow-xl">
        <h3 className="text-[15px] font-semibold text-gray-800 mb-4">导出到 Obsidian</h3>
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-2 block">导出格式</label>
          {(['target-only', 'bilingual', 'source-only'] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 py-1.5 cursor-pointer">
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="accent-primary" />
              <span className="text-[13px] text-gray-700">{{ 'target-only': '仅译文', bilingual: '双语对照', 'source-only': '仅原文' }[f]}</span>
            </label>
          ))}
        </div>
        <div className="mb-4 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeSummary} onChange={(e) => setIncludeSummary(e.target.checked)} className="accent-primary" />
            <span className="text-[13px] text-gray-700">生成摘要</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeQuotes} onChange={(e) => setIncludeQuotes(e.target.checked)} className="accent-primary" />
            <span className="text-[13px] text-gray-700">提取金句</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-[13px] border-none cursor-pointer hover:bg-gray-200">取消</button>
          <button onClick={() => onExport(format, includeSummary, includeQuotes)} disabled={isExporting} className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] border-none cursor-pointer disabled:opacity-60">{isExporting ? '导出中...' : '确认导出'}</button>
        </div>
      </div>
    </div>
  )
}
