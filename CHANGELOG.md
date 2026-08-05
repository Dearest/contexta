# Changelog

## [0.3.0] - 2026-08-05

### Added

- **划词翻译**：选中网页文字后出现绿点，点击即在弹窗内流式显示译文。弹窗挂在 Shadow DOM 内，不受宿主页面 CSS 影响；输入框、textarea、contenteditable 中的选中会被忽略。支持复制译文、Esc 关闭，同一段文本重复选中命中内存缓存（50 条）。
- 划词翻译使用独立的「划词模型」，与整页翻译的模型分开配置。同一服务商下可分别指定（如整页用 sonnet、划词用快速小模型），留空则回退到翻译模型。
- 服务商与 Obsidian 均支持「测试连接」。服务商测试会真发一条最小请求，能查出 `/models` 查不出的问题：模型名错误、上游未开通、限流、以及网关只返回 SSE 流。Obsidian 测试可区分 token 无效、插件未启动、HTTPS 自签证书未信任。
- 获取模型列表后支持搜索过滤与数量上限（部分网关返回 100+ 模型）。
- API Key 与 Obsidian Token 支持明文显示切换，便于核对。

### Fixed

- **部分 OpenAI 兼容网关翻译失败并报 `invalid json response`**：这类网关在请求体缺少 `stream` 字段时默认返回 `text/event-stream`，而非流式调用不会发送该字段。现通过 fetch 包装在字段缺失时显式置为 `false`；流式调用会显式发送 `stream: true`，不受影响。
- 每个服务商的模型名此前只存于 `activeModel`，导致非当前服务商的模型输入框永远为空、刷新即丢。现持久化到服务商自身，并从旧数据自动回填。
- 删除正在使用的服务商后，`activeModel` 残留悬空引用，翻译时报错但界面无异常提示。现同步清空。
- 翻译错误信息不可读：AI SDK 的 `RetryError` 将真实错误包在 `lastError` 中，其自身 message 形如 `Failed after 3 attempts. Last error: `（冒号后为空）。现遍历 `lastError`/`cause`/`errors` 链，收集状态码与响应体，并将常见失败归类为可行动的中文提示。
- 获取模型列表仅识别 `{data:[]}` 一种响应格式，其余格式静默返回空列表。现兼容 `{models:[]}` 与裸数组。
- 修复既有的 7 处 TypeScript 类型错误（`chrome.storage.get` 返回值未标注、`ProviderForm` 缺少 `ModelInfo` 导入）。
- Obsidian 默认地址由 `localhost` 改为 `127.0.0.1`：macOS 上 `localhost` 可能解析到 IPv6 `::1`，而插件仅监听 IPv4。

### Changed

- 设置页改为左侧导航 + 右侧内容的两栏布局，分为「AI 服务商」「翻译规则」「Obsidian 导出」三段，页面宽度由 `max-w-2xl` 增至 `max-w-4xl`。此前所有服务商卡片同时展开，页面需持续下滚。
- 服务商折叠为单行（名称 + 模型 + 配置状态），手风琴式展开，默认展开当前使用中的服务商。
- 设置项写入改为 500ms 防抖，「已保存」提示不再随每次按键闪烁；点击「测试连接」「选择模型」前会先落盘，避免读到未保存的值。
- 删除服务商与自定义规则需二次确认；预置服务商的 Base URL 改为只读展示（此前完全不可见）。
- 划词翻译的提示改为基于等待时长：仅在 5 秒无输出时才建议更换模型。此前依据「是否存在推理输出」判断，而多数模型都会输出推理内容且仅慢 1~2 秒，导致提示几乎总是出现。

## [0.2.2] - 2026-04-21

### Added

- 导出到 Obsidian 成功后，状态条显示「在 Obsidian 打开」按钮，一键切换到 Obsidian 并打开刚导出的文档。依赖 Local REST API 插件的 `POST /open/{filename}` 端点。

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
