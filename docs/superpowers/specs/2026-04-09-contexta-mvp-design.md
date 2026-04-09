# Contexta（境译）MVP 设计文档

## 1. 产品定位

Contexta 是一款浏览器扩展，专注于使用 LLM 对网页正文进行高质量 AI 精翻。核心解决免费翻译工具质量粗糙（不保留术语、机翻感、无法还原作者表述）的痛点。

**MVP 范围：**
- 仅翻译正文区域（通过 Defuddle 提取），不翻译导航栏/侧边栏等
- 仅提供 AI 精翻（单轮，携带上下文的精细 prompt），不提供普通翻译
- 预置免费 LLM 模型（智谱、硅基流动、Kimi、MiniMax），支持 BYOK 自定义服务商
- 支持双语对照 / 仅译文两种展示模式
- 支持导出到 Obsidian（含 AI 生成的摘要和金句）

**MVP 不做：**
- 划词翻译、悬停翻译
- 非正文区域翻译
- 二轮审校
- 自定义译文样式（译文完全继承原文样式）
- SPA / 无限滚动的增量翻译

## 2. 技术选型

| 类别 | 选型 | 理由 |
|------|------|------|
| 扩展框架 | WXT | Vite + HMR，目录约定清晰，Shadow DOM 支持成熟 |
| UI 框架 | React + shadcn/ui | 用户指定 |
| LLM 集成 | Vercel AI SDK | 内置 OpenAI 兼容 provider，智谱/硅基/Kimi/MiniMax 直接适配 |
| 正文提取 | Defuddle (core bundle) | 代码块标准化、丰富元数据、为浏览器扩展设计、Obsidian 生态 |
| 存储 | chrome.storage.local | 服务商配置、用户偏好 |

## 3. 整体架构

```
┌─────────────────────────────────────────────────┐
│                  Browser Extension               │
├──────────┬──────────────┬───────────────────────┤
│  Popup   │  Options Page │   Content Script      │
│ (React)  │   (React)    │                       │
│          │              │  ┌──────────────────┐  │
│ 翻译按钮  │  服务商配置   │  │ Defuddle 提取正文 │  │
│ 模式切换  │  Obsidian配置 │  │ DOM 注入译文     │  │
│          │              │  │ 样式继承原文      │  │
└────┬─────┴──────┬───────┘  └────────┬─────────┘  │
     │            │                   │            │
     └────────────┴───────────────────┘            │
                      │ chrome.runtime.message     │
              ┌───────┴────────┐                   │
              │ Background SW  │                   │
              │                │                   │
              │ Vercel AI SDK  │                   │
              │ 逐段翻译调度    │                   │
              │ Obsidian 导出   │                   │
              └───────┬────────┘                   │
                      │                            │
               ┌──────┴──────┐                     │
               │  LLM API    │                     │
               │ (智谱/硅基等) │                     │
               └─────────────┘                     │
```

**核心数据流：**
1. 用户点击 Popup "AI 翻译" → Popup 发消息给 Background
2. Background 通知 Content Script → Defuddle 提取正文 → 按段落分片
3. 分片数据发回 Background → Background 逐段调用 LLM API（携带相邻段落上下文，非流式）
4. 每段翻译完成后立即推送给 Content Script → DOM 注入译文

**翻译放在 Background 的原因：**
- Service Worker 无 CORS 限制，可直接调用任意 LLM API
- Content Script 受页面 CSP 限制，许多网站会阻止外部请求
- API Key 不暴露在页面上下文中

## 4. Popup 设计

**配色：** 墨绿翡翠（主色 `#065f46` → `#059669` 渐变）

**布局（从上到下）：**
1. **顶栏**：Logo + "Contexta" + 设置按钮（跳转 Options）
2. **语言选择器**：源语言（自动检测） → 目标语言（默认简体中文，可选）
3. **翻译风格下拉**：科技博客 / 学术论文 / 科普读物 / 忠实原文 / 自定义预设
4. **翻译操作行**：左侧 Pill 切换（双语/译文）+ 右侧 "AI 翻译" 按钮
5. **状态栏**：当前服务商和模型名称
6. **导出按钮**："导出到 Obsidian"

**Pill 切换（Segment Control）：**
- 左段"双语" / 右段"译文"
- 选中状态：深绿背景白字；未选中：透明背景绿字
- 切换即时生效（已翻译的内容立刻切换展示模式，不重新翻译）

**翻译进行中状态：**
- 按钮变为禁用态，显示进度（如 "翻译中 3/12"）
- 翻译完成后按钮恢复，状态栏显示"翻译完成"

## 5. Content Script — 译文注入

**正文提取：**
1. 收到翻译指令 → 用 Defuddle 提取正文区域 DOM 范围
2. 遍历正文内的文本块节点：`<p>`, `<h1>`-`<h6>`, `<li>`, `<blockquote>`, `<td>` 等
3. 跳过：`<pre>`/`<code>` 代码块、表单元素、图片 alt、已翻译节点

**段落分片与上下文：**
- 每个文本块节点为一个翻译单元
- 发送给 LLM 时，携带前后各 1 个段落作为上下文（不翻译上下文，仅供 LLM 参考）
- prompt 指导 LLM 保持术语一致性、正确处理代词指代、还原作者语气

**译文注入：**
- **双语对照模式**：在每个原文节点后方插入一个同标签的译文节点，添加 `data-contexta="translation"` 属性
- **仅译文模式**：隐藏原文节点（`display: none`），显示译文节点
- 译文样式完全继承原文节点的样式，无任何额外样式修改
- 逐段翻译完成后立即注入，用户看到段落逐个出现的渐进效果

**翻译进度指示：**
- 当前正在翻译的段落显示轻量 loading 指示

**错误处理：**
- 单段翻译失败 → 该段落下方显示轻提示 + 重试按钮
- 不影响其他段落的翻译流程

**重复翻译：**
- 用户在已翻译页面再次点击"AI 翻译"时，先清除已有译文，再重新翻译
- 适用于切换目标语言后重新翻译的场景

**卸载翻译：**
- 移除所有 `[data-contexta]` 节点
- 恢复被隐藏的原文节点

## 6. Options 页面

### 6.1 LLM 服务商管理

**预置服务商：**

| 服务商 | Base URL | 免费模型示例 |
|--------|----------|-------------|
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | GLM-4-Flash |
| 硅基流动 | `https://api.siliconflow.cn/v1` | Qwen 系列 |
| Kimi | `https://api.moonshot.cn/v1` | Moonshot-v1 |
| MiniMax | `https://api.minimax.chat/v1` | MiniMax 系列 |

**每个服务商配置项：**
- 名称（预置不可改，自定义可编辑）
- Base URL（预置默认填充，可修改）
- API Key（用户填写）
- 模型选择：
  - 填入 API Key 后可点击"获取模型列表"，调用 `GET /models` 拉取可用模型下拉
  - 如果拉取失败（自定义服务商可能不支持），回退到手动输入模型名称

**自定义服务商：**
- 点击"添加服务商" → 填写名称、Base URL、API Key
- 支持删除自定义服务商

**当前使用：**
- 选择一个服务商 + 模型组合作为当前翻译使用
- 选择结果同步显示在 Popup 底部状态栏

### 6.2 自定义翻译预设

- 添加/编辑/删除自定义翻译预设
- 每个预设包含：名称、自定义 rules 文本
- 自定义预设会出现在 Popup 的翻译风格下拉中

### 6.3 Obsidian 导出配置

- REST API 地址（默认 `http://localhost:27123`）
- API Token
- 存储路径（默认 `Inbox/Contexta/`）

## 7. Obsidian 导出

**触发：** Popup 点击"导出到 Obsidian" → 弹出导出配置面板

**导出配置面板（Popup 内）：**
- 格式（单选）：仅译文 / 双语对照 / 仅原文
- 摘要（checkbox，默认勾选）
- 金句（checkbox，默认勾选）

**生成的 Markdown 结构：**

```markdown
---
title: "文章标题"
author: "作者"
source: "https://original-url.com"
date: 2026-04-09
translated: true
---

> [!abstract] 摘要
> LLM 生成的文章摘要...

> [!quote] 金句
> - "精彩句子一..."
> - "精彩句子二..."

---

正文内容（根据选择的格式）...
```

**双语对照导出格式：**
```markdown
Original paragraph here.

翻译的段落在这里。

---

Next original paragraph.

下一个翻译段落。
```

**技术细节：**
- 摘要和金句通过额外的 LLM 请求生成（翻译完成后，用译文作为输入）
- Defuddle 提取的元数据（title、author、published）填入 frontmatter
- 通过 Obsidian Local REST API 的 `POST /vault/{path}` 写入
- 存储路径从 Options 配置读取

## 8. 项目结构（WXT 约定）

```
contexta/
├── src/
│   ├── entrypoints/
│   │   ├── popup/           # Popup 页面（React）
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── style.css
│   │   ├── options/         # Options 页面（React）
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── style.css
│   │   ├── background.ts    # Background Service Worker
│   │   └── content.ts       # Content Script
│   ├── components/          # 共享 React 组件（shadcn/ui）
│   ├── lib/
│   │   ├── translator.ts    # LLM 翻译逻辑（prompt 构建、上下文拼接）
│   │   ├── extractor.ts     # Defuddle 正文提取封装
│   │   ├── injector.ts      # DOM 译文注入/卸载
│   │   ├── obsidian.ts      # Obsidian 导出逻辑
│   │   ├── providers.ts     # 服务商配置与模型列表
│   │   └── storage.ts       # chrome.storage 封装
│   └── assets/              # 图标等静态资源
├── public/                  # 扩展图标
├── wxt.config.ts            # WXT 配置
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── components.json          # shadcn/ui 配置
```

## 9. 消息协议（chrome.runtime.message）

```typescript
// Popup → Background
type TranslateRequest = {
  action: 'translate'
  mode: 'bilingual' | 'target-only'
  targetLang: string
}

// Background → Content Script
type ExtractRequest = {
  action: 'extract'
}

// Content Script → Background
type ExtractResult = {
  action: 'extract-result'
  paragraphs: {
    id: string        // 节点标识，用于回写
    text: string      // 当前段落文本
    prev?: string     // 前一段文本（上下文）
    next?: string     // 后一段文本（上下文）
    tagName: string   // 原始标签名
  }[]
  metadata: {
    title: string
    author?: string
    published?: string
    url: string
  }
}

// Background → Content Script（逐段推送）
type TranslationResult = {
  action: 'translation-result'
  paragraphId: string
  translation: string
}

// Background → Content Script
type TranslationError = {
  action: 'translation-error'
  paragraphId: string
  error: string
}

// Background → Content Script
type TranslationComplete = {
  action: 'translation-complete'
}

// Popup → Background
type ExportRequest = {
  action: 'export-obsidian'
  format: 'target-only' | 'bilingual' | 'source-only'
  includeSummary: boolean
  includeQuotes: boolean
}
```

## 10. 翻译 Prompt 设计

### 10.1 核心 prompt 结构（所有预设共用）

```
System:
你是一位精通{targetLang}的专业翻译。

翻译规则：
- 技术术语、产品名、公司名保留英文原文（如 Transformer、OpenAI、Token）
- 代码、变量名、命令、URL 不翻译
- 全角括号换成半角括号，半角括号前后各加一个半角空格
- 英文术语与中文之间加一个半角空格
- 保留原始 Markdown 格式
- 仅输出译文，不要解释或附加内容

{preset_specific_rules}

策略：先直译，确保信息完整；再基于直译结果意译，使表达自然流畅，
符合{targetLang}表达习惯。仅输出最终意译结果。

User:
[文章标题] {title}

[上文（仅供参考，不翻译）]
{prev_paragraph}

[请翻译以下段落]
{current_paragraph}

[下文（仅供参考，不翻译）]
{next_paragraph}
```

关键设计决策：
- **两步翻译在单次调用中完成**：prompt 指导模型先直译再意译，仅输出意译结果，不增加 API 调用量但显著提升质量
- **上下文注入**：携带前后各 1 段落，用于代词指代和语气连贯
- **文章标题**：提供全局语境，帮助模型判断领域和术语选择

### 10.2 预设翻译风格

在 Popup 中通过下拉选择，存储在 chrome.storage.local。

| 预设 ID | 名称 | 风格锚点 | 适用场景 |
|---------|------|---------|---------|
| `tech-blog` | 科技博客 | 机器之心、InfoQ 中文站 | AI/技术博客、产品发布文章 |
| `academic` | 学术论文 | 学术期刊中文摘要 | arXiv 论文、研究报告 |
| `popular-science` | 科普读物 | 《万物》杂志 | 面向非专业读者的科普内容 |
| `faithful` | 忠实原文 | 贴近原文结构 | 需要逐句对照的精读场景 |

各预设的 `preset_specific_rules`：

**科技博客：**
```
- 常见术语使用中文（如 Large Language Model → 大语言模型），生僻或新术语保留英文
- 风格参考机器之心、InfoQ 中文站的技术文章，兼顾专业性与可读性
```

**学术论文：**
```
- 使用学术用语，保留论文引用标记（如 [20]）
- Figure 1: → 图 1:，Table 1: → 表 1:
- 风格参考学术期刊中文摘要，严谨准确，避免口语化表达
```

**科普读物：**
```
- 专业概念需用通俗语言解释，避免堆砌术语
- 风格参考《万物》杂志，生动有趣，让非专业读者也能理解
```

**忠实原文：**
```
- 尽量保留原文句式结构，减少意译
- 直译优先，仅在严重不通顺时调整语序
```

### 10.3 自定义预设

用户可在 Options 页面自定义翻译预设：
- 预设名称
- 自定义 rules 文本（替换 `preset_specific_rules`）
- 支持添加/编辑/删除自定义预设

## 11. 性能与安全约束

- **无阻塞渲染**：DOM 扫描与节点注入使用 `requestIdleCallback` 或分批处理，不阻塞主线程
- **隐私**：跳过包含密码框或标记为敏感的表单区域
- **API Key 安全**：Key 存储在 `chrome.storage.local`，仅在 Background SW 中使用，不暴露到页面
- **速率限制**：逐段串行翻译，避免并发触发服务商限流；可考虑加入请求间隔控制
