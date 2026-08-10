import { useState } from 'react'
import type { ObsidianConfig as ObsidianConfigType, TestResult } from '@/lib/types'

interface Props {
  config: ObsidianConfigType
  onChange: (config: ObsidianConfigType) => void
  gapRecordEnabled: boolean
  onGapRecordEnabledChange: (enabled: boolean) => void
  gapNotePath: string
  onGapNotePathChange: (path: string) => void
  onFlush: () => Promise<void>
}

export default function ObsidianConfig({
  config,
  onChange,
  gapRecordEnabled,
  onGapRecordEnabledChange,
  gapNotePath,
  onGapNotePathChange,
  onFlush,
}: Props) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [showToken, setShowToken] = useState(false)

  function update(field: keyof ObsidianConfigType, value: string) {
    setTestResult(null)
    onChange({ ...config, [field]: value })
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await onFlush()
      const result = await chrome.runtime.sendMessage({ action: 'test-obsidian' })
      setTestResult(result ?? { ok: false, error: '未收到响应' })
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  const exportPath = `${config.vaultPath.replace(/\/$/, '')}/文章标题.md`

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Obsidian 导出</h2>
        <p className="text-sm text-gray-400 mt-1">通过 Local REST API 插件把译文写入 vault</p>
      </div>
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">REST API 地址</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={config.apiUrl}
            onChange={(e) => update('apiUrl', e.target.value)}
            placeholder="http://127.0.0.1:27123"
            spellCheck={false}
          />
          <p className="text-xs text-gray-400 mt-1">
            需安装 Obsidian Local REST API 插件。HTTP 端口默认 27123，HTTPS 端口默认 27124（自签证书，需先在浏览器中信任）
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">API Token</label>
            {config.apiToken && (
              <button
                className="text-xs text-gray-400 bg-transparent border-none cursor-pointer hover:text-gray-600"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? '隐藏' : '显示'}
              </button>
            )}
          </div>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type={showToken ? 'text' : 'password'}
            value={config.apiToken}
            onChange={(e) => update('apiToken', e.target.value)}
            placeholder="插件设置页面获取"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">保存路径</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={config.vaultPath}
            onChange={(e) => update('vaultPath', e.target.value)}
            placeholder="Inbox/Contexta/"
            spellCheck={false}
          />
          <p className="text-xs text-gray-400 mt-1">
            相对于 vault 根目录，导出为 <code className="text-gray-500">{exportPath}</code>
          </p>
        </div>

        <button
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm border-none cursor-pointer hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleTest}
          disabled={testing || !config.apiUrl.trim() || !config.apiToken.trim()}
        >
          {testing ? '测试中...' : '测试连接'}
        </button>

        {testResult && (
          <p className={`text-xs mt-2 ${testResult.ok ? 'text-primary' : 'text-red-500'}`}>
            {testResult.ok ? `✓ ${testResult.detail ?? '连接正常'}` : `✗ ${testResult.error}`}
          </p>
        )}
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">英语表达缺口</h2>
        <p className="text-sm text-gray-400 mt-1">
          写作润色时，把「你没写出来的中文 → 正确英文」追加到一个笔记里
        </p>
      </div>
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">写入 Obsidian</p>
            <p className="text-xs text-gray-400 mt-0.5">
              关闭时记录留在扩展本地（最多 500 条），润色功能不受影响
            </p>
          </div>
          <button
            role="switch"
            aria-checked={gapRecordEnabled}
            className={`relative w-10 h-6 rounded-full border-none cursor-pointer flex-shrink-0 transition-colors ${
              gapRecordEnabled ? 'bg-primary' : 'bg-gray-300'
            }`}
            onClick={() => onGapRecordEnabledChange(!gapRecordEnabled)}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                gapRecordEnabled ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {gapRecordEnabled && (
          <div className="mt-4">
            <label className="text-xs text-gray-500 mb-1 block">笔记路径</label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              type="text"
              value={gapNotePath}
              onChange={(e) => onGapNotePathChange(e.target.value)}
              placeholder="英语表达缺口.md"
              spellCheck={false}
            />
            <p className="text-xs text-gray-400 mt-1">
              相对于 vault 根目录。所有记录追加到这一个文件，一行一条：
            </p>
            <pre className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2 overflow-x-auto">
              - 2026-08-11 | 新词 | 确保 | ensure | 语气比 make sure 更确定 | github.com
            </pre>
            {!config.apiToken.trim() && (
              <p className="text-xs text-amber-600 mt-2">
                还没配置上面的 API Token，记录会暂时留在扩展本地
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
