import type { Provider, ActiveModel, ModelInfo } from './types'

export function getProviderById(providers: Provider[], id: string): Provider | undefined {
  return providers.find((p) => p.id === id)
}

export function resolveActiveProvider(
  providers: Provider[],
  activeModel: ActiveModel | null,
): { provider: Provider; modelId: string } | null {
  if (!activeModel) return null
  const provider = getProviderById(providers, activeModel.providerId)
  if (!provider) return null
  return { provider, modelId: activeModel.modelId }
}

export async function fetchModels(provider: Provider): Promise<ModelInfo[]> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/models`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
    })
  } catch {
    throw new Error(`无法连接 ${url}，请检查 Base URL 和网络`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${response.status} ${response.statusText}${body ? ` — ${truncate(body, 200)}` : ''}`)
  }

  const data = await response.json().catch(() => null)
  // Gateways differ: OpenAI uses { data: [...] }, some return { models: [...] }
  // or a bare array. Accept all three rather than silently returning nothing.
  const raw: unknown = Array.isArray(data) ? data : (data?.data ?? data?.models)
  if (!Array.isArray(raw)) {
    throw new Error('响应格式无法识别，未找到模型列表')
  }

  return raw
    .map((m: unknown) => {
      if (typeof m === 'string') return { id: m, name: m }
      const item = m as { id?: string; name?: string }
      return item.id ? { id: item.id, name: item.name || item.id } : null
    })
    .filter((m): m is ModelInfo => m !== null)
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
