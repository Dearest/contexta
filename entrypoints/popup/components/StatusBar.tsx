interface Props { providerName: string; modelId: string; status?: string }

export default function StatusBar({ providerName, modelId, status }: Props) {
  const display = providerName && modelId ? `${providerName} · ${modelId}` : '未配置服务商'
  return (<div className="text-center text-xs text-gray-400">{status ?? `当前：${display}`}</div>)
}
