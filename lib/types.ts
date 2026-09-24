// === Provider & Model ===

export interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  isPreset: boolean
  /** Model for full-page translation. Persisted per-provider so switching the
   *  active provider doesn't lose the others' model names. */
  modelId?: string
  /** Model for selection translation. Empty means "same as modelId". Separate
   *  because one provider commonly serves both a good model and a fast one. */
  quickModelId?: string
}

export interface ModelInfo {
  id: string
  name: string
}

export interface ActiveModel {
  providerId: string
  modelId: string
}

export interface InlineTagMapping {
  placeholder: string
  tag: string
  attrs: Record<string, string>
}

// === Translation Presets ===

export interface TranslationPreset {
  id: string
  name: string
  rules: string
  isBuiltin: boolean
}

// === Translation ===

export type DisplayMode = 'source-only' | 'bilingual' | 'target-only'

export interface Paragraph {
  id: string
  text: string
  plainText: string
  prev?: string
  next?: string
  tagName: string
  tagMap?: InlineTagMapping[]
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
  contentHtml?: string
}

// === Input Polish ===

/** Page/field signals the model uses to pick tone and length. */
export interface InputContext {
  host: string
  path: string
  placeholder?: string
  /** Characters still available in the field, null when unconstrained */
  charsLeft: number | null
}

/**
 * `new` — filled in from Chinese the user couldn't write in English.
 * `fix` — English the user did write, corrected.
 * `add` — words added outright, with no counterpart in the original.
 */
export type ChangeKind = 'new' | 'fix' | 'add'

export interface PolishChange {
  kind: ChangeKind
  /** Empty when kind is 'add' */
  source: string
  target: string
  reason: string
}

export interface GapEntry {
  /** YYYY-MM-DD */
  date: string
  kind: ChangeKind
  source: string
  target: string
  reason: string
  host: string
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
  // Feed pages (site rules): paragraphs that appeared after the first extract
  | { action: 'extract-more'; paragraphs: Paragraph[] }
  | { action: 'translation-result'; paragraphId: string; translation: string; tagMap?: InlineTagMapping[] }
  | { action: 'translation-error'; paragraphId: string; error: string }
  | { action: 'translation-progress'; current: number; total: number }
  | { action: 'translation-complete' }
  | { action: 'clear-translations' }
  | { action: 'switch-mode'; mode: DisplayMode }
  | { action: 'export-obsidian'; options: ExportOptions }
  | { action: 'export-result'; success: boolean; error?: string; filePath?: string }
  | { action: 'open-in-obsidian'; filePath: string }
  | { action: 'open-in-obsidian-result'; success: boolean; error?: string }
  | { action: 'retry-paragraph'; paragraphId: string }
  | { action: 'build-export-markdown'; format: ExportFormat }
  | { action: 'fetch-models'; providerId: string }
  | { action: 'fetch-models-result'; models: ModelInfo[]; error?: string }
  | { action: 'test-provider'; providerId: string; modelId: string }
  | { action: 'test-obsidian' }
  // Selection translation streams back chunk-by-chunk, keyed by requestId so
  // a stale request can be ignored when the user selects something else.
  | { action: 'translate-selection'; requestId: string; text: string }
  | { action: 'selection-chunk'; requestId: string; chunk: string }
  | { action: 'selection-reasoning'; requestId: string }
  | { action: 'selection-done'; requestId: string }
  | { action: 'selection-error'; requestId: string; error: string }
  // Input polish mirrors the selection protocol (requestId guards against a
  // superseded request), but renders entirely in the page — no popup involved.
  | { action: 'polish-input'; requestId: string; text: string; context?: InputContext }
  | { action: 'polish-chunk'; requestId: string; chunk: string }
  | { action: 'polish-reasoning'; requestId: string }
  | { action: 'polish-done'; requestId: string }
  | { action: 'polish-error'; requestId: string; error: string }
  | { action: 'record-gap'; entries: GapEntry[] }

// === Connection Test ===

export interface TestResult {
  ok: boolean
  /** Short human-readable outcome, e.g. the model's reply or the vault name */
  detail?: string
  error?: string
}

// === Storage Schema ===

export interface StorageSchema {
  providers: Provider[]
  activeModel: ActiveModel | null
  displayMode: DisplayMode
  targetLang: string
  activePresetId: string
  customPresets: TranslationPreset[]
  obsidianConfig: ObsidianConfig
  /** Model used for selection translation. Falls back to activeModel when null. */
  quickModel: ActiveModel | null
  selectionEnabled: boolean
  /** Triple-space in an input field rewrites it into idiomatic English */
  inputPolishEnabled: boolean
  /** Model for input polish. Falls back to quickModel, then activeModel. */
  polishModel: ActiveModel | null
  /** Append expression gaps to Obsidian. Off means they stay in local storage. */
  gapRecordEnabled: boolean
  /** Vault-relative path of the append-only gap log */
  gapNotePath: string
}
