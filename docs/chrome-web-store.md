# Chrome Web Store 上架材料（v0.3.0）

提交入口：<https://chrome.google.com/webstore/devconsole>
需要一次性支付 $5 开发者注册费（如未注册过）。

上传包：`contexta.zip`（不是 `.crx`）。可从 Release 下载：
<https://github.com/Dearest/contexta/releases/tag/v0.3.0>
或本地执行 `npm run build` 后压缩 `dist/chrome-mv3/`。

> ⚠️ 标注 **【需你确认】** 的字段我无法代填，其余可直接复制。

---

## 一、Store listing（商店详情）

### Product name（≤75 字符）

```
Contexta 境译 — AI 精翻网页文章，一键存入 Obsidian
```

### Summary / 简短说明（≤132 字符，当前 71）

```
用你自己的 AI 模型精翻网页文章，双语对照，划词即译，读完一键存进 Obsidian。
```

### Description（≤16000 字符）

```
Contexta（境译）是给「认真读文章的人」做的翻译扩展。

市面上的翻译扩展大多追求快——机翻一整页，读完就扔。但如果你靠英文文章学习 AI、技术或学术内容，翻译质量和读完之后的知识沉淀同样重要。Contexta 为此而做。

■ 精翻，而不是机翻

逐段翻译，每段都带上下文一起送给大模型，并采用「先直译保证完整，再意译保证通顺」的两步策略。译文保留原文的内联结构——链接依然可点，加粗、斜体、行内代码、代码块都不会丢。

内置四种翻译风格，可按文章类型切换：
· 科技博客——常见术语用中文，生僻术语保留英文
· 学术论文——严谨用语，保留引用标记，Figure 1 → 图 1
· 科普读物——通俗解释专业概念
· 忠实原文——尽量保留原句式，直译优先

也可以自己写规则，定义术语偏好和行文风格。

■ 三种阅读模式

原文 / 双语对照 / 仅译文，一键切换。双语模式下译文紧随原文，样式自动继承原文，读起来不割裂。已经是目标语言的段落会自动跳过，不浪费 token。

■ 划词翻译

选中任意文字，旁边出现一个绿点，点它就在小窗里流式逐字显示译文。可以为划词单独配一个更快的小模型，正文翻译用好模型、划词用快模型，两者互不影响。

■ 读完即归档：一键导出 Obsidian

翻译完成后，通过 Obsidian Local REST API 插件把文章写进你的 vault：
· 自动生成 frontmatter（标题、作者、原文链接、日期）
· 可选让 AI 生成摘要与金句，作为 callout 放在开头
· 可选导出格式：仅译文 / 双语对照 / 仅原文
· 完整保留 Markdown 结构——表格、代码块（含语言标识）、图片、链接、任务列表、删除线
· 导出后可直接跳转到 Obsidian 打开该笔记

■ 用你自己的模型和 API Key

Contexta 不提供翻译服务，也没有服务器。你填入自己的 API Key，扩展直接从你的浏览器调用你选择的服务商——数据不经过任何中间人，成本你自己可控、可查。

支持任何兼容 OpenAI 格式的接口，内置智谱、硅基流动、Kimi、MiniMax 预设，也可添加任意自定义服务商（DeepSeek、OpenRouter、本地 Ollama、公司内部网关等）。

设置页提供「测试连接」，会真发一条最小请求，能查出模型名写错、上游未开通、额度不足、网关返回格式异常等问题，不用靠猜。

■ 隐私

· 不收集任何数据，无分析、无遥测、无追踪
· API Key 只存在你自己的浏览器里
· 不执行任何远程代码
· 权限极简：仅 storage 与 activeTab

隐私政策：https://github.com/Dearest/contexta/blob/master/PRIVACY.md

■ 开始使用

1. 安装后打开扩展设置页
2. 填入服务商的 Base URL 和 API Key（或使用内置预设）
3. 填写模型名，点「测试连接」确认可用
4. 在任意文章页点击扩展图标，开始翻译

需要自备兼容 OpenAI API 的大模型服务。导出到 Obsidian 需在 Obsidian 中安装 Local REST API 插件（可选功能，不影响翻译）。

■ 开源

源码、更新日志与问题反馈：https://github.com/Dearest/contexta
```

### Category

```
Productivity
```

（备选：`Tools`。Productivity 与「阅读 + 知识管理」定位更贴合。）

### Language

```
中文 (简体) / Chinese (Simplified)
```

### Store icon

`dist/chrome-mv3/icon/128.png`（128×128，已随构建产出）

### Screenshots（1280×800，至少 1 张、最多 5 张）

见本仓库 `docs/store-assets/`，按此顺序上传：

| # | 文件 | 说明 |
| --- | --- | --- |
| 1 | `screenshot-1-bilingual.png` | 双语对照阅读效果 |
| 2 | `screenshot-2-selection.png` | 划词翻译弹窗 |
| 3 | `screenshot-3-popup.png` | 控制面板（模式切换 / 导出） |
| 4 | `screenshot-4-options.png` | 设置页（服务商与模型配置） |

### Support URL

```
https://github.com/Dearest/contexta/issues
```

### Homepage URL

```
https://github.com/Dearest/contexta
```

---

## 二、Privacy practices（隐私实践）— 审核重点

### Single purpose description（单一用途说明）

```
Contexta has one purpose: translating the text of web articles using an AI model that the user configures, and optionally saving that translation to the user's own Obsidian vault. Every feature serves this single purpose — paragraph translation, selection translation, display-mode switching, and Markdown export are all steps in reading a foreign-language article and keeping the result.
```

### Permission justifications（逐项权限理由）

**`storage`**

```
Stores the user's own configuration locally: the provider Base URL and API key they entered, their chosen model names, target language, translation style preset, display mode, and Obsidian export settings. Without it users would have to re-enter their API key on every use. Nothing stored here is transmitted to the developer — there is no server.
```

**`activeTab`**

```
Reads the article content of the tab the user is currently viewing, and only after the user explicitly starts a translation by clicking the extension's action button. This is what allows the extension to extract article paragraphs and insert translations back into the page. No other tab is accessed.
```

**Content script on all URLs（`<all_urls>`）**

```
Articles worth translating exist on every domain — news sites, personal blogs, documentation, research pages — so there is no finite list of hosts to declare. The content script is what extracts article text, injects translated paragraphs beside the original, and renders the selection-translation popup; all of these require running in the page itself.

The script is inert until the user acts: it sends nothing on page load, reads nothing beyond the article body, and only reacts to (a) an explicit translate command from the extension's popup, or (b) the user selecting text and then clicking the translate dot. Selection handling can be turned off entirely in settings. The extension declares no host_permissions, so it holds no ambient authority to make requests on behalf of any site.
```

### Remote code use

```
No, I am not using remote code
```

理由（如需填写说明）：

```
All executable code is contained in the extension package. The extension makes HTTPS requests to the AI provider endpoint the user configured, but responses are parsed strictly as data (text and JSON) and inserted into the page as text content — never evaluated, never injected as script. There is no eval, no new Function, and no remotely hosted script or WASM.
```

### Data usage — 需勾选的项目

**【需你确认】** 在 “What user data do you plan to collect?” 中，本扩展**不收集任何一项**，全部留空不勾选。

然后勾选三项声明（均成立）：

- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

> 说明：文章正文会发送到**用户自己配置**的 AI 服务商，这属于实现用户请求功能的必要传输，不是开发者「收集」数据，也不是向第三方「出售或转移」。隐私政策中已完整披露该数据流向，若审核追问，指向 PRIVACY.md 的「What leaves your browser」一节即可。

### Privacy policy URL

```
https://github.com/Dearest/contexta/blob/master/PRIVACY.md
```

---

## 三、Distribution（分发）

| 字段 | 建议值 |
| --- | --- |
| Visibility | **【需你确认】** Public（公开）／Unlisted（仅凭链接访问，适合先小范围试用） |
| Distribution regions | All regions |
| Pricing | Free |

---

## 四、提交前检查清单

- [ ] 上传的是 `contexta.zip`，且解压后根目录直接是 `manifest.json`
- [ ] `manifest.json` 中 `version` 为 `0.3.0`
- [ ] 4 张截图均为 1280×800
- [ ] 隐私政策 URL 可公开访问（仓库为 private 时该链接会 404，须先公开或另找托管）
- [ ] **【需你确认】** 开发者账号已填写联系邮箱并完成验证（未验证无法发布）
- [ ] 已在干净的 Chrome profile 里加载 `dist/chrome-mv3/` 走过一遍完整流程

---

## 五、审核风险预判

按可能性排序，附应对方式。

**1. 要求解释 `<all_urls>`（最可能）**

翻译类扩展的常见问询。用上面的 content script 理由回复即可，关键论点：无 `host_permissions`、用户不操作则不发送任何数据、划词可关闭。

**2. 审核员无法测试功能（较可能）**

扩展需自备 API Key，审核员没有 Key 就走不完流程，可能被判「功能无法验证」。建议在提交备注（Reviewer notes）里提供一组临时可用的测试凭证：

```
Contexta requires the user's own OpenAI-compatible API key by design — the
extension provides no translation service of its own and has no backend.

For review purposes, you can use this temporary test configuration:
  Options page → Add custom provider
  Base URL: <【需你确认】填一个你愿意临时公开的 endpoint>
  API Key:  <【需你确认】临时 key，审核通过后请立即吊销>
  翻译模型: <模型名>

Then open any English article and click the extension icon → 开始翻译.
This key is issued for review only and will be revoked afterwards.
```

> 建议专门申请一个**限额度、可随时吊销**的 key，别用你日常的。审核通过后立刻吊销。

**3. 名称含中文（可能性低）**

“Contexta 境译” 混排中英通常没问题。若被要求调整，改为 `Contexta - AI Article Translator` 即可。

**4. 描述被判夸大（可能性低）**

现有描述已避免「最好」「最强」这类表述，且明确说明需自备 API Key，风险较小。
