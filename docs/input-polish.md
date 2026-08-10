# Input 写作润色 — 实现文档

> 状态：P0 已实现（`feat/input-polish` 分支），待真机验证
> 最后更新：2026-08-11

## 1. 定位

Contexta 在「读」之外的第二条曲线：**帮用户把写不出来的英文写出来**。

核心场景不是纠错，而是**中英混写**：

```
I want to 确保 this feature 正常工作 before we ship
                ↓ 三下空格
I want to ensure this feature works properly before we ship
```

会的地方写英文，不会的地方写中文，一键补全 —— 就像小时候写作文用拼音代替不会写的字，**先把话说完，再回头补**。

这决定了产品边界：

| | Grammarly / Wordtune | Contexta |
|---|---|---|
| 修的是 | 你**写错的** | 你**写不出的** |
| 解释语言 | 英文 | **中文**（母语解释语感差异，效率高一个量级） |
| 学习闭环 | 无（改完就完） | 即时反馈 + 长期沉淀到用户自己的 Obsidian |

## 2. 三条设计原则

**2.1 写完再改，不实时打断。** 不做输入时下划线，不做自动触发，一切由用户主动发起。不提供「实时 / 手动」开关 —— 只有手动。

**2.2 即时反馈优先于事后沉淀。** 用户写下 `can work` 的那一秒，脑子里那个错误念头还活着，此时纠正是在覆盖一个活的表征；等到晚上再看记录，脱离了上下文，等于从零学一遍。所以**修改说明必须当场展示**，沉淀只是副产品。

**2.3 替换零打断，解释自动来去。** 替换后光标回到末尾可直接续写；解释浮层自动展开、自动淡出，用户不需要为它分配任何操作。

### 被否决的方案（记录理由，避免回头重走）

| 方案 | 否决理由 |
|---|---|
| 选中文本触发（同划词翻译） | 写完时光标在末尾、没有选中，要先 ⌘A 是纯粹的摩擦 |
| 8 行场景规则表（X / Reddit / GitHub…各一套 prompt） | 维护成本高、覆盖面反而窄。改为**上下文注入**（host + path + placeholder + maxlength），模型自行适配。只有 X 的 280 字符是硬约束，需显式特例 |
| 结构化 JSON 输出 | 与项目既有约束冲突 —— `lib/prompts.ts` 明确用 XML 标签是为了让小模型/免费模型可靠解析。JSON 在 GLM-Flash 这类模型上会翻车，且需要 `streamObject`，与现有 `fullStream` 逐 token 管道不兼容 |
| CJK 占比检测决定「翻译 or 润色」 | 不需要这个分支。**一个 prompt 通吃**：目标是「输出地道英文」，输入是中文它就翻译，是英文它就润色，混写它也处理得比阈值判断好。少一个分支、少一类误判 |
| 徽标只报新词数、折叠语法修正 | 用户明确表示语法也想学。改为**两类都显示、只做视觉分层** —— 分层是引导注意力，隐藏是替用户做决定 |
| 替换前预览确认 | 有更好的后悔药：用 `execCommand('insertText')` 写入可保留浏览器原生 undo 栈，⌘Z 直接还原。零成本撤销之下，确认步骤就是纯摩擦 |
| 浮层内可编辑润色结果 | 会长成一个小型编辑器，复杂度失控。不满意就 ⌘Z 重写再触发 |

## 3. 交互时序

```
用户在输入框写：I want to 确保 this feature 正常工作 before we ship
  │
  ├─ ␣␣␣  (400ms 内三次 keydown，isComposing 时忽略)
  │
  ├─ ① 立即删除刚打进去的 3 个空格
  ├─ ② 输入框上方浮出 shimmer 占位条（唯一的等待反馈）
  │
  ├─ ③ 流式响应到达 `---` 分隔符 → 正文完整 → **立即整段替换**
  │     execCommand('insertText')，光标落到末尾，用户可直接续写
  │     ⌘Z 可完整还原
  │
  ├─ ④ 解释继续流式填入浮层（此时用户已经能继续写了）
  │
  └─ ⑤ 浮层在流式结束后开始倒计时淡出
```

**为什么正文不逐字替换**：逐 token 写进 input 会让光标疯狂跳动。所以正文攒齐再一次性替换 —— 但**不等整个响应结束**，一见到 `---` 就替换，感知延迟只取决于正文长度。

### 浮层形态

位置：**输入框上方，左边缘对齐**（不跟随光标 —— 光标会跳，浮层跟着跳很晕）。上方空间不足时才翻到下方。

```
┌────────────────────────────────────┐
│  确保      → ensure                 │  ← 新词：墨绿 #059669，15px
│  语气比 make sure 更确定，技术场景常用 │     说明：灰 #6b7280，13px
│                                    │
│  正常工作  → works properly         │
│  英文里「正常」用副词，不用形容词      │
│  ──────────────────────────        │
│  can work → works                  │  ← 修正：灰 #9ca3af，13px
│  去掉多余情态动词，直接陈述更有力      │     说明：12px
└────────────────────────────────────┘
```

两类都展示，只做视觉分层：**新词在上、墨绿、大**；**修正在下、灰、小**。眼睛自动先落在更缺的那部分。

### 淡出逻辑（四条，都为「看一眼」这个动作服务）

1. **计时从流式结束开始**，不是从弹出开始 —— 否则内容还在吐，倒计时已跑掉一半
2. **hover 暂停**
3. **继续打字立即淡出** —— 用户开始写下一句 = 已经看完，这个信号比任何定时器都准
4. 基准 **6000ms**，每多一条修改 +1500ms，上限 12000ms

### 回看入口

浮层消失后，输入框右下角留一枚极淡的小圆点（4px，`#a7f3d0`）。点击**从内存缓存重新展开上次结果，不再请求 LLM**。解决「刚才没看清但不想重跑」。输入框失焦或内容被大幅改动时移除。

## 4. Prompt 设计

### 4.1 必须写死的混写约束（成败关键）

默认行为下，模型拿到 `I want to 确保 this feature 正常工作` 会**把整句重写一遍**，包括用户写对的部分。后果：

- 用户分不清哪些是「我不会的」，学习信号被噪音淹没
- 用户的表达风格被抹平成 LLM 腔
- 沉淀记录里混进大量用户本来就会的内容，统计失真

所以约束必须显式且强硬。

### 4.2 `buildPolishSystemPrompt(context)`

新增到 `lib/prompts.ts`，与既有 `buildSelectionSystemPrompt` 风格一致（精简、无两步策略、面向低延迟）：

```
你是一位精通英文写作的编辑。将用户发送的文本处理成地道的英文。

【核心规则】
- 中文片段必须译成英文
- 英文片段原样保留，除非存在语法错误或明显不地道
- 修改英文时最小化改动，不要为了「更好」而重写用户已经写对的句子
- 保留原文的换行和段落结构
- 产品名、公司名、API 名、代码、变量名、URL 不改动

【输出格式】严格按以下两段输出，不要有任何额外文字：
第一段：处理后的完整英文，不加引号、不加解释
第二段：一行 --- 后，每行一条修改说明

修改说明格式：
  中文原文 | 英文 | 中文解释        ← 由中文补全的（新词）
~ 原英文 | 改后英文 | 中文解释      ← 修改用户已有英文的（修正）
+ 新增内容 | 中文解释              ← 纯补充的词

解释用中文，一句话说清为什么这样改，不要泛泛而谈。
若确实没有任何修改，--- 之后留空。
```

`context` 部分（P1）追加：

```
<page>host: github.com | path: /owner/repo/pull/123</page>
<field>placeholder: "Leave a comment" | 剩余可用字符: 无限制</field>
根据以上场景调整语气和长度。
```

X 的字符限制是硬约束（中译英通常变长，超限直接发不出去），必须显式注入剩余字符数并要求不超出。

### 4.3 期望输出

```
I want to ensure this feature works properly before we ship
---
确保 | ensure | 语气比 make sure 更确定，技术场景常用
正常工作 | works properly | 英文里「正常」用副词，不用形容词
~ can work | works | 去掉多余情态动词，直接陈述更有力
```

## 5. 技术实现

### 5.1 新增文件

| 文件 | 职责 |
|---|---|
| `lib/input-polish.ts` | 三下空格监听、浮层渲染、文本替换。**独立 Shadow DOM host**（`contexta-polish-host`），不与 `selection.ts` 共用 —— 定位逻辑和内容结构完全不同，共用会互相纠缠。色值与 selection.ts 保持一致 |
| `lib/polish-parse.ts` | 流式解析器（纯函数，好测） |
| `lib/input-context.ts` | P1：采集 host / path / placeholder / maxlength |

### 5.2 改动文件

- `lib/types.ts` — 消息协议 + storage schema
- `lib/prompts.ts` — `buildPolishSystemPrompt`
- `lib/translator.ts` — `streamPolish`
- `lib/obsidian.ts` — `appendGapEntries`
- `entrypoints/content.ts` — 初始化 input-polish
- `entrypoints/background.ts` — `handlePolishInput` / `handleRecordGap`

### 5.3 消息协议

追加到 `lib/types.ts` 的 `Message` union。与 selection 流程同构（requestId 防串），但**不打开 popup** —— 全部在页面内 Shadow DOM 渲染：

```ts
| { action: 'polish-input'; requestId: string; text: string; context?: InputContext }
| { action: 'polish-chunk'; requestId: string; chunk: string }
| { action: 'polish-reasoning'; requestId: string }
| { action: 'polish-done'; requestId: string }
| { action: 'polish-error'; requestId: string; error: string }
| { action: 'record-gap'; entries: GapEntry[] }
```

### 5.4 数据结构

```ts
export interface InputContext {
  host: string
  path: string
  placeholder?: string
  /** 剩余可用字符数，null 表示无限制 */
  charsLeft: number | null
}

export type ChangeKind = 'new' | 'fix' | 'add'

export interface PolishChange {
  kind: ChangeKind
  source: string   // kind==='add' 时为空
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
```

### 5.5 Storage 追加

```ts
// StorageSchema
inputPolishEnabled: boolean        // 默认 true
/** 润色使用的模型，null 时回退 quickModel → activeModel */
polishModel: ActiveModel | null
/** 是否把表达缺口写入 Obsidian，默认 false（未配置时落 chrome.storage.local） */
gapRecordEnabled: boolean
/** vault 内的相对路径，默认 '英语表达缺口.md' */
gapNotePath: string
```

模型解析链：`polishModel → quickModel → activeModel`。复用 `resolveActiveProvider`。

目标语言 P0 固定英文（这个功能的定义就是「写英文」），暂不暴露 UI 配置。

### 5.6 `streamPolish`

照搬 `streamSelection` 的结构（`lib/translator.ts:97`），只换 system prompt。**必须同样消费 `fullStream` 而非 `textStream`** —— 推理模型思考期间 `textStream` 无输出，与卡死无法区分，`reasoning-delta` 用来让浮层显示「思考中」而不是死光标。

```ts
export async function streamPolish(
  provider: Provider,
  modelId: string,
  text: string,
  context: InputContext | undefined,
  onChunk: (chunk: string) => void,
  onReasoning?: () => void,
): Promise<void>
```

### 5.7 流式解析（`lib/polish-parse.ts`）

有状态的增量解析器，边流边切：

```ts
export function createPolishParser(): {
  /** 喂入一个 chunk，返回本次产生的增量事件 */
  push(chunk: string): { bodyDone?: string; changes: PolishChange[] }
  /** 流结束时调用，处理未闭合状态与兜底 */
  finish(): { bodyDone?: string; changes: PolishChange[] }
}
```

规则：

- 单独成行的 `---` 是分隔符。**遇到即认为正文完整，立刻抛出 `bodyDone` 触发替换**
- `---` 之后按行解析，每行按 `|` 切分并 trim
  - 以 `~ ` 开头 → `kind: 'fix'`
  - 以 `+ ` 开头 → `kind: 'add'`（两段：target | reason）
  - 其余 → `kind: 'new'`
  - 字段数不足或全空的行**静默丢弃**（小模型偶发格式漂移，不该炸掉整次润色）
- **兜底**：流结束时若从未出现 `---`，把全部内容当正文替换，`changes` 为空，浮层显示「本次无修改说明」。绝不因为解释部分格式不对而丢掉用户真正要的正文

### 5.8 文本替换 —— 必须用 `execCommand`

**这是本功能唯一的硬技术点，且决定了「不做预览确认」这个交互决策能否成立。**

```ts
function replaceText(el: HTMLElement, start: number, end: number, text: string) {
  el.focus()
  // 选中要被替换的范围
  // input/textarea: el.setSelectionRange(start, end)
  // contentEditable: 构造 Range + Selection
  document.execCommand('insertText', false, text)
}
```

关键点：

- **`setRangeText()` 不进浏览器 undo 栈，`execCommand('insertText')` 进。** ⌘Z 能否还原完全取决于用这个。`execCommand` 名义上 deprecated，但所有浏览器仍支持，且是编辑器插件的事实标准
- `execCommand` 会自然派发可信的 `input` 事件，**React 受控组件、Vue、Lexical、ProseMirror 全都能正确收到**。这避开了直接改 `.value` 的经典坑（需要 `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` 拿原生 setter 再手动派发）—— 若某站点确实失败，这是降级路径
- 失败检测：替换后读回内容比对，不一致则**降级为「已复制到剪贴板」提示**，不静默失败

### 5.9 三下空格检测（五个坑，提前标出）

```ts
// 伪代码
let taps: number[] = []
const WINDOW_MS = 400

el.addEventListener('keydown', (e) => {
  if (e.key !== ' ') { taps = []; return }
  if (e.isComposing || e.keyCode === 229) { taps = []; return }  // ← 最致命
  const now = performance.now()
  taps = taps.filter(t => now - t < WINDOW_MS)
  taps.push(now)
  if (taps.length < 3) return
  taps = []
  e.preventDefault()
  trigger(el)
})
```

1. **`isComposing` 必须跳过** —— 中文输入法拼音阶段空格是选词键，不防会疯狂误触发。目标用户 100% 用中文输入法，这是**最致命的一条**。同时检查 `keyCode === 229`，部分输入法不设 `isComposing`
2. **三个空格要吃掉** —— 第三次 `preventDefault()` 挡住，前两个已经进了输入框，替换前先删掉。或统一在 `trigger` 里对末尾连续空格做清理
3. **时间窗 400ms** —— 250ms 打字快的人触发不了，600ms 正常打两个空格再打一个会误触
4. **触发范围 = 整个输入框**。原计划的「有选中时只处理选中部分」**在三下空格这个入口下不可达**：浏览器里对着一段选中文本按空格，第一下就把选中内容替换成了空格，等第三下触发时原文已经没了。要支持局部润色只能换入口（快捷键或右键菜单），留待后续
5. **X 的 280 字符** —— 中译英通常变长，必须把剩余字符数注入 prompt

其它边界：

- 空内容 / 少于 2 字符 → 不触发
- 超过 5000 字符 → 不触发（同 selection 的 `MAX_SELECTION_LENGTH`）
- 已有请求在跑时再次触发 → 新 requestId 覆盖，旧的结果按 requestId 丢弃
- 密码框（`type="password"`）、`type="number"` 等非文本 input → 跳过

### 5.10 Obsidian 落点

**价值定位：统计，不是复习。** 逐条回看没有意义（脱离上下文就废了，这正是 §2.2 的推论）；价值在于三个月后能跑出「本季度 47 次写不出英文，14 次集中在状态确认类动词（确保/保证/避免）」这种结论 —— 复习永远得不出这个。

设计：

- **单文件追加**，不是一堆笔记：默认 `英语表达缺口.md`
- 用 Local REST API 的 **`POST /vault/{path}`**（append 语义，文件不存在则创建），区别于文章导出用的 `PUT`（覆盖）
- 一行一条，`|` 分隔，可 grep / diff / git —— 符合「记忆必须可读可 diff」的硬约束
- 存的是**给 LLM 归类用的最小信号**，不是给人回看的讲解。`reason` 一行简存以提供语义
- **必须可关，且不能成为主功能的前置依赖**：未配置 Obsidian 时落 `chrome.storage.local`（滚动上限 500 条），润色照常工作

```markdown
- 2026-08-10 | 新词 | 确保 | ensure | 语气比 make sure 更确定 | github.com
- 2026-08-10 | 新词 | 正常工作 | works properly | 英文用副词不用形容词 | github.com
- 2026-08-10 | 修正 | can work | works | 去掉多余情态动词 | github.com
```

`新词` 与 `修正` 分开标记 —— 表达缺口和语法惯性错误是两份不同的报告，两份都有用。

这个文件天然能被既有的 `dream` 管道消费，无需额外开发。

写入时机：浮层展示后**异步 fire-and-forget**，失败静默（最多 console.warn）。绝不阻塞或干扰写作流。

## 6. 分期

| 状态 | 内容 |
|---|---|
| ✅ | 三下空格检测（含 `isComposing` 防护）→ `streamPolish` → 流式解析 → `execCommand` 原地替换 + ⌘Z 可撤销 |
| ✅ | 混写保留约束的 prompt + 新词/修正两类输出 |
| ✅ | 浮层：自动展开、视觉分层、四条淡出逻辑、回看小圆点 |
| ✅ | `input` / `textarea` 支持；contentEditable 走 `execCommand` 通用路径，**不为任何编辑器做特例适配**，跑不通降级为「复制到剪贴板」 |
| ✅ | 上下文注入（host / path / placeholder / maxlength）—— 比预期便宜，提前做了 |
| ✅ | Obsidian 追加落点（默认关，未配置时落 `chrome.storage.local`，上限 500 条） |
| ✅ | Options 页开关 |
| **待做** | Options 页：润色专用模型选择、Obsidian 缺口文件路径与开关的 UI（目前只能改 storage） |
| **待做** | X 的字符限制特例（Draft.js 不用 `maxlength`，通用采集拿不到） |
| **待做** | contentEditable 扩面验证（X / Slack / Notion 逐个踩坑） |
| **待做** | 局部润色入口（三下空格无法承载，见 §5.9 第 4 条） |
| **待做** | 缺口统计报告（按类别聚合，或直接交给 dream 管道） |

## 7. 待验证 / 风险

- **`execCommand` 在各编辑器的实际表现**。已知良好：普通 `textarea`（GitHub、Reddit old、Gmail 纯文本）。待验证：X（Draft.js）、Slack（Quill 系）、Notion、Linear（ProseMirror）。**先做验证再决定 P2 范围，不要先承诺全站点**
- **小模型的格式稳定性**。GLM-Flash / 硅基免费模型是否稳定输出 `---` 分隔符。兜底已设计（§5.7），但需实测确认兜底触发率不至于高到让解释功能形同虚设
- **三下空格与站点自身快捷键的冲突**。目前未发现主流站点用连续空格做快捷键，但需在 X / Slack 实测
- **首字延迟**。正文替换要等到 `---`，长文本（数百词）下可能到 3-5s。若实测不可接受，考虑：正文按句流式累积 + 在浮层预览，用户确认后才替换（但这会引回被否决的确认步骤，是最后手段）
