# Inline Structure Preservation in Translation

**Date**: 2026-04-18
**Status**: Approved
**Goal**: 翻译后保留原文的内联 HTML 结构（链接、加粗、斜体等），而非丢弃为纯文本。

## Problem

当前 `extractParagraphs()` 通过 `getTextPreservingBreaks()` 提取纯文本，所有内联元素（`<a>`、`<em>`、`<strong>` 等）被展平。翻译结果注入为 `textContent`，链接、格式化标签全部丢失。

沉浸式翻译等竞品能完整保留原文的 HTML 结构（链接可点击、加粗/斜体保留），用户体验明显更好。

## Approach: Placeholder Tag Mapping

提取时把内联标签替换为编号占位符（`<a1>`, `<em1>`），构建 `tagMap` 映射表。LLM 翻译带占位符的文本，注入时用 tagMap 还原为真实 HTML。

```
原文 DOM:   <a href="url"><em>React Apps</em></a> on Salesforce
提取后:     <a1><em1>React Apps</em1></a1> on Salesforce
tagMap:     [{ placeholder: "a1", tag: "a", attrs: { href: "url" } },
             { placeholder: "em1", tag: "em", attrs: {} }]
LLM 翻译:   <a1><em1>React 应用</em1></a1> 在 Salesforce 上
还原后:     <a href="url"><em>React 应用</em></a> 在 Salesforce 上
```

## Phase 1 Scope

仅保留语义内联标签：

```
A, EM, STRONG, B, I, MARK
```

纯装饰性标签（`<span style="...">`、`<sub>`、`<sup>` 等）在 Phase 1 中透传子节点、不生成占位符。

## Data Structure Changes

### types.ts

```typescript
export interface InlineTagMapping {
  placeholder: string   // "a1", "em1"
  tag: string           // "a", "em"
  attrs: Record<string, string>  // { href: "...", title: "..." }
}

export interface Paragraph {
  id: string
  text: string           // 带占位符的文本（发给 LLM）
  plainText: string      // 纯文本（语言检测 + 上下文）
  prev?: string
  next?: string
  tagName: string
  tagMap?: InlineTagMapping[]
}
```

### Message Protocol

`translation-result` 消息新增可选 `tagMap` 字段：

```typescript
| { action: 'translation-result'; paragraphId: string; translation: string; tagMap?: InlineTagMapping[] }
```

## Module Changes

### extractor.ts

新增 `extractInlineHtml(el: Element)` 替代 `getTextPreservingBreaks(el)`：

- 遍历子节点，遇到 `PRESERVE_INLINE_TAGS` 中的标签时生成编号占位符（`a1`, `a2`, `em1`...）
- 收集标签属性存入 tagMap
- 递归处理嵌套（`<a><em>text</em></a>` → `<a1><em1>text</em1></a1>`）
- 非保留标签透传子节点
- `<br>` → `\n`（保持现有行为）
- 返回 `{ text, plainText, tagMap }`

`extractParagraphs()` 中 `prev`/`next` 取相邻段落的 `plainText`。

### prompts.ts

`buildSystemPrompt` 新增强硬规则：

```
- 【严格】文本中形如 <a1>...</a1>、<em1>...</em1> 的编号标签是结构占位符，
  必须原样保留在译文中。只翻译标签内外的文字，不得删除、修改、合并或新增
  任何占位符标签。占位符数量和嵌套关系必须与原文完全一致。
```

### injector.ts

**新增 `restoreInlineTags(text, tagMap)`**：纯字符串操作，用正则把 `<a1>` 替换为 `<a href="...">`。属性值做 HTML entity 转义。

**新增 `sanitize(html)`**：白名单过滤，只允许 `A, EM, STRONG, B, I, MARK, BR`。移除 `on*` 事件属性和 `javascript:` 协议。不在白名单内的标签保留子节点、移除标签本身。

**改造 `injectTranslation()`**：
- 新增可选 `tagMap` 参数
- 有 tagMap 且非空 → `restoreInlineTags()` + `sanitize()` → `innerHTML`
- 无 tagMap → 保持原有 `textContent` 逻辑（100% 向后兼容）

### background.ts

- `handleExtractResult`: `isAlreadyTargetLang` 改用 `paragraph.plainText`
- `translation-result` 消息透传 `paragraph.tagMap`
- `handleRetry`: tagMap 已在 `lastArticle.paragraphs` 中，自动透传

### content.ts

- `handleTranslationResult`: 传递 `message.tagMap` 给 `injectTranslation`
- `buildExportMarkdown`: 读取译文改用 `el.innerHTML`（保留内联标签），`translatedParts` 仍用 `el.textContent`（纯文本给 LLM 生成摘要）。替换 Defuddle HTML 时用 `innerHTML` 赋值。Turndown 自动将 `<a>` → `[text](url)`、`<em>` → `*text*`。

## Data Flow

```
Content Script                    Background                     Content Script
extractParagraphs()          →    extract-result                  
  ↓ Paragraph[] with tagMap       (article with tagMap)
                                    ↓
                                  translateParagraph()
                                    uses paragraph.text (with placeholders)
                                    ↓
                                  translation-result          →   injectTranslation()
                                    (translation + tagMap)          restoreInlineTags()
                                                                    sanitize()
                                                                    innerHTML injection
```

## Security

LLM 输出通过 `innerHTML` 注入存在 XSS 风险。`sanitize()` 函数：
- 白名单标签：`A, EM, STRONG, B, I, MARK, BR`
- 移除所有 `on*` 事件处理属性
- 移除 `javascript:` 协议的属性值
- 非白名单标签：用子节点替换（保留文本内容）

属性值在 `restoreInlineTags` 中做 HTML entity 转义（`&` → `&amp;`，`"` → `&quot;`）。

## Testing

- `extractInlineHtml`: 纯文本段落、单标签、嵌套标签、多个同类标签（a1/a2）、非保留标签透传
- `restoreInlineTags`: 正常还原、空 tagMap、属性转义
- `sanitize`: 白名单通过、非白名单移除、on* 属性清理、javascript: 协议清理
- `injectTranslation` with tagMap: 带结构注入、向后兼容（无 tagMap）
- 端到端：提取 → 模拟翻译 → 注入 → 验证 DOM 结构

## Phase 2: Future Optimization

### 扩展保留标签范围

将 `PRESERVE_INLINE_TAGS` 扩展为所有内联元素：

```
A, EM, STRONG, B, I, MARK, SPAN, SUB, SUP, S, DEL, INS, ABBR, TIME, SMALL, U
```

包括带 `style` 属性的 `<span>`，完整还原原文的视觉样式（字体大小、颜色、粗细等），达到沉浸式翻译的完整效果。

**Trade-off**: 占位符数量增加会影响小模型的翻译质量。可考虑设置阈值——当占位符数量超过 N 个时自动降级为纯文本模式。

### 弱模型降级方案

Phase 1 使用 HTML 风格编号标签（`<a1>...</a1>`），对强模型效果最好。针对免费/小模型的降级选项：

1. **中括号风格**: `[1]text[/1]` — 与 HTML 视觉区分明显，小模型更不容易混淆
2. **纯文本降级**: 检测到模型返回的占位符数量与原文不一致时，自动回退为纯文本翻译
3. **用户可配置**: 在 Options 中增加"富文本翻译"开关，默认开启，用户可按需关闭（参考 KISS Translator 的做法）

### 占位符校验

翻译返回后验证占位符完整性：所有原文中的占位符标签是否都出现在译文中、嵌套关系是否正确。校验失败时回退到纯文本翻译。
