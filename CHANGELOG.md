# Changelog

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
