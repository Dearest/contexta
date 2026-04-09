import { describe, it, expect, vi } from 'vitest'
import { fetchModels, getProviderById, resolveActiveProvider } from '../lib/providers'
import type { Provider, ActiveModel } from '../lib/types'

const mockProvider: Provider = {
  id: 'test',
  name: 'Test',
  baseUrl: 'https://api.test.com/v1',
  apiKey: 'sk-test',
  isPreset: false,
}

describe('getProviderById', () => {
  it('returns provider when found', () => {
    const result = getProviderById([mockProvider], 'test')
    expect(result).toEqual(mockProvider)
  })

  it('returns undefined when not found', () => {
    const result = getProviderById([mockProvider], 'nonexistent')
    expect(result).toBeUndefined()
  })
})

describe('resolveActiveProvider', () => {
  it('returns provider and model ID', () => {
    const active: ActiveModel = { providerId: 'test', modelId: 'gpt-4' }
    const result = resolveActiveProvider([mockProvider], active)
    expect(result).toEqual({ provider: mockProvider, modelId: 'gpt-4' })
  })

  it('returns null when provider not found', () => {
    const active: ActiveModel = { providerId: 'missing', modelId: 'gpt-4' }
    const result = resolveActiveProvider([mockProvider], active)
    expect(result).toBeNull()
  })

  it('returns null when activeModel is null', () => {
    const result = resolveActiveProvider([mockProvider], null)
    expect(result).toBeNull()
  })
})

describe('fetchModels', () => {
  it('parses OpenAI-compatible model list response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'model-a', object: 'model' },
          { id: 'model-b', object: 'model' },
        ],
      }),
    })

    const result = await fetchModels(mockProvider)
    expect(result).toEqual([
      { id: 'model-a', name: 'model-a' },
      { id: 'model-b', name: 'model-b' },
    ])

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      }),
    )
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    await expect(fetchModels(mockProvider)).rejects.toThrow('401')
  })
})
