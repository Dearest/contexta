interface Props { providerName: string; modelId: string; status?: string }

export default function StatusBar({ providerName, modelId, status }: Props) {
  const display = providerName && modelId ? `${providerName} · ${modelId}` : '未配置服务商'

  if (status) {
    const isSuccess = status.includes('成功')
    const isError = status.includes('失败')
    if (isSuccess || isError) {
      return (
        <div className={`text-center text-xs font-medium py-1.5 px-3 rounded-lg ${
          isSuccess ? 'bg-primary-light text-primary-dark' : 'bg-red-50 text-red-600'
        }`}>
          {isSuccess ? '✓ ' : ''}{status}
        </div>
      )
    }
  }

  return (<div className="text-center text-xs text-gray-400">{status ?? `当前：${display}`}</div>)
}
