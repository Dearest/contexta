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
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const models: { id: string }[] = data.data ?? []
  return models.map((m) => ({ id: m.id, name: m.id }))
}
