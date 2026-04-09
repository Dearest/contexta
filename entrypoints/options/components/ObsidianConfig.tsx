import type { ObsidianConfig as ObsidianConfigType } from '@/lib/types'

interface Props {
  config: ObsidianConfigType
  onChange: (config: ObsidianConfigType) => void
}

export default function ObsidianConfig({ config, onChange }: Props) {
  function update(field: keyof ObsidianConfigType, value: string) {
    onChange({ ...config, [field]: value })
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Obsidian 导出设置</h2>
      <div className="border border-gray-200 rounded-xl p-5">
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">REST API 地址</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={config.apiUrl}
            onChange={(e) => update('apiUrl', e.target.value)}
            placeholder="http://localhost:27123"
          />
          <p className="text-xs text-gray-400 mt-1">需安装 Obsidian Local REST API 插件</p>
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">API Token</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="password"
            value={config.apiToken}
            onChange={(e) => update('apiToken', e.target.value)}
            placeholder="插件设置页面获取"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">保存路径</label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            type="text"
            value={config.vaultPath}
            onChange={(e) => update('vaultPath', e.target.value)}
            placeholder="Inbox/Contexta/"
          />
          <p className="text-xs text-gray-400 mt-1">文件将保存到 vault 中的此路径下</p>
        </div>
      </div>
    </section>
  )
}
