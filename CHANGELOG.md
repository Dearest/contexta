# Changelog

## [0.2.1] - 2026-04-21

### Fixed

- 导出到 Obsidian 时表格结构丢失：Turndown 默认不支持 `<table>`，导致每个单元格被输出为独立段落。引入 `turndown-plugin-gfm` 修复。
- 嵌套结构（如 `<th><p>...</p></th>`）被提取为两个翻译单元时，导出阶段会重复替换/插入，target-only 下单元格内容错位、bilingual 下行列混乱。导出遍历增加「已处理块」跳过逻辑，最外层块优先。

### Added

- 导出支持带语言标识的代码块（`<pre><code class="language-xxx">` → ` ```xxx `）、删除线（`~~...~~`）、任务列表（`- [ ]` / `- [x]`），通过 `turndown-plugin-gfm` 一并启用。

## [0.2.0] - 2026-04-18

### Added

- 翻译保留内联 HTML 结构（链接、加粗、斜体、行内代码等）。采用占位符标签映射方案：提取时生成 `<a1>`/`<em1>` 占位符，LLM 翻译后还原为真实 HTML。
- 带 style/class 的 `<span>` 条件保留，保持原文的标题样式（字体大小、粗细、颜色等）。
- `sanitizeHtml` 白名单过滤，防止 innerHTML 注入的 XSS 风险。
- 多 article 容器扩展：Twitter/X 等 timeline 页面自动扩展到线程容器，翻译所有推文而非仅主推文。

### Fixed

- 翻译后链接不可点击、加粗/斜体丢失的问题。
- Twitter action bar 的数字（回复数、转帖数等）被错误提取为翻译内容。
- Defuddle 内容无 `<p>` 标签时（如 Twitter），snippet 匹配失败导致容器选择退化。

## [0.1.1] - 2026-04-18

### Fixed

- Twitter/X 等非语义化 DOM 网站无法提取段落的问题。新增 fallback 策略：当标准语义标签（p, h1 等）提取为空时，自动回退到叶子文本块提取。

## [0.1.0] - 2026-04-17

### Added

- AI 驱动的网页文章翻译（支持智谱/硅基/Kimi/MiniMax）
- 三种显示模式：原文 / 双语 / 译文
- 4 种内置翻译预设 + 自定义预设
- Obsidian 导出（摘要、金句、frontmatter）
- GitHub Actions 自动打包 CRX 发布
