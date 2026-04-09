// === Provider & Model ===

export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  isPreset: boolean
}

export interface ModelInfo {
  id: string
  name: string
}

export interface ActiveModel {
  providerId: string
  modelId: string
}

// === Translation Presets ===

export interface TranslationPreset {
  id: string
  name: string
  rules: string
  isBuiltin: boolean
}

// === Translation ===

export type DisplayMode = 'bilingual' | 'target-only'

export interface Paragraph {
  id: string
  text: string
  prev?: string
  next?: string
  tagName: string
}

export interface ArticleMetadata {
  title: string
  author?: string
  published?: string
  url: string
}

export interface ExtractedArticle {
  paragraphs: Paragraph[]
  metadata: ArticleMetadata
}

// === Obsidian Export ===

export type ExportFormat = 'target-only' | 'bilingual' | 'source-only'

export interface ExportOptions {
  format: ExportFormat
  includeSummary: boolean
  includeQuotes: boolean
}

export interface ObsidianConfig {
  apiUrl: string
  apiToken: string
  vaultPath: string
}

// === Message Protocol ===

export type Message =
  | { action: 'translate'; mode: DisplayMode; targetLang: string; presetId: string }
  | { action: 'extract' }
  | { action: 'extract-result'; article: ExtractedArticle }
  | { action: 'translation-result'; paragraphId: string; translation: string }
  | { action: 'translation-error'; paragraphId: string; error: string }
  | { action: 'translation-progress'; current: number; total: number }
  | { action: 'translation-complete' }
  | { action: 'clear-translations' }
  | { action: 'switch-mode'; mode: DisplayMode }
  | { action: 'export-obsidian'; options: ExportOptions }
  | { action: 'export-result'; success: boolean; error?: string }
  | { action: 'retry-paragraph'; paragraphId: string }
  | { action: 'fetch-models'; providerId: string }
  | { action: 'fetch-models-result'; models: ModelInfo[]; error?: string }

// === Storage Schema ===

export interface StorageSchema {
  providers: Provider[]
  activeModel: ActiveModel | null
  displayMode: DisplayMode
  targetLang: string
  activePresetId: string
  customPresets: TranslationPreset[]
  obsidianConfig: ObsidianConfig
}
