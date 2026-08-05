import { useState } from 'react'
import type { ObsidianConfig as ObsidianConfigType, TestResult } from '@/lib/types'

interface Props {
  config: ObsidianConfigType
  onChange: (config: ObsidianConfigType) => void
  onFlush: () => Promise<void>
}

export default function ObsidianConfig({ config, onChange, onFlush }: Props) {
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
    </section>
  )
}
