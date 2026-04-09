# Contexta MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that uses free LLM models to provide high-quality AI translation of web article content, with bilingual display and Obsidian export.

**Architecture:** WXT browser extension with React UI. Content Script extracts article body via Defuddle, Background Service Worker orchestrates LLM translation via Vercel AI SDK, Content Script injects translations into the page DOM. Popup controls translation, Options manages provider config.

**Tech Stack:** WXT, React, shadcn/ui, Tailwind CSS, Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`), Defuddle, Vitest

---

## File Structure

```
contexta/
├── entrypoints/
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── LanguageSelector.tsx
│   │       ├── StyleSelector.tsx
│   │       ├── TranslateBar.tsx
│   │       ├── StatusBar.tsx
│   │       └── ExportDialog.tsx
│   ├── options/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ProviderManager.tsx
│   │       ├── ProviderForm.tsx
│   │       ├── PresetManager.tsx
│   │       └── ObsidianConfig.tsx
│   ├── background.ts
│   └── content.ts
├── lib/
│   ├── types.ts           # All shared type definitions
│   ├── constants.ts       # Preset providers, preset styles, default config
│   ├── storage.ts         # chrome.storage.local wrapper
│   ├── prompts.ts         # Prompt construction (pure functions)
│   ├── providers.ts       # Provider management & model list fetching
│   ├── translator.ts      # LLM translation via Vercel AI SDK
│   ├── extractor.ts       # Defuddle wrapper for content extraction
│   ├── injector.ts        # DOM injection/removal of translations
│   ├── messages.ts        # chrome.runtime message helpers
│   └── obsidian.ts        # Markdown generation & REST API export
├── components/
│   └── ui/                # shadcn/ui components (auto-generated)
├── tests/
│   ├── prompts.test.ts
│   ├── providers.test.ts
│   ├── extractor.test.ts
│   ├── injector.test.ts
│   └── obsidian.test.ts
├── assets/
│   └── icon.svg
├── public/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── wxt.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── components.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`, `vitest.config.ts`, `components.json`
- Create: `entrypoints/popup/index.html`, `entrypoints/popup/main.tsx`, `entrypoints/popup/App.tsx`
- Create: `entrypoints/options/index.html`, `entrypoints/options/main.tsx`, `entrypoints/options/App.tsx`
- Create: `entrypoints/background.ts`, `entrypoints/content.ts`
- Create: `lib/types.ts`

- [ ] **Step 1: Initialize WXT project with React template**

```bash
cd /Users/zhoujiacheng/code/contexta
npx wxt@latest init . --template react
```

Select default options when prompted. This creates the base WXT + React project.

- [ ] **Step 2: Install core dependencies**

```bash
npm install ai @ai-sdk/openai-compatible defuddle
npm install -D vitest happy-dom @types/chrome
```

- [ ] **Step 3: Install and configure Tailwind CSS**

```bash
npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer
```

Create `postcss.config.js`:
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

Create `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#059669',
          dark: '#065f46',
          light: '#ecfdf5',
          border: '#a7f3d0',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Neutral
- CSS variables: Yes
- CSS file path: `entrypoints/popup/style.css` (we'll adjust later)
- Tailwind config: `tailwind.config.ts`
- Components directory: `components`
- Utils: `lib/utils.ts`

Then install required shadcn components:
```bash
npx shadcn@latest add button select switch dialog checkbox label card input textarea dropdown-menu separator toast
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Create placeholder entrypoints**

Create `entrypoints/background.ts`:
```ts
export default defineBackground(() => {
  console.log('Contexta background service worker started')
})
```

Create `entrypoints/content.ts`:
```ts
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Contexta content script loaded')
  },
})
```

Update `entrypoints/popup/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="w-[360px] p-5 font-sans">
      <h1 className="text-lg font-semibold">Contexta</h1>
      <p className="text-sm text-muted-foreground">AI Translation</p>
    </div>
  )
}
```

Create `entrypoints/options/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contexta Settings</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Create `entrypoints/options/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Create `entrypoints/options/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold">Contexta 设置</h1>
    </div>
  )
}
```

Create `entrypoints/options/style.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 7: Update WXT config**

Update `wxt.config.ts`:
```ts
import { defineConfig } from 'wxt'

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Contexta - AI Translation',
    description: 'High-quality AI translation for web articles',
    permissions: ['storage', 'activeTab'],
    action: {
      default_popup: 'popup.html',
    },
  },
})
```

- [ ] **Step 8: Verify dev build**

```bash
npm run dev
```

Expected: WXT dev server starts, extension loads in Chrome with popup showing "Contexta".

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold WXT + React + Tailwind + shadcn project"
```

---

### Task 2: Type Definitions & Constants

**Files:**
- Create: `lib/types.ts`, `lib/constants.ts`

- [ ] **Step 1: Define all shared types**

Create `lib/types.ts`:
```ts
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
```

- [ ] **Step 2: Define constants and preset data**

Create `lib/constants.ts`:
```ts
import type { Provider, TranslationPreset, ObsidianConfig, StorageSchema } from './types'

export const PRESET_PROVIDERS: Omit<Provider, 'apiKey'>[] = [
  {
    id: 'zhipu',
    name: '智谱',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    isPreset: true,
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    isPreset: true,
  },
  {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    isPreset: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    isPreset: true,
  },
]

export const BUILTIN_PRESETS: TranslationPreset[] = [
  {
    id: 'tech-blog',
    name: '科技博客',
    isBuiltin: true,
    rules: `- 常见术语使用中文（如 Large Language Model → 大语言模型），生僻或新术语保留英文
- 风格参考机器之心、InfoQ 中文站的技术文章，兼顾专业性与可读性`,
  },
  {
    id: 'academic',
    name: '学术论文',
    isBuiltin: true,
    rules: `- 使用学术用语，保留论文引用标记（如 [20]）
- Figure 1: → 图 1:，Table 1: → 表 1:
- 风格参考学术期刊中文摘要，严谨准确，避免口语化表达`,
  },
  {
    id: 'popular-science',
    name: '科普读物',
    isBuiltin: true,
    rules: `- 专业概念需用通俗语言解释，避免堆砌术语
- 风格参考《万物》杂志，生动有趣，让非专业读者也能理解`,
  },
  {
    id: 'faithful',
    name: '忠实原文',
    isBuiltin: true,
    rules: `- 尽量保留原文句式结构，减少意译
- 直译优先，仅在严重不通顺时调整语序`,
  },
]

export const TARGET_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
] as const

export const DEFAULT_OBSIDIAN_CONFIG: ObsidianConfig = {
  apiUrl: 'http://localhost:27123',
  apiToken: '',
  vaultPath: 'Inbox/Contexta/',
}

export const DEFAULT_STORAGE: StorageSchema = {
  providers: PRESET_PROVIDERS.map((p) => ({ ...p, apiKey: '' })),
  activeModel: null,
  displayMode: 'bilingual',
  targetLang: 'zh-CN',
  activePresetId: 'tech-blog',
  customPresets: [],
  obsidianConfig: DEFAULT_OBSIDIAN_CONFIG,
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/constants.ts
git commit -m "feat: add type definitions and constants"
```

---

### Task 3: Chrome Storage Layer

**Files:**
- Create: `lib/storage.ts`

- [ ] **Step 1: Implement storage wrapper**

Create `lib/storage.ts`:
```ts
import type { StorageSchema } from './types'
import { DEFAULT_STORAGE } from './constants'

type StorageKey = keyof StorageSchema

export async function getStorage<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key)
  return result[key] ?? DEFAULT_STORAGE[key]
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/storage.ts
git commit -m "feat: add chrome.storage wrapper"
```

---

### Task 4: Translation Prompts

**Files:**
- Create: `lib/prompts.ts`, `tests/prompts.test.ts`

- [ ] **Step 1: Write tests for prompt builder**

Create `tests/prompts.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, buildUserPrompt, buildSummaryPrompt, buildQuotesPrompt } from '../lib/prompts'

describe('buildSystemPrompt', () => {
  it('includes target language', () => {
    const result = buildSystemPrompt('简体中文', '- 保留术语')
    expect(result).toContain('精通简体中文')
  })

  it('includes preset rules', () => {
    const rules = '- 风格参考机器之心'
    const result = buildSystemPrompt('简体中文', rules)
    expect(result).toContain(rules)
  })

  it('includes core translation rules', () => {
    const result = buildSystemPrompt('简体中文', '')
    expect(result).toContain('技术术语、产品名、公司名保留英文原文')
    expect(result).toContain('仅输出译文')
    expect(result).toContain('先直译')
  })
})

describe('buildUserPrompt', () => {
  it('includes current paragraph', () => {
    const result = buildUserPrompt({
      title: 'Test Article',
      current: 'Hello world',
    })
    expect(result).toContain('[请翻译以下段落]')
    expect(result).toContain('Hello world')
  })

  it('includes context when provided', () => {
    const result = buildUserPrompt({
      title: 'Test',
      current: 'Middle paragraph',
      prev: 'Previous text',
      next: 'Next text',
    })
    expect(result).toContain('[上文')
    expect(result).toContain('Previous text')
    expect(result).toContain('[下文')
    expect(result).toContain('Next text')
  })

  it('omits context sections when not provided', () => {
    const result = buildUserPrompt({
      title: 'Test',
      current: 'Only paragraph',
    })
    expect(result).not.toContain('[上文')
    expect(result).not.toContain('[下文')
  })

  it('includes article title', () => {
    const result = buildUserPrompt({
      title: 'Attention Is All You Need',
      current: 'Some text',
    })
    expect(result).toContain('[文章标题] Attention Is All You Need')
  })
})

describe('buildSummaryPrompt', () => {
  it('asks for summary of translated content', () => {
    const result = buildSummaryPrompt('这是一篇关于 AI 的文章...')
    expect(result).toContain('摘要')
    expect(result).toContain('这是一篇关于 AI 的文章...')
  })
})

describe('buildQuotesPrompt', () => {
  it('asks for key quotes extraction', () => {
    const result = buildQuotesPrompt('文章内容...')
    expect(result).toContain('金句')
    expect(result).toContain('文章内容...')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/prompts.test.ts
```

Expected: FAIL — `lib/prompts.ts` does not exist.

- [ ] **Step 3: Implement prompt builders**

Create `lib/prompts.ts`:
```ts
interface UserPromptParams {
  title: string
  current: string
  prev?: string
  next?: string
}

export function buildSystemPrompt(targetLang: string, presetRules: string): string {
  return `你是一位精通${targetLang}的专业翻译。

翻译规则：
- 技术术语、产品名、公司名保留英文原文（如 Transformer、OpenAI、Token）
- 代码、变量名、命令、URL 不翻译
- 全角括号换成半角括号，半角括号前后各加一个半角空格
- 英文术语与中文之间加一个半角空格
- 保留原始 Markdown 格式
- 仅输出译文，不要解释或附加内容
${presetRules ? '\n' + presetRules : ''}

策略：先直译，确保信息完整；再基于直译结果意译，使表达自然流畅，符合${targetLang}表达习惯。仅输出最终意译结果。`
}

export function buildUserPrompt(params: UserPromptParams): string {
  const parts: string[] = []

  parts.push(`[文章标题] ${params.title}`)

  if (params.prev) {
    parts.push('')
    parts.push('[上文（仅供参考，不翻译）]')
    parts.push(params.prev)
  }

  parts.push('')
  parts.push('[请翻译以下段落]')
  parts.push(params.current)

  if (params.next) {
    parts.push('')
    parts.push('[下文（仅供参考，不翻译）]')
    parts.push(params.next)
  }

  return parts.join('\n')
}

export function buildSummaryPrompt(translatedContent: string): string {
  return `请为以下文章生成一段简洁的摘要（3-5句话），概括文章的核心观点和主要内容。仅输出摘要文本，不要加标题或前缀。

${translatedContent}`
}

export function buildQuotesPrompt(translatedContent: string): string {
  return `请从以下文章中提取 3-5 条最精彩、最有洞察力的金句。每条金句单独一行，以"- "开头。仅输出金句列表，不要加标题或其他内容。

${translatedContent}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/prompts.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.ts
git commit -m "feat: add translation prompt builders with tests"
```

---

### Task 5: Provider Management & Model Fetching

**Files:**
- Create: `lib/providers.ts`, `tests/providers.test.ts`

- [ ] **Step 1: Write tests for provider logic**

Create `tests/providers.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/providers.test.ts
```

Expected: FAIL — `lib/providers.ts` does not exist.

- [ ] **Step 3: Implement provider management**

Create `lib/providers.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/providers.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/providers.ts tests/providers.test.ts
git commit -m "feat: add provider management and model fetching"
```

---

### Task 6: Content Extraction (Defuddle)

**Files:**
- Create: `lib/extractor.ts`, `tests/extractor.test.ts`

- [ ] **Step 1: Write tests for content extraction**

Create `tests/extractor.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { extractParagraphs, shouldSkipNode } from '../lib/extractor'

describe('shouldSkipNode', () => {
  it('skips pre elements', () => {
    const el = document.createElement('pre')
    el.textContent = 'code here'
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips code elements', () => {
    const el = document.createElement('code')
    el.textContent = 'inline code'
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips input elements', () => {
    const el = document.createElement('input')
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips elements with data-contexta attribute', () => {
    const el = document.createElement('p')
    el.setAttribute('data-contexta', 'translation')
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('skips empty text nodes', () => {
    const el = document.createElement('p')
    el.textContent = '   '
    expect(shouldSkipNode(el)).toBe(true)
  })

  it('does not skip paragraph with text', () => {
    const el = document.createElement('p')
    el.textContent = 'Hello world'
    expect(shouldSkipNode(el)).toBe(false)
  })
})

describe('extractParagraphs', () => {
  it('extracts paragraphs from a container', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <h1>Title</h1>
      <p>First paragraph.</p>
      <p>Second paragraph.</p>
    `

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0].text).toBe('Title')
    expect(paragraphs[0].tagName).toBe('H1')
    expect(paragraphs[1].text).toBe('First paragraph.')
    expect(paragraphs[1].prev).toBe('Title')
    expect(paragraphs[1].next).toBe('Second paragraph.')
  })

  it('skips code blocks', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <p>Before code.</p>
      <pre><code>const x = 1;</code></pre>
      <p>After code.</p>
    `

    const paragraphs = extractParagraphs(container)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].text).toBe('Before code.')
    expect(paragraphs[1].text).toBe('After code.')
  })

  it('assigns unique IDs', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>A</p><p>B</p>'

    const paragraphs = extractParagraphs(container)
    expect(paragraphs[0].id).not.toBe(paragraphs[1].id)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/extractor.test.ts
```

Expected: FAIL — `lib/extractor.ts` does not exist.

- [ ] **Step 3: Implement content extractor**

Create `lib/extractor.ts`:
```ts
import type { Paragraph, ArticleMetadata, ExtractedArticle } from './types'

const TEXT_BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION', 'DT', 'DD',
])

const SKIP_TAGS = new Set([
  'PRE', 'CODE', 'SCRIPT', 'STYLE', 'NOSCRIPT',
  'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
  'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME',
])

export function shouldSkipNode(el: Element): boolean {
  if (el.hasAttribute('data-contexta')) return true
  if (SKIP_TAGS.has(el.tagName)) return true
  if (el.closest('pre, code')) return true
  const text = el.textContent?.trim() ?? ''
  if (text.length === 0) return false // empty elements are just skipped in extractParagraphs
  // Actually for shouldSkipNode: skip if empty
  if (text.length === 0) return true
  return false
}

export function extractParagraphs(container: Element): Paragraph[] {
  const nodes: { el: Element; text: string; tagName: string }[] = []

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element
      if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT
      if (el.hasAttribute('data-contexta')) return NodeFilter.FILTER_REJECT
      if (TEXT_BLOCK_TAGS.has(el.tagName)) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_SKIP
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    const el = node as Element
    const text = el.textContent?.trim() ?? ''
    if (text.length === 0) continue
    nodes.push({ el, text, tagName: el.tagName })
  }

  return nodes.map((n, i) => {
    const id = `ctx-${i}-${Date.now()}`
    n.el.setAttribute('data-contexta-id', id)
    return {
      id,
      text: n.text,
      tagName: n.tagName,
      prev: i > 0 ? nodes[i - 1].text : undefined,
      next: i < nodes.length - 1 ? nodes[i + 1].text : undefined,
    }
  })
}

export async function extractArticle(doc: Document): Promise<ExtractedArticle> {
  const { default: Defuddle } = await import('defuddle')
  const result = new Defuddle(doc).parse()

  // Create a temporary container with the extracted content
  const container = doc.createElement('div')
  container.innerHTML = result.content

  const paragraphs = extractParagraphs(container)

  // Now we need to map the extracted paragraphs back to the actual DOM
  // For this, we'll re-extract from the real page using Defuddle's content
  // The actual DOM mapping happens in content.ts

  const metadata: ArticleMetadata = {
    title: result.title || doc.title,
    author: result.author || undefined,
    published: result.published || undefined,
    url: doc.location?.href ?? '',
  }

  return { paragraphs, metadata }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/extractor.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/extractor.ts tests/extractor.test.ts
git commit -m "feat: add content extraction with Defuddle"
```

---

### Task 7: DOM Injection

**Files:**
- Create: `lib/injector.ts`, `tests/injector.test.ts`

- [ ] **Step 1: Write tests for DOM injection**

Create `tests/injector.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { injectTranslation, clearAllTranslations, switchDisplayMode } from '../lib/injector'

describe('injectTranslation', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)
  })

  it('inserts translation node after original', () => {
    const p = document.createElement('p')
    p.textContent = 'Hello world'
    p.setAttribute('data-contexta-id', 'ctx-0')
    container.appendChild(p)

    injectTranslation('ctx-0', '你好世界', 'bilingual')

    const translated = container.querySelector('[data-contexta="translation"]')
    expect(translated).not.toBeNull()
    expect(translated!.textContent).toBe('你好世界')
    expect(translated!.tagName).toBe('P')
  })

  it('uses the same tag as the original element', () => {
    const h2 = document.createElement('h2')
    h2.textContent = 'Title'
    h2.setAttribute('data-contexta-id', 'ctx-1')
    container.appendChild(h2)

    injectTranslation('ctx-1', '标题', 'bilingual')

    const translated = container.querySelector('[data-contexta="translation"]')
    expect(translated!.tagName).toBe('H2')
  })

  it('in bilingual mode, both original and translation are visible', () => {
    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-2')
    container.appendChild(p)

    injectTranslation('ctx-2', '翻译', 'bilingual')

    expect(p.style.display).not.toBe('none')
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(translated.style.display).not.toBe('none')
  })

  it('in target-only mode, original is hidden', () => {
    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-3')
    container.appendChild(p)

    injectTranslation('ctx-3', '翻译', 'target-only')

    expect(p.style.display).toBe('none')
  })
})

describe('clearAllTranslations', () => {
  it('removes all translation nodes and restores originals', () => {
    const container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)

    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-0')
    p.style.display = 'none'
    container.appendChild(p)

    const translated = document.createElement('p')
    translated.textContent = '翻译'
    translated.setAttribute('data-contexta', 'translation')
    translated.setAttribute('data-contexta-for', 'ctx-0')
    container.appendChild(translated)

    clearAllTranslations()

    expect(container.querySelector('[data-contexta="translation"]')).toBeNull()
    expect(p.style.display).not.toBe('none')
    expect(p.hasAttribute('data-contexta-id')).toBe(false)
  })
})

describe('switchDisplayMode', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.innerHTML = ''
    document.body.appendChild(container)

    const p = document.createElement('p')
    p.textContent = 'Original'
    p.setAttribute('data-contexta-id', 'ctx-0')
    container.appendChild(p)

    const translated = document.createElement('p')
    translated.textContent = '翻译'
    translated.setAttribute('data-contexta', 'translation')
    translated.setAttribute('data-contexta-for', 'ctx-0')
    container.appendChild(translated)
  })

  it('bilingual mode shows both', () => {
    switchDisplayMode('bilingual')

    const original = container.querySelector('[data-contexta-id="ctx-0"]') as HTMLElement
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(original.style.display).not.toBe('none')
    expect(translated.style.display).not.toBe('none')
  })

  it('target-only mode hides originals', () => {
    switchDisplayMode('target-only')

    const original = container.querySelector('[data-contexta-id="ctx-0"]') as HTMLElement
    const translated = container.querySelector('[data-contexta="translation"]') as HTMLElement
    expect(original.style.display).toBe('none')
    expect(translated.style.display).not.toBe('none')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/injector.test.ts
```

Expected: FAIL — `lib/injector.ts` does not exist.

- [ ] **Step 3: Implement DOM injector**

Create `lib/injector.ts`:
```ts
import type { DisplayMode } from './types'

export function injectTranslation(
  paragraphId: string,
  translation: string,
  mode: DisplayMode,
): void {
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const translated = document.createElement(original.tagName)
  translated.textContent = translation
  translated.setAttribute('data-contexta', 'translation')
  translated.setAttribute('data-contexta-for', paragraphId)

  original.insertAdjacentElement('afterend', translated)

  if (mode === 'target-only') {
    ;(original as HTMLElement).style.display = 'none'
  }
}

export function injectError(paragraphId: string, error: string): void {
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  // Remove existing error if any
  const existingError = document.querySelector(`[data-contexta="error"][data-contexta-for="${paragraphId}"]`)
  existingError?.remove()

  const errorEl = document.createElement('div')
  errorEl.setAttribute('data-contexta', 'error')
  errorEl.setAttribute('data-contexta-for', paragraphId)
  errorEl.style.cssText = 'color:#dc2626;font-size:13px;padding:4px 0;display:flex;align-items:center;gap:8px;'
  errorEl.innerHTML = `<span>翻译失败: ${error}</span><button data-contexta-retry="${paragraphId}" style="color:#059669;cursor:pointer;border:none;background:none;text-decoration:underline;font-size:13px;">重试</button>`

  original.insertAdjacentElement('afterend', errorEl)
}

export function injectLoading(paragraphId: string): void {
  const original = document.querySelector(`[data-contexta-id="${paragraphId}"]`)
  if (!original) return

  const loading = document.createElement('div')
  loading.setAttribute('data-contexta', 'loading')
  loading.setAttribute('data-contexta-for', paragraphId)
  loading.style.cssText = 'color:#94a3b8;font-size:13px;padding:4px 0;'
  loading.textContent = '翻译中...'

  original.insertAdjacentElement('afterend', loading)
}

export function removeLoading(paragraphId: string): void {
  const loading = document.querySelector(`[data-contexta="loading"][data-contexta-for="${paragraphId}"]`)
  loading?.remove()
}

export function removeError(paragraphId: string): void {
  const error = document.querySelector(`[data-contexta="error"][data-contexta-for="${paragraphId}"]`)
  error?.remove()
}

export function clearAllTranslations(): void {
  // Remove all injected nodes
  document.querySelectorAll('[data-contexta]').forEach((el) => el.remove())

  // Restore hidden originals and remove markers
  document.querySelectorAll('[data-contexta-id]').forEach((el) => {
    ;(el as HTMLElement).style.display = ''
    el.removeAttribute('data-contexta-id')
  })
}

export function switchDisplayMode(mode: DisplayMode): void {
  const originals = document.querySelectorAll('[data-contexta-id]')
  originals.forEach((el) => {
    ;(el as HTMLElement).style.display = mode === 'target-only' ? 'none' : ''
  })

  const translations = document.querySelectorAll('[data-contexta="translation"]')
  translations.forEach((el) => {
    ;(el as HTMLElement).style.display = ''
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/injector.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/injector.ts tests/injector.test.ts
git commit -m "feat: add DOM translation injection and mode switching"
```

---

### Task 8: Translation Engine (Vercel AI SDK)

**Files:**
- Create: `lib/translator.ts`

- [ ] **Step 1: Implement translation engine**

Create `lib/translator.ts`:
```ts
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { Provider, Paragraph, ArticleMetadata, TranslationPreset } from './types'
import { buildSystemPrompt, buildUserPrompt, buildSummaryPrompt, buildQuotesPrompt } from './prompts'
import { BUILTIN_PRESETS } from './constants'

interface TranslateOptions {
  provider: Provider
  modelId: string
  paragraph: Paragraph
  metadata: ArticleMetadata
  targetLang: string
  preset: TranslationPreset
}

function createProvider(provider: Provider) {
  return createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl.replace(/\/$/, ''),
    apiKey: provider.apiKey,
  })
}

export async function translateParagraph(options: TranslateOptions): Promise<string> {
  const { provider, modelId, paragraph, metadata, targetLang, preset } = options

  const llm = createProvider(provider)
  const systemPrompt = buildSystemPrompt(targetLang, preset.rules)
  const userPrompt = buildUserPrompt({
    title: metadata.title,
    current: paragraph.text,
    prev: paragraph.prev,
    next: paragraph.next,
  })

  const { text } = await generateText({
    model: llm(modelId),
    system: systemPrompt,
    prompt: userPrompt,
  })

  return text.trim()
}

export async function generateSummary(
  provider: Provider,
  modelId: string,
  translatedContent: string,
): Promise<string> {
  const llm = createProvider(provider)
  const { text } = await generateText({
    model: llm(modelId),
    prompt: buildSummaryPrompt(translatedContent),
  })
  return text.trim()
}

export async function generateQuotes(
  provider: Provider,
  modelId: string,
  translatedContent: string,
): Promise<string> {
  const llm = createProvider(provider)
  const { text } = await generateText({
    model: llm(modelId),
    prompt: buildQuotesPrompt(translatedContent),
  })
  return text.trim()
}

export function resolvePreset(
  presetId: string,
  customPresets: TranslationPreset[],
): TranslationPreset {
  const all = [...BUILTIN_PRESETS, ...customPresets]
  return all.find((p) => p.id === presetId) ?? BUILTIN_PRESETS[0]
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/translator.ts
git commit -m "feat: add LLM translation engine with Vercel AI SDK"
```

---

### Task 9: Message Helpers & Background Service Worker

**Files:**
- Create: `lib/messages.ts`
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: Create message helpers**

Create `lib/messages.ts`:
```ts
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
```

- [ ] **Step 2: Implement background service worker**

Replace `entrypoints/background.ts`:
```ts
import { onMessage, sendToTab } from '@/lib/messages'
import { getStorage } from '@/lib/storage'
import { translateParagraph, generateSummary, generateQuotes, resolvePreset } from '@/lib/translator'
import { resolveActiveProvider, fetchModels } from '@/lib/providers'
import type { Message, ExtractedArticle, Paragraph, ExportOptions } from '@/lib/types'
import { buildObsidianMarkdown, exportToObsidian } from '@/lib/obsidian'

// Store translation results for export
let lastArticle: ExtractedArticle | null = null
let lastTranslations: Map<string, string> = new Map()

export default defineBackground(() => {
  onMessage(async (message, sender) => {
    switch (message.action) {
      case 'translate':
        return handleTranslate(message, sender)
      case 'extract-result':
        return handleExtractResult(message, sender)
      case 'fetch-models':
        return handleFetchModels(message)
      case 'export-obsidian':
        return handleExport(message)
      case 'retry-paragraph':
        return handleRetry(message, sender)
    }
  })
})

async function handleTranslate(
  message: Extract<Message, { action: 'translate' }>,
  sender: chrome.runtime.MessageSender,
) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  // Store settings for translation
  await chrome.storage.local.set({
    _pendingTranslation: {
      mode: message.mode,
      targetLang: message.targetLang,
      presetId: message.presetId,
      tabId: tab.id,
    },
  })

  // Clear previous translations on the page
  await sendToTab(tab.id, { action: 'clear-translations' })

  // Ask content script to extract
  await sendToTab(tab.id, { action: 'extract' })
}

async function handleExtractResult(
  message: Extract<Message, { action: 'extract-result' }>,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (!tabId) return

  const pending = (await chrome.storage.local.get('_pendingTranslation'))._pendingTranslation
  if (!pending) return

  const { mode, targetLang, presetId } = pending
  const { article } = message

  lastArticle = article
  lastTranslations = new Map()

  const [providers, customPresets] = await Promise.all([
    getStorage('providers'),
    getStorage('customPresets'),
  ])
  const activeModel = await getStorage('activeModel')
  const resolved = resolveActiveProvider(providers, activeModel)
  if (!resolved) {
    await sendToTab(tabId, {
      action: 'translation-error',
      paragraphId: '',
      error: '请先在设置中配置服务商和模型',
    })
    return
  }

  const preset = resolvePreset(presetId, customPresets)
  const { paragraphs } = article
  const total = paragraphs.length

  // Translate paragraphs sequentially
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i]

    await sendToTab(tabId, {
      action: 'translation-progress',
      current: i + 1,
      total,
    })

    try {
      const translation = await translateParagraph({
        provider: resolved.provider,
        modelId: resolved.modelId,
        paragraph,
        metadata: article.metadata,
        targetLang,
        preset,
      })

      lastTranslations.set(paragraph.id, translation)

      await sendToTab(tabId, {
        action: 'translation-result',
        paragraphId: paragraph.id,
        translation,
      })
    } catch (err) {
      await sendToTab(tabId, {
        action: 'translation-error',
        paragraphId: paragraph.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  await sendToTab(tabId, { action: 'translation-complete' })
}

async function handleRetry(
  message: Extract<Message, { action: 'retry-paragraph' }>,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id
  if (!tabId || !lastArticle) return

  const paragraph = lastArticle.paragraphs.find((p) => p.id === message.paragraphId)
  if (!paragraph) return

  const [providers, customPresets, activeModel, targetLang, presetId] = await Promise.all([
    getStorage('providers'),
    getStorage('customPresets'),
    getStorage('activeModel'),
    getStorage('targetLang'),
    getStorage('activePresetId'),
  ])

  const resolved = resolveActiveProvider(providers, activeModel)
  if (!resolved) return

  const preset = resolvePreset(presetId, customPresets)

  try {
    const translation = await translateParagraph({
      provider: resolved.provider,
      modelId: resolved.modelId,
      paragraph,
      metadata: lastArticle.metadata,
      targetLang,
      preset,
    })

    lastTranslations.set(paragraph.id, translation)

    await sendToTab(tabId, {
      action: 'translation-result',
      paragraphId: paragraph.id,
      translation,
    })
  } catch (err) {
    await sendToTab(tabId, {
      action: 'translation-error',
      paragraphId: paragraph.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function handleFetchModels(
  message: Extract<Message, { action: 'fetch-models' }>,
) {
  const providers = await getStorage('providers')
  const provider = providers.find((p) => p.id === message.providerId)
  if (!provider) return { action: 'fetch-models-result', models: [], error: 'Provider not found' }

  try {
    const models = await fetchModels(provider)
    return { action: 'fetch-models-result', models }
  } catch (err) {
    return { action: 'fetch-models-result', models: [], error: String(err) }
  }
}

async function handleExport(
  message: Extract<Message, { action: 'export-obsidian' }>,
) {
  if (!lastArticle || lastTranslations.size === 0) {
    return { action: 'export-result', success: false, error: '没有可导出的翻译内容' }
  }

  try {
    const [obsidianConfig, providers, activeModel] = await Promise.all([
      getStorage('obsidianConfig'),
      getStorage('providers'),
      getStorage('activeModel'),
    ])

    const resolved = resolveActiveProvider(providers, activeModel)
    const { options } = message

    let summary: string | undefined
    let quotes: string | undefined

    if (resolved && (options.includeSummary || options.includeQuotes)) {
      const translatedContent = lastArticle.paragraphs
        .map((p) => lastTranslations.get(p.id) ?? '')
        .filter(Boolean)
        .join('\n\n')

      if (options.includeSummary) {
        summary = await generateSummary(resolved.provider, resolved.modelId, translatedContent)
      }
      if (options.includeQuotes) {
        quotes = await generateQuotes(resolved.provider, resolved.modelId, translatedContent)
      }
    }

    const markdown = buildObsidianMarkdown({
      article: lastArticle,
      translations: lastTranslations,
      format: options.format,
      summary,
      quotes,
    })

    await exportToObsidian(obsidianConfig, lastArticle.metadata.title, markdown)
    return { action: 'export-result', success: true }
  } catch (err) {
    return { action: 'export-result', success: false, error: String(err) }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/messages.ts entrypoints/background.ts
git commit -m "feat: add background service worker with translation orchestration"
```

---

### Task 10: Content Script

**Files:**
- Modify: `entrypoints/content.ts`

- [ ] **Step 1: Implement content script**

Replace `entrypoints/content.ts`:
```ts
import { onMessage } from '@/lib/messages'
import { extractParagraphs } from '@/lib/extractor'
import {
  injectTranslation,
  injectError,
  injectLoading,
  removeLoading,
  removeError,
  clearAllTranslations,
  switchDisplayMode,
} from '@/lib/injector'
import type { Message, DisplayMode } from '@/lib/types'

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let currentMode: DisplayMode = 'bilingual'

    // Load saved display mode
    const stored = await chrome.storage.local.get('displayMode')
    if (stored.displayMode) currentMode = stored.displayMode

    onMessage(async (message) => {
      switch (message.action) {
        case 'extract':
          return handleExtract()
        case 'translation-result':
          return handleTranslationResult(message)
        case 'translation-error':
          return handleTranslationError(message)
        case 'translation-progress':
          return handleProgress(message)
        case 'translation-complete':
          removeAllLoadingIndicators()
          return
        case 'clear-translations':
          clearAllTranslations()
          return
        case 'switch-mode':
          currentMode = message.mode
          switchDisplayMode(currentMode)
          return
      }
    })

    // Handle retry button clicks (event delegation)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const retryId = target.getAttribute('data-contexta-retry')
      if (retryId) {
        removeError(retryId)
        injectLoading(retryId)
        chrome.runtime.sendMessage({ action: 'retry-paragraph', paragraphId: retryId })
      }
    })

    async function handleExtract() {
      const { default: Defuddle } = await import('defuddle')
      const clonedDoc = document.cloneNode(true) as Document
      const result = new Defuddle(clonedDoc).parse()

      // Find the content area in the real DOM by matching Defuddle's output
      // Strategy: find all text block elements and extract from them
      const contentContainer = findContentContainer(result.content)
      if (!contentContainer) {
        chrome.runtime.sendMessage({
          action: 'translation-error',
          paragraphId: '',
          error: '无法识别正文区域',
        })
        return
      }

      const paragraphs = extractParagraphs(contentContainer)

      chrome.runtime.sendMessage({
        action: 'extract-result',
        article: {
          paragraphs,
          metadata: {
            title: result.title || document.title,
            author: result.author || undefined,
            published: result.published || undefined,
            url: location.href,
          },
        },
      })
    }

    function handleTranslationResult(message: Extract<Message, { action: 'translation-result' }>) {
      removeLoading(message.paragraphId)
      removeError(message.paragraphId)
      injectTranslation(message.paragraphId, message.translation, currentMode)
    }

    function handleTranslationError(message: Extract<Message, { action: 'translation-error' }>) {
      removeLoading(message.paragraphId)
      if (message.paragraphId) {
        injectError(message.paragraphId, message.error)
      }
    }

    function handleProgress(message: Extract<Message, { action: 'translation-progress' }>) {
      const { current, total } = message
      // Add loading indicator for current paragraph
      const article = document.querySelectorAll('[data-contexta-id]')
      if (current <= article.length) {
        const currentEl = article[current - 1]
        const id = currentEl.getAttribute('data-contexta-id')
        if (id && !document.querySelector(`[data-contexta-for="${id}"]`)) {
          injectLoading(id)
        }
      }
    }

    function removeAllLoadingIndicators() {
      document.querySelectorAll('[data-contexta="loading"]').forEach((el) => el.remove())
    }

    function findContentContainer(defuddleHtml: string): Element | null {
      // Parse Defuddle output to get text snippets
      const temp = document.createElement('div')
      temp.innerHTML = defuddleHtml
      const snippets = Array.from(temp.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
        .map((el) => el.textContent?.trim())
        .filter((t): t is string => !!t && t.length > 20)
        .slice(0, 5)

      if (snippets.length === 0) return document.body

      // Find the common ancestor of elements containing these snippets
      const candidates: Element[] = []
      for (const snippet of snippets) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        let node: Node | null
        while ((node = walker.nextNode())) {
          if (node.textContent?.includes(snippet)) {
            const parent = node.parentElement?.closest('article, main, [role="main"], .post-content, .article-content, .entry-content, .content')
              ?? node.parentElement?.closest('div')
            if (parent) {
              candidates.push(parent)
              break
            }
          }
        }
      }

      if (candidates.length === 0) return document.body

      // Find common ancestor
      let ancestor = candidates[0]
      for (const candidate of candidates.slice(1)) {
        while (ancestor && !ancestor.contains(candidate)) {
          ancestor = ancestor.parentElement!
        }
      }

      return ancestor ?? document.body
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add entrypoints/content.ts
git commit -m "feat: add content script with extraction and injection"
```

---

### Task 11: Obsidian Export

**Files:**
- Create: `lib/obsidian.ts`, `tests/obsidian.test.ts`

- [ ] **Step 1: Write tests for markdown generation**

Create `tests/obsidian.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildObsidianMarkdown } from '../lib/obsidian'
import type { ExtractedArticle } from '../lib/types'

const mockArticle: ExtractedArticle = {
  paragraphs: [
    { id: '1', text: 'Hello world', tagName: 'P' },
    { id: '2', text: 'Second paragraph', tagName: 'P', prev: 'Hello world' },
  ],
  metadata: {
    title: 'Test Article',
    author: 'John Doe',
    published: '2026-04-09',
    url: 'https://example.com/article',
  },
}

const mockTranslations = new Map([
  ['1', '你好世界'],
  ['2', '第二段'],
])

describe('buildObsidianMarkdown', () => {
  it('generates frontmatter with metadata', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
    })
    expect(result).toContain('title: "Test Article"')
    expect(result).toContain('author: "John Doe"')
    expect(result).toContain('source: "https://example.com/article"')
  })

  it('generates target-only format', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
    })
    expect(result).toContain('你好世界')
    expect(result).toContain('第二段')
    expect(result).not.toContain('Hello world')
  })

  it('generates bilingual format', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'bilingual',
    })
    expect(result).toContain('Hello world')
    expect(result).toContain('你好世界')
  })

  it('generates source-only format', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'source-only',
    })
    expect(result).toContain('Hello world')
    expect(result).not.toContain('你好世界')
  })

  it('includes summary callout when provided', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
      summary: '这是一篇关于测试的文章。',
    })
    expect(result).toContain('> [!abstract] 摘要')
    expect(result).toContain('> 这是一篇关于测试的文章。')
  })

  it('includes quotes callout when provided', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
      quotes: '- "精彩句子一"\n- "精彩句子二"',
    })
    expect(result).toContain('> [!quote] 金句')
    expect(result).toContain('> - "精彩句子一"')
  })

  it('omits summary/quotes sections when not provided', () => {
    const result = buildObsidianMarkdown({
      article: mockArticle,
      translations: mockTranslations,
      format: 'target-only',
    })
    expect(result).not.toContain('[!abstract]')
    expect(result).not.toContain('[!quote]')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/obsidian.test.ts
```

Expected: FAIL — `lib/obsidian.ts` does not exist.

- [ ] **Step 3: Implement Obsidian export**

Create `lib/obsidian.ts`:
```ts
import type { ExtractedArticle, ExportFormat, ObsidianConfig } from './types'

interface BuildMarkdownOptions {
  article: ExtractedArticle
  translations: Map<string, string>
  format: ExportFormat
  summary?: string
  quotes?: string
}

export function buildObsidianMarkdown(options: BuildMarkdownOptions): string {
  const { article, translations, format, summary, quotes } = options
  const { metadata, paragraphs } = article
  const parts: string[] = []

  // Frontmatter
  parts.push('---')
  parts.push(`title: "${metadata.title}"`)
  if (metadata.author) parts.push(`author: "${metadata.author}"`)
  parts.push(`source: "${metadata.url}"`)
  if (metadata.published) parts.push(`date: ${metadata.published}`)
  parts.push('translated: true')
  parts.push('---')
  parts.push('')

  // Summary callout
  if (summary) {
    parts.push('> [!abstract] 摘要')
    for (const line of summary.split('\n')) {
      parts.push(`> ${line}`)
    }
    parts.push('')
  }

  // Quotes callout
  if (quotes) {
    parts.push('> [!quote] 金句')
    for (const line of quotes.split('\n')) {
      parts.push(`> ${line}`)
    }
    parts.push('')
  }

  // Add separator if we had callouts
  if (summary || quotes) {
    parts.push('---')
    parts.push('')
  }

  // Content
  for (const paragraph of paragraphs) {
    const translation = translations.get(paragraph.id)

    switch (format) {
      case 'target-only':
        if (translation) parts.push(translation)
        break
      case 'source-only':
        parts.push(paragraph.text)
        break
      case 'bilingual':
        parts.push(paragraph.text)
        parts.push('')
        if (translation) parts.push(translation)
        break
    }
    parts.push('')
  }

  return parts.join('\n')
}

export async function exportToObsidian(
  config: ObsidianConfig,
  title: string,
  markdown: string,
): Promise<void> {
  const safeName = title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100)
  const path = `${config.vaultPath.replace(/\/$/, '')}/${safeName}.md`

  const url = `${config.apiUrl.replace(/\/$/, '')}/vault/${encodeURIComponent(path)}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'text/markdown',
    },
    body: markdown,
  })

  if (!response.ok) {
    throw new Error(`Obsidian API error: ${response.status} ${response.statusText}`)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/obsidian.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/obsidian.ts tests/obsidian.test.ts
git commit -m "feat: add Obsidian markdown export with callouts"
```

---

### Task 12: Popup UI

**Files:**
- Modify: `entrypoints/popup/App.tsx`, `entrypoints/popup/style.css`
- Create: `entrypoints/popup/components/Header.tsx`, `entrypoints/popup/components/LanguageSelector.tsx`, `entrypoints/popup/components/StyleSelector.tsx`, `entrypoints/popup/components/TranslateBar.tsx`, `entrypoints/popup/components/StatusBar.tsx`, `entrypoints/popup/components/ExportDialog.tsx`

- [ ] **Step 1: Create Header component**

Create `entrypoints/popup/components/Header.tsx`:
```tsx
export default function Header() {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-gradient-to-br from-primary-dark to-primary rounded-md flex items-center justify-center text-white font-bold text-sm">
          C
        </div>
        <span className="font-semibold text-[15px] text-gray-800">Contexta</span>
      </div>
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="bg-transparent border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer"
      >
        ⚙️ 设置
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create LanguageSelector component**

Create `entrypoints/popup/components/LanguageSelector.tsx`:
```tsx
import { TARGET_LANGUAGES } from '@/lib/constants'

interface Props {
  targetLang: string
  onChange: (lang: string) => void
}

export default function LanguageSelector({ targetLang, onChange }: Props) {
  return (
    <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 bg-primary-light rounded-lg border border-primary-border">
      <div className="flex-1 text-center">
        <div className="text-[11px] text-primary-dark/70 mb-0.5">源语言</div>
        <div className="text-[13px] font-medium text-primary-dark">自动检测</div>
      </div>
      <div className="text-primary text-base">→</div>
      <div className="flex-1 text-center">
        <div className="text-[11px] text-primary-dark/70 mb-0.5">目标语言</div>
        <select
          value={targetLang}
          onChange={(e) => onChange(e.target.value)}
          className="text-[13px] font-medium text-primary-dark bg-transparent border-none outline-none cursor-pointer text-center"
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create StyleSelector component**

Create `entrypoints/popup/components/StyleSelector.tsx`:
```tsx
import { BUILTIN_PRESETS } from '@/lib/constants'
import type { TranslationPreset } from '@/lib/types'

interface Props {
  activePresetId: string
  customPresets: TranslationPreset[]
  onChange: (id: string) => void
}

export default function StyleSelector({ activePresetId, customPresets, onChange }: Props) {
  const allPresets = [...BUILTIN_PRESETS, ...customPresets]

  return (
    <div className="mb-4">
      <select
        value={activePresetId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-primary-light border border-primary-border rounded-lg text-[13px] text-primary-dark outline-none cursor-pointer"
      >
        {allPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 4: Create TranslateBar component**

Create `entrypoints/popup/components/TranslateBar.tsx`:
```tsx
import type { DisplayMode } from '@/lib/types'

interface Props {
  mode: DisplayMode
  onModeChange: (mode: DisplayMode) => void
  onTranslate: () => void
  isTranslating: boolean
  progress?: { current: number; total: number }
}

export default function TranslateBar({ mode, onModeChange, onTranslate, isTranslating, progress }: Props) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      {/* Pill toggle */}
      <div className="flex bg-primary-light border border-primary-border rounded-lg overflow-hidden flex-shrink-0">
        <button
          onClick={() => onModeChange('bilingual')}
          className={`px-2.5 py-2.5 text-[11px] font-semibold border-none cursor-pointer transition-colors ${
            mode === 'bilingual'
              ? 'bg-primary-dark text-white'
              : 'bg-transparent text-primary-dark'
          }`}
        >
          双语
        </button>
        <button
          onClick={() => onModeChange('target-only')}
          className={`px-2.5 py-2.5 text-[11px] font-semibold border-none cursor-pointer transition-colors ${
            mode === 'target-only'
              ? 'bg-primary-dark text-white'
              : 'bg-transparent text-primary-dark'
          }`}
        >
          译文
        </button>
      </div>

      {/* Translate button */}
      <button
        onClick={onTranslate}
        disabled={isTranslating}
        className="flex-1 py-2.5 bg-gradient-to-r from-primary-dark to-primary text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer shadow-md shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      >
        {isTranslating && progress
          ? `翻译中 ${progress.current}/${progress.total}`
          : '✨ AI 翻译'}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create StatusBar component**

Create `entrypoints/popup/components/StatusBar.tsx`:
```tsx
interface Props {
  providerName: string
  modelId: string
  status?: string
}

export default function StatusBar({ providerName, modelId, status }: Props) {
  const display = providerName && modelId
    ? `${providerName} · ${modelId}`
    : '未配置服务商'

  return (
    <div className="text-center text-xs text-gray-400">
      {status ?? `当前：${display}`}
    </div>
  )
}
```

- [ ] **Step 6: Create ExportDialog component**

Create `entrypoints/popup/components/ExportDialog.tsx`:
```tsx
import { useState } from 'react'
import type { ExportFormat } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onExport: (format: ExportFormat, includeSummary: boolean, includeQuotes: boolean) => void
  isExporting: boolean
}

export default function ExportDialog({ open, onClose, onExport, isExporting }: Props) {
  const [format, setFormat] = useState<ExportFormat>('target-only')
  const [includeSummary, setIncludeSummary] = useState(true)
  const [includeQuotes, setIncludeQuotes] = useState(true)

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-5 w-[320px] shadow-xl">
        <h3 className="text-[15px] font-semibold text-gray-800 mb-4">导出到 Obsidian</h3>

        {/* Format selection */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-2 block">导出格式</label>
          {(['target-only', 'bilingual', 'source-only'] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 py-1.5 cursor-pointer">
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                className="accent-primary"
              />
              <span className="text-[13px] text-gray-700">
                {{ 'target-only': '仅译文', bilingual: '双语对照', 'source-only': '仅原文' }[f]}
              </span>
            </label>
          ))}
        </div>

        {/* Options */}
        <div className="mb-4 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-[13px] text-gray-700">生成摘要</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeQuotes}
              onChange={(e) => setIncludeQuotes(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-[13px] text-gray-700">提取金句</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-[13px] border-none cursor-pointer hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={() => onExport(format, includeSummary, includeQuotes)}
            disabled={isExporting}
            className="flex-1 py-2 bg-primary text-white rounded-lg text-[13px] border-none cursor-pointer disabled:opacity-60"
          >
            {isExporting ? '导出中...' : '确认导出'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Wire up Popup App**

Replace `entrypoints/popup/App.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import LanguageSelector from './components/LanguageSelector'
import StyleSelector from './components/StyleSelector'
import TranslateBar from './components/TranslateBar'
import StatusBar from './components/StatusBar'
import ExportDialog from './components/ExportDialog'
import { getStorage, setStorage } from '@/lib/storage'
import { sendToBackground, sendToActiveTab } from '@/lib/messages'
import { getProviderById } from '@/lib/providers'
import type { DisplayMode, ExportFormat, TranslationPreset } from '@/lib/types'

export default function App() {
  const [targetLang, setTargetLang] = useState('zh-CN')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bilingual')
  const [activePresetId, setActivePresetId] = useState('tech-blog')
  const [customPresets, setCustomPresets] = useState<TranslationPreset[]>([])
  const [providerName, setProviderName] = useState('')
  const [modelId, setModelId] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [showExport, setShowExport] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const [tl, dm, apId, cp, providers, activeModel] = await Promise.all([
      getStorage('targetLang'),
      getStorage('displayMode'),
      getStorage('activePresetId'),
      getStorage('customPresets'),
      getStorage('providers'),
      getStorage('activeModel'),
    ])
    setTargetLang(tl)
    setDisplayMode(dm)
    setActivePresetId(apId)
    setCustomPresets(cp)

    if (activeModel) {
      const provider = getProviderById(providers, activeModel.providerId)
      if (provider) {
        setProviderName(provider.name)
        setModelId(activeModel.modelId)
      }
    }
  }

  const handleTargetLangChange = useCallback(async (lang: string) => {
    setTargetLang(lang)
    await setStorage('targetLang', lang)
  }, [])

  const handlePresetChange = useCallback(async (id: string) => {
    setActivePresetId(id)
    await setStorage('activePresetId', id)
  }, [])

  const handleModeChange = useCallback(async (mode: DisplayMode) => {
    setDisplayMode(mode)
    await setStorage('displayMode', mode)
    sendToActiveTab({ action: 'switch-mode', mode }).catch(() => {})
  }, [])

  const handleTranslate = useCallback(async () => {
    setIsTranslating(true)
    setProgress(undefined)
    setStatus(undefined)

    // Listen for progress updates
    const listener = (message: { action: string; current?: number; total?: number }) => {
      if (message.action === 'translation-progress') {
        setProgress({ current: message.current!, total: message.total! })
      }
      if (message.action === 'translation-complete') {
        setIsTranslating(false)
        setProgress(undefined)
        setStatus('翻译完成')
      }
    }
    chrome.runtime.onMessage.addListener(listener)

    try {
      await sendToBackground({
        action: 'translate',
        mode: displayMode,
        targetLang,
        presetId: activePresetId,
      })
    } catch (err) {
      setIsTranslating(false)
      setStatus('翻译失败')
    }
  }, [displayMode, targetLang, activePresetId])

  const handleExport = useCallback(async (
    format: ExportFormat,
    includeSummary: boolean,
    includeQuotes: boolean,
  ) => {
    setIsExporting(true)
    try {
      const result = await sendToBackground({
        action: 'export-obsidian',
        options: { format, includeSummary, includeQuotes },
      }) as { success: boolean; error?: string }

      if (result?.success) {
        setShowExport(false)
        setStatus('导出成功')
      } else {
        setStatus(`导出失败: ${result?.error ?? '未知错误'}`)
      }
    } catch (err) {
      setStatus('导出失败')
    } finally {
      setIsExporting(false)
    }
  }, [])

  return (
    <div className="w-[360px] p-5 font-sans">
      <Header />
      <LanguageSelector targetLang={targetLang} onChange={handleTargetLangChange} />
      <StyleSelector activePresetId={activePresetId} customPresets={customPresets} onChange={handlePresetChange} />
      <TranslateBar
        mode={displayMode}
        onModeChange={handleModeChange}
        onTranslate={handleTranslate}
        isTranslating={isTranslating}
        progress={progress}
      />
      <StatusBar providerName={providerName} modelId={modelId} status={status} />

      <div className="mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => setShowExport(true)}
          className="w-full py-2.5 bg-primary-light border border-primary-border rounded-lg text-[13px] text-primary-dark cursor-pointer hover:bg-primary-border/30"
        >
          📤 导出到 Obsidian
        </button>
      </div>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  )
}
```

- [ ] **Step 8: Update Popup CSS**

Replace `entrypoints/popup/style.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 9: Verify popup renders**

```bash
npm run dev
```

Load the extension in Chrome, click the extension icon. Expected: Popup shows with header, language selector, style selector, translate bar with pill toggle, status bar, and export button in the emerald green theme.

- [ ] **Step 10: Commit**

```bash
git add entrypoints/popup/
git commit -m "feat: add Popup UI with translate, mode toggle, and export"
```

---

### Task 13: Options Page UI

**Files:**
- Modify: `entrypoints/options/App.tsx`
- Create: `entrypoints/options/components/ProviderManager.tsx`, `entrypoints/options/components/ProviderForm.tsx`, `entrypoints/options/components/PresetManager.tsx`, `entrypoints/options/components/ObsidianConfig.tsx`

- [ ] **Step 1: Create ProviderForm component**

Create `entrypoints/options/components/ProviderForm.tsx`:
```tsx
import { useState } from 'react'
import type { Provider, ModelInfo } from '@/lib/types'

interface Props {
  provider: Provider
  isActive: boolean
  activeModelId: string
  onUpdate: (provider: Provider) => void
  onDelete?: () => void
  onSetActive: (modelId: string) => void
}

export default function ProviderForm({ provider, isActive, activeModelId, onUpdate, onDelete, onSetActive }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelInput, setModelInput] = useState(activeModelId)
  const [fetchError, setFetchError] = useState('')

  async function handleFetchModels() {
    setFetchingModels(true)
    setFetchError('')
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetch-models',
        providerId: provider.id,
      }) as { models: ModelInfo[]; error?: string }

      if (response.error) {
        setFetchError(response.error)
      } else {
        setModels(response.models)
      }
    } catch (err) {
      setFetchError(String(err))
    } finally {
      setFetchingModels(false)
    }
  }

  return (
    <div className={`border rounded-xl p-5 mb-4 ${isActive ? 'border-primary bg-primary-light/50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">
          {provider.name}
          {isActive && <span className="ml-2 text-xs text-primary bg-primary-light px-2 py-0.5 rounded-full">当前使用</span>}
        </h3>
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700 cursor-pointer bg-transparent border-none">
            删除
          </button>
        )}
      </div>

      {/* Base URL */}
      {!provider.isPreset && (
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">Base URL</label>
          <input
            type="text"
            value={provider.baseUrl}
            onChange={(e) => onUpdate({ ...provider, baseUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            placeholder="https://api.example.com/v1"
          />
        </div>
      )}

      {/* API Key */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">API Key</label>
        <input
          type="password"
          value={provider.apiKey}
          onChange={(e) => onUpdate({ ...provider, apiKey: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
          placeholder="sk-..."
        />
      </div>

      {/* Model selection */}
      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">模型</label>
        <div className="flex gap-2">
          {models.length > 0 ? (
            <select
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            >
              <option value="">选择模型</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              placeholder="输入模型名称"
            />
          )}
          <button
            onClick={handleFetchModels}
            disabled={!provider.apiKey || fetchingModels}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {fetchingModels ? '获取中...' : '获取列表'}
          </button>
        </div>
        {fetchError && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      {/* Set as active */}
      <button
        onClick={() => onSetActive(modelInput)}
        disabled={!modelInput || !provider.apiKey}
        className="w-full py-2 bg-primary text-white rounded-lg text-sm border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark"
      >
        {isActive ? '更新选择' : '设为当前使用'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create ProviderManager component**

Create `entrypoints/options/components/ProviderManager.tsx`:
```tsx
import { useState } from 'react'
import ProviderForm from './ProviderForm'
import type { Provider, ActiveModel } from '@/lib/types'

interface Props {
  providers: Provider[]
  activeModel: ActiveModel | null
  onProvidersChange: (providers: Provider[]) => void
  onActiveModelChange: (active: ActiveModel) => void
}

export default function ProviderManager({ providers, activeModel, onProvidersChange, onActiveModelChange }: Props) {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')

  function handleUpdateProvider(updated: Provider) {
    onProvidersChange(providers.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleDeleteProvider(id: string) {
    onProvidersChange(providers.filter((p) => p.id !== id))
  }

  function handleSetActive(providerId: string, modelId: string) {
    if (modelId) {
      onActiveModelChange({ providerId, modelId })
    }
  }

  function handleAddProvider() {
    if (!newName.trim() || !newUrl.trim()) return
    const id = `custom-${Date.now()}`
    const provider: Provider = {
      id,
      name: newName.trim(),
      baseUrl: newUrl.trim(),
      apiKey: '',
      isPreset: false,
    }
    onProvidersChange([...providers, provider])
    setNewName('')
    setNewUrl('')
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">LLM 服务商</h2>

      {providers.map((provider) => (
        <ProviderForm
          key={provider.id}
          provider={provider}
          isActive={activeModel?.providerId === provider.id}
          activeModelId={activeModel?.providerId === provider.id ? activeModel.modelId : ''}
          onUpdate={handleUpdateProvider}
          onDelete={provider.isPreset ? undefined : () => handleDeleteProvider(provider.id)}
          onSetActive={(modelId) => handleSetActive(provider.id, modelId)}
        />
      ))}

      {/* Add custom provider */}
      <div className="border border-dashed border-gray-300 rounded-xl p-5">
        <h3 className="font-semibold text-gray-600 mb-3">添加自定义服务商</h3>
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            placeholder="服务商名称"
          />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            placeholder="Base URL (如 https://api.example.com/v1)"
          />
        </div>
        <button
          onClick={handleAddProvider}
          disabled={!newName.trim() || !newUrl.trim()}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50"
        >
          + 添加
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create PresetManager component**

Create `entrypoints/options/components/PresetManager.tsx`:
```tsx
import { useState } from 'react'
import type { TranslationPreset } from '@/lib/types'

interface Props {
  customPresets: TranslationPreset[]
  onChange: (presets: TranslationPreset[]) => void
}

export default function PresetManager({ customPresets, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [rules, setRules] = useState('')

  function handleAdd() {
    if (!name.trim() || !rules.trim()) return
    const preset: TranslationPreset = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      rules: rules.trim(),
      isBuiltin: false,
    }
    onChange([...customPresets, preset])
    setName('')
    setRules('')
  }

  function handleUpdate(id: string) {
    onChange(customPresets.map((p) =>
      p.id === id ? { ...p, name: name.trim(), rules: rules.trim() } : p,
    ))
    setEditingId(null)
    setName('')
    setRules('')
  }

  function handleDelete(id: string) {
    onChange(customPresets.filter((p) => p.id !== id))
  }

  function startEditing(preset: TranslationPreset) {
    setEditingId(preset.id)
    setName(preset.name)
    setRules(preset.rules)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">自定义翻译预设</h2>

      {customPresets.map((preset) => (
        <div key={preset.id} className="border border-gray-200 rounded-xl p-4 mb-3">
          {editingId === preset.id ? (
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              />
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-y"
              />
              <div className="flex gap-2">
                <button onClick={() => handleUpdate(preset.id)} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs border-none cursor-pointer">保存</button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs border-none cursor-pointer">取消</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-gray-800">{preset.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => startEditing(preset)} className="text-xs text-primary cursor-pointer bg-transparent border-none">编辑</button>
                  <button onClick={() => handleDelete(preset.id)} className="text-xs text-red-500 cursor-pointer bg-transparent border-none">删除</button>
                </div>
              </div>
              <pre className="text-xs text-gray-500 whitespace-pre-wrap">{preset.rules}</pre>
            </div>
          )}
        </div>
      ))}

      {/* Add new preset */}
      {editingId === null && (
        <div className="border border-dashed border-gray-300 rounded-xl p-4">
          <h3 className="font-semibold text-gray-600 mb-3 text-sm">添加新预设</h3>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
              placeholder="预设名称"
            />
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-y"
              placeholder="翻译规则（每行一条，以 - 开头）"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !rules.trim()}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm border-none cursor-pointer hover:bg-gray-200 disabled:opacity-50"
          >
            + 添加
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create ObsidianConfig component**

Create `entrypoints/options/components/ObsidianConfig.tsx`:
```tsx
import type { ObsidianConfig as ObsidianConfigType } from '@/lib/types'

interface Props {
  config: ObsidianConfigType
  onChange: (config: ObsidianConfigType) => void
}

export default function ObsidianConfig({ config, onChange }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Obsidian 导出</h2>

      <div className="border border-gray-200 rounded-xl p-5 space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">REST API 地址</label>
          <input
            type="text"
            value={config.apiUrl}
            onChange={(e) => onChange({ ...config, apiUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            placeholder="http://localhost:27123"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">API Token</label>
          <input
            type="password"
            value={config.apiToken}
            onChange={(e) => onChange({ ...config, apiToken: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">存储路径</label>
          <input
            type="text"
            value={config.vaultPath}
            onChange={(e) => onChange({ ...config, vaultPath: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
            placeholder="Inbox/Contexta/"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire up Options App**

Replace `entrypoints/options/App.tsx`:
```tsx
import { useState, useEffect } from 'react'
import ProviderManager from './components/ProviderManager'
import PresetManager from './components/PresetManager'
import ObsidianConfig from './components/ObsidianConfig'
import { getStorage, setStorage } from '@/lib/storage'
import type { Provider, ActiveModel, TranslationPreset, ObsidianConfig as ObsidianConfigType } from '@/lib/types'

export default function App() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [activeModel, setActiveModel] = useState<ActiveModel | null>(null)
  const [customPresets, setCustomPresets] = useState<TranslationPreset[]>([])
  const [obsidianConfig, setObsidianConfig] = useState<ObsidianConfigType>({
    apiUrl: 'http://localhost:27123',
    apiToken: '',
    vaultPath: 'Inbox/Contexta/',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const [p, am, cp, oc] = await Promise.all([
      getStorage('providers'),
      getStorage('activeModel'),
      getStorage('customPresets'),
      getStorage('obsidianConfig'),
    ])
    setProviders(p)
    setActiveModel(am)
    setCustomPresets(cp)
    setObsidianConfig(oc)
  }

  async function handleProvidersChange(updated: Provider[]) {
    setProviders(updated)
    await setStorage('providers', updated)
    flashSaved()
  }

  async function handleActiveModelChange(active: ActiveModel) {
    setActiveModel(active)
    await setStorage('activeModel', active)
    flashSaved()
  }

  async function handlePresetsChange(presets: TranslationPreset[]) {
    setCustomPresets(presets)
    await setStorage('customPresets', presets)
    flashSaved()
  }

  async function handleObsidianChange(config: ObsidianConfigType) {
    setObsidianConfig(config)
    await setStorage('obsidianConfig', config)
    flashSaved()
  }

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary-dark to-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
            C
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">Contexta 设置</h1>
        </div>
        {saved && <span className="text-sm text-primary">已保存 ✓</span>}
      </div>

      <div className="space-y-10">
        <ProviderManager
          providers={providers}
          activeModel={activeModel}
          onProvidersChange={handleProvidersChange}
          onActiveModelChange={handleActiveModelChange}
        />

        <PresetManager
          customPresets={customPresets}
          onChange={handlePresetsChange}
        />

        <ObsidianConfig
          config={obsidianConfig}
          onChange={handleObsidianChange}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Update Options CSS**

`entrypoints/options/style.css` should already be:
```css
@import "tailwindcss";
```

- [ ] **Step 7: Verify Options page renders**

```bash
npm run dev
```

Navigate to the extension's Options page (right-click extension icon → Options). Expected: Settings page shows provider cards, preset manager, and Obsidian config.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/options/
git commit -m "feat: add Options page with provider, preset, and Obsidian config"
```

---

### Task 14: Integration Testing & Final Polish

**Files:**
- Modify: `wxt.config.ts` (ensure permissions)
- Create: `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, `public/icon-128.png`

- [ ] **Step 1: Generate extension icons**

Create a simple SVG icon and convert to PNGs. For MVP, use a placeholder:

Create `assets/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="url(#g)"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="128" y2="128">
      <stop offset="0%" stop-color="#065f46"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <text x="64" y="82" text-anchor="middle" fill="white" font-family="system-ui" font-weight="700" font-size="64">C</text>
</svg>
```

Generate PNGs from SVG (or use the SVG directly — WXT supports it):

Update `wxt.config.ts` to use SVG icon:
```ts
import { defineConfig } from 'wxt'

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Contexta - AI Translation',
    description: 'High-quality AI translation for web articles',
    permissions: ['storage', 'activeTab'],
    action: {
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
  },
})
```

For now, use a build script or manually create PNG icons. Alternatively, use WXT's auto icon generation if available. For MVP, skip custom icons and use defaults.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All unit tests pass (prompts, providers, extractor, injector, obsidian).

- [ ] **Step 3: Build production extension**

```bash
npm run build
```

Expected: Clean build with no errors. Output in `.output/chrome-mv3/`.

- [ ] **Step 4: Manual integration test**

1. Load `.output/chrome-mv3/` as unpacked extension in Chrome
2. Navigate to an English tech article (e.g., a blog post on Hacker News)
3. Open Popup → Configure a provider in Settings (use 硅基流动 free tier)
4. Select "科技博客" style → Click "AI 翻译"
5. Verify: paragraphs translate one by one, bilingual mode shows both
6. Toggle to "译文" → Verify: original text hidden, translations shown
7. Click "导出到 Obsidian" → Configure Obsidian REST API → Export
8. Verify: Markdown file appears in Obsidian vault with frontmatter, callouts

- [ ] **Step 5: Add .gitignore**

Create `.gitignore`:
```
node_modules/
.output/
dist/
.wxt/
.superpowers/
*.log
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete Contexta MVP - AI translation browser extension"
```
