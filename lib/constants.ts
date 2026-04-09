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
