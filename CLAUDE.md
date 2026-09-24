# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # WXT dev server (Chrome MV3, hot reload)
npm run build        # Production build → dist/chrome-mv3/
npm test             # Vitest (all tests, once)
npm test -- tests/prompts.test.ts           # Single test file
npx vitest run tests/prompts.test.ts -t "includes target language"  # Single test case
npm run compile      # TypeScript type check (no emit)
```

always run `npm run build` after making changes to source files
Load the extension in Chrome: `chrome://extensions` → "Load unpacked" → select `dist/chrome-mv3/`.

## Architecture

Three-tier Chrome MV3 extension communicating via `chrome.runtime.message`:

```
Popup (React UI) → Background (Service Worker) → Content Script (DOM)
```

- **Popup** (`entrypoints/popup/`): Translation controls, 3-way mode toggle (原文/双语/译文), export dialog. Sends `translate`/`export-obsidian` messages to Background.
- **Background** (`entrypoints/background.ts`): Orchestrator for LLM calls and Obsidian export. Receives extraction results from Content Script, translates paragraphs sequentially via Vercel AI SDK, pushes `translation-result` back. Holds `lastArticle` in memory + `chrome.storage.session` (for retry only). Does NOT store translations — DOM is the source of truth.
- **Content Script** (`entrypoints/content.ts`): Extracts article via Defuddle, finds content container (prefers `<article>` tag), extracts paragraphs via TreeWalker, injects translations into DOM. Also handles export markdown building (has DOM access for Turndown). Its `onMessage` handler is **synchronous** (not `async`) to avoid stealing response channels from Background.
- **Options** (`entrypoints/options/`): Provider/model config, custom translation presets, Obsidian API settings. Standalone tab (configured via `<meta name="manifest.open_in_tab" content="true" />`).

**Why Background handles LLM calls**: Service Worker has no CORS restrictions, avoids page CSP blocking, keeps API keys out of page context.

**Why Content Script builds export markdown**: Service Worker has no `DOMParser`. Turndown needs DOM to convert HTML → Markdown. Content Script has full DOM access and holds the Defuddle HTML.

## Key Modules (lib/)

| Module          | Role                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `types.ts`      | All shared types + `Message` discriminated union (the message protocol)                                  |
| `constants.ts`  | 4 preset providers (智谱/硅基/Kimi/MiniMax), 4 translation presets, 3 target languages, defaults         |
| `storage.ts`    | Typed `getStorage`/`setStorage` wrappers over `chrome.storage.local`                                     |
| `prompts.ts`    | Pure functions: `buildSystemPrompt`, `buildUserPrompt`, `buildSummaryPrompt`, `buildQuotesPrompt`        |
| `translator.ts` | `translateParagraph()` via Vercel AI SDK `generateText()` + `isAlreadyTargetLang()` for language detection |
| `extractor.ts`  | `extractParagraphs(container)` — TreeWalker over text block tags, `getTextPreservingBreaks()` for `<br>` |
| `injector.ts`   | `injectTranslation` (copies className, handles `\n`→`<br>`), `switchDisplayMode`, loading/error states   |
| `site-rules.ts` | Per-host `paragraphSelector` overrides (X: tweet bodies + long-form Article blocks). Bypasses container detection + fallback. |
| `messages.ts`   | `sendToBackground`, `sendToTab`, `onMessage` — Chrome message wrappers                                   |
| `obsidian.ts`   | `buildFrontmatterAndCallouts` + `exportToObsidian` (PUT to local REST API). No Turndown (runs in SW).    |
| `selection.ts`  | Selection translation UI — green dot + popup, all inside a Shadow DOM. Owns the streaming render state.   |
| `providers.ts`  | `resolveActiveProvider`, `fetchModels` (tolerates 3 response shapes)                                       |
| `input-polish.ts` | Triple-space writing polish — trigger detection, panel, `execCommand` replacement. Own Shadow DOM host. |
| `polish-parse.ts` | Incremental parser for the polish response. Drops malformed lines rather than losing the rewrite.      |

## Translation Flow

1. Popup sends `{ action: 'translate' }` → Background stores pending state in `chrome.storage.local`, tells Content Script to `extract`
2. Content Script: Defuddle extracts article HTML → `findContentContainer()` locates real DOM container (prefers single `<article>` element, falls back to heuristic) → `extractParagraphs()` finds text blocks → sends `extract-result` with paragraphs + `contentHtml` to Background
3. Background: Skips paragraphs already in target language (`isAlreadyTargetLang` — CJK ratio for Chinese, Latin ratio for English). Loops remaining paragraphs sequentially, each with prev/next context. Pushes `translation-result` per paragraph.
4. Content Script: Injects same-tag element after original with `data-contexta="translation"`, copies `className` from original for style parity. Converts `\n` in translation to `<br>`. Bilingual mode adds top dashed green line; target-only hides originals.

## Feed Pages (site rules)

Hosts in `lib/site-rules.ts` (X) skip container detection: `extractParagraphs(document.body, selector)` takes only the blocks the selector names, so names/handles/buttons are never translated. After the first extract, Content Script keeps a `MutationObserver` (debounced 500ms) and sends newly appeared blocks as `extract-more`; Background appends them to `lastArticle` and runs them through the same serialized queue (`generation` counter cancels stale batches on a new `translate`). X unmounts far-away cells, so a text→translation cache in Content Script re-injects remounted tweets without an LLM call. The observer stops on URL change (SPA navigation) and on `clear-translations`.

## Selection Translation Flow

Latency-critical, so it deviates from the paragraph pipeline in three ways.

1. Content Script watches `mouseup`; a valid selection shows a green dot next to it (`lib/selection.ts`). Skips selections inside inputs/textareas/contenteditable.
2. Clicking the dot sends `translate-selection` with a `requestId` and opens the popup
3. Background resolves `quickModel` (falls back to `activeModel`) and calls `streamSelection()`, pushing `selection-chunk` per token, then `selection-done`
4. Content Script appends each chunk into the popup; a `requestId` mismatch means a newer selection superseded this one, so the chunk is dropped

Why it differs from paragraph translation:
- **Streams** (`streamText`) instead of `generateText` — perceived speed is dominated by time-to-first-token
- **Separate model** (`quickModel`) so the main translation can use a slower, better model
- **Leaner prompt** (`buildSelectionSystemPrompt`) — no context, no placeholder-tag rules, no two-step strategy
- **In-memory LRU cache** (50 entries) keyed on the selected text

`streamSelection` consumes `fullStream`, not `textStream`: reasoning models emit nothing on `textStream` while thinking, which is indistinguishable from a hang. Reasoning deltas trigger `selection-reasoning`, and the popup explains the wait instead of showing a dead caret.

## Input Polish Flow

Three spaces in any text field rewrite it into idiomatic English. Target case is **mixed writing** — English where the user is confident, Chinese where they aren't — so it's "finish my sentence", not grammar checking. Full design: `docs/input-polish.md`.

1. `lib/input-polish.ts` watches `keydown` for 3 spaces within 400ms. **Skips `isComposing`/`keyCode === 229`** — otherwise IME candidate-selection spaces fire it constantly.
2. Sends `polish-input` with the whole field's text (minus the two spaces that leaked through) plus `InputContext` (host/path/placeholder/charsLeft)
3. Background resolves `polishModel → quickModel → activeModel`, calls `streamPolish()`, pushes `polish-chunk` per token
4. `lib/polish-parse.ts` parses incrementally. The response is `<polished text>\n---\n<change lines>`; **the text is applied the moment `---` arrives**, without waiting for explanations
5. Panel renders above the field: gaps (Chinese the user couldn't write) in emerald and larger, corrections in grey and smaller. Both shown — ordering steers attention, hiding would decide for the user
6. Changes go to `record-gap` → appended to one Obsidian note via `POST /vault/{path}`, or `chrome.storage.local` when Obsidian isn't configured

Key constraints, all load-bearing:
- **`execCommand('insertText')`, never `setRangeText`/`.value =`** — it's the only path preserving the native undo stack (⌘Z is what lets replacement skip a confirm step) and it dispatches a trusted `input` event so React/Vue/Lexical see the change. Verified by reading content back; failure falls back to the clipboard.
- **Prompt must forbid rewriting existing English.** Left alone the model rewrites whole sentences, burying which parts the user couldn't write, flattening their voice, and poisoning the gap log.
- **Plain text, not JSON** — the free/small models this project targets are unreliable at JSON, and nothing renders until an object parses. No separator in the response → treat everything as the polished text.

## Export Flow (Obsidian)

1. Popup sends `{ action: 'export-obsidian' }` → Background
2. Background sends `{ action: 'build-export-markdown' }` to Content Script
3. Content Script reads translations **directly from DOM** (`[data-contexta="translation"]` elements), converts Defuddle HTML to Markdown via **Turndown** (DOMParser + text replacement), returns `{ markdown, translatedText, metadata }`
4. Background generates summary/quotes via LLM if requested (using `translatedText`), builds frontmatter + callouts, combines with content markdown, PUTs to Obsidian Local REST API

**Format handling in Turndown conversion:**
- Source-only: `Turndown(defuddleHtml)` — full fidelity (code blocks, images, links preserved)
- Target-only: Replace text content of translatable elements with translations, then Turndown
- Bilingual: Insert translation element after each translatable element, then Turndown

## State Management

| Data | Location | Persisted | Purpose |
|------|----------|-----------|---------|
| Translations | DOM (`data-contexta` elements) | Page lifetime | Source of truth for display + export |
| `lastArticle` | Background memory + `chrome.storage.session` | Session | Retry needs paragraph prev/next context |
| `lastDefuddleHtml`, `lastMetadata` | Content Script memory | Page lifetime | Export markdown building |
| Provider config, API keys | `chrome.storage.local` | Permanent | User settings |
| `_pendingTranslation` | `chrome.storage.local` | Permanent | tabId + translation params |
| Selection cache | Content Script memory | Page lifetime | Skip re-translating the same selection |

## Translation Prompt System

Prompts use XML tags (`<source>`, `<context>`) for reliable parsing by small/free LLMs. Built from two layers:

- **Core rules** (hardcoded in `buildSystemPrompt`): preserve terms, code, URLs; normalize punctuation; two-step translate strategy (literal → natural)
- **Preset rules** (from `constants.ts` or user custom): style-specific guidance appended to system prompt

4 built-in presets: `tech-blog` (default), `academic`, `popular-science`, `faithful`. Users can add custom presets in Options.

## Content Extraction Details

- `findContentContainer()`: Prefers single `<article>` element → multiple articles matched by Defuddle snippet → fallback heuristic (text snippet matching + common ancestor)
- `extractParagraphs()`: TreeWalker over `TEXT_BLOCK_TAGS` (P, H1-H6, LI, BLOCKQUOTE, TD, etc.), skips `SKIP_TAGS` (PRE, CODE, SCRIPT, etc.)
- `getTextPreservingBreaks()`: Recursively walks child nodes, converts `<br>` to `\n` (unlike `textContent` which drops them)
- `isAlreadyTargetLang()`: CJK ratio > 0.3 → Chinese (lower threshold because Chinese text mixes English terms), Latin ratio > 0.5 → English

## Message Handler Patterns

Content Script's `onMessage` handler is **synchronous** (not `async`). This is critical: an `async` handler always returns a Promise, causing the `onMessage` wrapper to return `true` for every message — even unhandled ones like `export-obsidian` — which steals the response channel from Background. Only `build-export-markdown` returns a Promise (async response needed).

## Styling

Tailwind CSS v4 with emerald green theme: `primary` (#059669), `primary-dark` (#065f46), `primary-light` (#ecfdf5), `primary-border` (#a7f3d0). shadcn/ui components in `components/ui/`. Popup CSS uses `@import "tailwindcss"` (v4 syntax).

Bilingual mode: top dashed green line (`border-top: 1px dashed #a7f3d0`) separates original from translation. Target-only mode: no decoration. Translated elements copy original's `className` for style parity.

## Release Workflow

When user says "发布版本", execute the following steps:

1. **Determine version**: Ask user for the new version number (semver), or infer from context (patch for bugfix, minor for feature)
2. **Update `package.json`**: Bump the `version` field
3. **Update `CHANGELOG.md`**: Add a new section at the top with version, date, and categorized changes (Added/Fixed/Changed). Summarize from git log since the last tag
4. **Build & test**: Run `npm run build` and `npm test` to verify
5. **Commit**: `git add package.json CHANGELOG.md && git commit -m "chore: bump version to X.Y.Z and update CHANGELOG"`
6. **Tag**: `git tag vX.Y.Z`
7. **Push**: `git push && git push origin vX.Y.Z`

The `v*` tag push triggers `.github/workflows/release.yml` which auto-builds CRX/ZIP and creates a GitHub Release.

**Chrome Web Store submission** (manual, separate from the above): run `npm run zip:store` to produce `dist/contexta-<version>-chrome-store.zip` — this strips the `key` field from `manifest.json` that `npm run build`/`zip` leave in for stable local extension IDs, since the Store rejects uploads containing it ("key field is not allowed in manifest"). Upload that file, not `contexta.zip`. See `docs/chrome-web-store.md` and `docs/chrome-web-store-checklist.md`.
