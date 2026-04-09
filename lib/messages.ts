import type { Message } from './types'

export function sendToBackground(message: Message): Promise<unknown> {
  return chrome.runtime.sendMessage(message)
}

export async function sendToActiveTab(message: Message): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw new Error('No active tab')
  return chrome.tabs.sendMessage(tab.id, message)
}

export function sendToTab(tabId: number, message: Message): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message)
}

export function onMessage(
  handler: (message: Message, sender: chrome.runtime.MessageSender) => void | Promise<unknown>,
): () => void {
  const listener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    const result = handler(message, sender)
    if (result instanceof Promise) {
      result.then(sendResponse).catch((err) => sendResponse({ error: String(err) }))
      return true // keep message channel open for async
    }
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}
