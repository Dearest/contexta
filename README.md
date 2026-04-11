<p align="center">
  <img src="assets/icon.svg" width="80" height="80" alt="Contexta Logo">
</p>

<h1 align="center">Contexta — 境译</h1>

<p align="center">
  AI 驱动的网页文章精翻浏览器扩展，翻译后一键导出到 Obsidian
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-MV3-brightgreen?logo=googlechrome&logoColor=white" alt="Chrome MV3">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4">
</p>

---

## 为什么做这个

市面上的翻译扩展大多追求"快"——机翻一整页，读完就扔。但对于深度阅读 AI/科技/学术文章的人来说，翻译质量和阅读后的知识沉淀同样重要。

Contexta 的设计理念：

- **精翻而非机翻**：逐段翻译，每段携带上下文，由 LLM 完成两步翻译（直译 → 意译），质量远超传统机翻
- **阅读即归档**：翻译完成后一键导出到 Obsidian，自动生成 frontmatter、摘要和金句，融入你的知识管理工作流
- **你选模型**：接入任意兼容 OpenAI API 的大模型服务（智谱、硅基流动、Kimi、MiniMax 等），用你信任的模型，花你自己的 token

## 功能特性

**翻译**
- 智能提取文章正文（基于 [Defuddle](https://github.com/nickcio/defuddle)），自动跳过代码块、导航栏等无关内容
- 逐段翻译，保留上下文连贯性，自动跳过已是目标语言的段落
- 三种阅读模式：原文 / 双语对照 / 译文，实时切换
- 4 种内置翻译风格预设（科技博客、学术论文、科普读物、忠实原文），支持自定义

**导出到 Obsidian**
- 三种导出格式：仅原文 / 仅译文 / 双语对照
- 可选 AI 生成摘要和金句提取
- 自动生成 YAML frontmatter（标题、作者、来源、日期、标签）
- 通过 [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件直接写入 vault

**配置**
- 预置智谱、硅基流动、Kimi、MiniMax 四家服务商，也可添加任意 OpenAI 兼容 API
- 每个服务商独立配置 API Key 和模型
- 目标语言支持简体中文、繁体中文、English

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后在 Chrome 打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `dist/chrome-mv3/` 目录。

### 构建生产版本

```bash
npm run build
```

产物输出到 `dist/chrome-mv3/`。

### 打包 CRX

```bash
npm run pack
```

### 运行测试

```bash
npm test                # 运行全部测试
npm run compile         # TypeScript 类型检查
```

## 使用指南

1. **配置模型**：点击扩展图标 → 右上角齿轮进入设置页 → 选择服务商，填入 API Key，设置模型名称
2. **翻译文章**：打开一篇英文文章 → 点击扩展图标 → 选择目标语言和翻译风格 → 点击「翻译」
3. **切换模式**：翻译完成后，通过三态切换按钮在原文/双语/译文之间切换
4. **导出到 Obsidian**（可选）：点击「导出到 Obsidian」→ 选择格式和附加内容 → 确认导出

> 导出功能需要在 Obsidian 中安装 [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件，并在扩展设置中配置 API Token。

## 项目架构

```
entrypoints/
├── popup/          # Popup 界面 (React) — 翻译控制、模式切换、导出
├── options/        # 设置页 (React) — 服务商/模型配置、自定义预设、Obsidian 设置
├── background.ts   # Service Worker — LLM 调用、Obsidian 导出编排
└── content.ts      # Content Script — DOM 提取、翻译注入、Markdown 构建

lib/
├── types.ts        # 类型定义 + Message 协议
├── constants.ts    # 预置服务商、翻译预设、默认配置
├── prompts.ts      # 翻译/摘要/金句 prompt 构建
├── translator.ts   # Vercel AI SDK 翻译调用 + 语言检测
├── extractor.ts    # TreeWalker 段落提取
├── injector.ts     # DOM 翻译注入 + 模式切换
├── storage.ts      # chrome.storage 类型安全封装
├── messages.ts     # Chrome 消息通信封装
├── obsidian.ts     # Obsidian REST API 导出
└── providers.ts    # 服务商查询工具函数

components/ui/      # shadcn/ui 组件
tests/              # Vitest 单元测试
```

**数据流**：

```
Popup  →  translate  →  Background  →  extract  →  Content Script
                            ↓                           ↓
                     LLM 逐段翻译              Defuddle 提取 + 段落分割
                            ↓                           ↓
                   translation-result  →  Content Script 注入 DOM
```

## 技术栈

| 层 | 技术 |
|---|---|
| 扩展框架 | [WXT](https://wxt.dev) (Chrome MV3) |
| 前端 | React 19 + TypeScript 5 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| LLM 接口 | [Vercel AI SDK](https://sdk.vercel.ai) (OpenAI 兼容) |
| 文章提取 | [Defuddle](https://github.com/nickcio/defuddle) |
| HTML → Markdown | [Turndown](https://github.com/mixmark-io/turndown) |
| 测试 | Vitest + happy-dom |

## 贡献

欢迎 Issue 和 PR。开发前建议先阅读 `CLAUDE.md` 了解架构细节和设计决策。

## 许可证

MIT
