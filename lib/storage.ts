import type { StorageSchema } from './types'
import { DEFAULT_STORAGE } from './constants'

type StorageKey = keyof StorageSchema

export async function getStorage<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key)
  return (result[key] ?? DEFAULT_STORAGE[key]) as StorageSchema[K]
}

export async function setStorage<K extends StorageKey>(
  key: K,
  value: StorageSchema[K],
): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export async function getAllStorage(): Promise<StorageSchema> {
  const result = await chrome.storage.local.get(null)
  return { ...DEFAULT_STORAGE, ...result } as StorageSchema
}

export function onStorageChange(
  callback: (changes: Partial<Record<StorageKey, { oldValue: unknown; newValue: unknown }>>) => void,
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName === 'local') {
      callback(changes as Parameters<typeof callback>[0])
    }
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
