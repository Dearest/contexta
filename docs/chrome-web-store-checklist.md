# Chrome Web Store 提交清单（v0.3.0，按 devconsole 页面顺序）

配合 `docs/chrome-web-store.md` 使用，这份是「照着填」的顺序版，已代入你确认过的选项。

上传包：`dist/contexta-0.3.0-chrome-store.zip`（已去除 `manifest.json` 里开发用的 `key` 字段，商店不允许携带该字段）

---

## Step 1｜Package（上传包）

上传 `dist/contexta-0.3.0-chrome-store.zip`，等待解析完成。

---

## Step 2｜Store listing

**Product name**
```
Contexta 境译 — AI 精翻网页文章，一键存入 Obsidian
```

**Summary**
```
用你自己的 AI 模型精翻网页文章，双语对照，划词即译，读完一键存进 Obsidian。
```

**Description**（完整文案见 `docs/chrome-web-store.md`，直接复制那一段代码块）

> ⚠️ **禁止在描述里列举模型服务商品牌名**。首次提交被拒（Keyword Spam，violation ref: Yellow Argon），违规内容就是那句罗列服务商名称的话。只写「兼容 OpenAI 格式的任意接口」，品牌名留在设置页 UI 里。
>
> 英文描述对应写法：
> ```
> Works with any OpenAI-compatible endpoint. The options page ships with presets for a few common providers, and you can add any custom endpoint — including a self-hosted or company-internal gateway.
> ```

**Category**
```
Productivity
```

**Language**
```
中文 (简体) / Chinese (Simplified)
```

**Store icon**
```
dist/chrome-mv3/icon/128.png
```

**Screenshots**（1280×800，按顺序上传）
1. `docs/store-assets/screenshot-1-bilingual.png`
2. `docs/store-assets/screenshot-2-selection.png`
3. `docs/store-assets/screenshot-3-popup.png`
4. `docs/store-assets/screenshot-4-options.png`

**Support URL**
```
https://github.com/Dearest/contexta/issues
```

**Homepage URL**
```
https://github.com/Dearest/contexta
```

---

## Step 3｜Privacy practices

**Single purpose description**
```
Contexta has one purpose: translating the text of web articles using an AI model that the user configures, and optionally saving that translation to the user's own Obsidian vault. Every feature serves this single purpose — paragraph translation, selection translation, display-mode switching, and Markdown export are all steps in reading a foreign-language article and keeping the result.
```

**Permission justification — `storage`**
```
Stores the user's own configuration locally: the provider Base URL and API key they entered, their chosen model names, target language, translation style preset, display mode, and Obsidian export settings. Without it users would have to re-enter their API key on every use. Nothing stored here is transmitted to the developer — there is no server.
```

**Permission justification — `activeTab`**
```
Reads the article content of the tab the user is currently viewing, and only after the user explicitly starts a translation by clicking the extension's action button. This is what allows the extension to extract article paragraphs and insert translations back into the page. No other tab is accessed.
```

**Permission justification — Content script on all URLs (`<all_urls>`)**
```
Articles worth translating exist on every domain — news sites, personal blogs, documentation, research pages — so there is no finite list of hosts to declare. The content script is what extracts article text, injects translated paragraphs beside the original, and renders the selection-translation popup; all of these require running in the page itself.

The script is inert until the user acts: it sends nothing on page load, reads nothing beyond the article body, and only reacts to (a) an explicit translate command from the extension's popup, or (b) the user selecting text and then clicking the translate dot. Selection handling can be turned off entirely in settings. The extension declares no host_permissions, so it holds no ambient authority to make requests on behalf of any site.
```

**Remote code use**
```
No, I am not using remote code
```
说明（如页面要求填写）：
```
All executable code is contained in the extension package. The extension makes HTTPS requests to the AI provider endpoint the user configured, but responses are parsed strictly as data (text and JSON) and inserted into the page as text content — never evaluated, never injected as script. There is no eval, no new Function, and no remotely hosted script or WASM.
```

**Data usage**
- 「What user data do you plan to collect?」→ **全部不勾选**
- 勾选以下三项声明：
  - ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
  - ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  - ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
```
https://github.com/Dearest/contexta/blob/master/PRIVACY.md
```

---

## Step 4｜Distribution

| 字段 | 填 |
| --- | --- |
| Visibility | **Public** |
| Distribution regions | All regions |
| Pricing | Free |

---

## Step 5｜Reviewer notes（提交备注，可选字段）

不附临时测试凭证，只写说明：
```
Contexta requires the user's own OpenAI-compatible API key by design — the extension provides no translation service of its own and has no backend. Reviewers can obtain a free-tier key from any OpenAI-compatible provider to test: open the Options page → add the provider's Base URL and API key → fill in a model name → click "测试连接"/"Test Connection" to verify → then open any English article and click the extension icon to translate.
```

---

## 提交前最后检查

- [ ] 上传的是 `contexta-0.3.0-chrome-store.zip`，解压后根目录直接是 `manifest.json`
- [ ] `manifest.json` 中 `version` 为 `0.3.0`
- [ ] 4 张截图均为 1280×800
- [ ] 隐私政策链接可公开访问（已确认仓库 Public）
- [ ] 开发者账号联系邮箱已验证（已确认账号已注册）
- [ ] 点击 **Submit for review** 前，再通读一遍 Store listing 预览
