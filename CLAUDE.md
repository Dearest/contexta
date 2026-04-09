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

Load the extension in Chrome: `chrome://extensions` → "Load unpacked" → select `dist/chrome-mv3/`.

## Architecture

Three-tier Chrome MV3 extension communicating via `chrome.runtime.message`:

```
Popup (React UI) → Background (Service Worker) → Content Script (DOM)
```

- **Popup** (`entrypoints/popup/`): Translation controls, mode toggle, export dialog. Sends `translate`/`export-obsidian` messages to Background.
- **Background** (`entrypoints/background.ts`): Central orchestrator. Receives extraction results from Content Script, calls LLM API sequentially per paragraph via Vercel AI SDK, pushes `translation-result` back to Content Script. Holds `lastArticle`/`lastTranslations` in memory for export.
- **Content Script** (`entrypoints/content.ts`): Uses Defuddle (dynamic import) to extract article content, `extractParagraphs()` to find text blocks via TreeWalker, injects translations into DOM with `data-contexta-*` attributes. Handles retry via event delegation.
- **Options** (`entrypoints/options/`): Provider/model config, custom translation presets, Obsidian API settings. Standalone tab (configured via `<meta name="manifest.open_in_tab" content="true" />`).

**Why Background handles LLM calls**: Service Worker has no CORS restrictions, avoids page CSP blocking, keeps API keys out of page context.

## Key Modules (lib/)

| Module | Role |
|--------|------|
| `types.ts` | All shared types + `Message` discriminated union (the message protocol) |
| `constants.ts` | 4 preset providers (智谱/硅基/Kimi/MiniMax), 4 translation presets, defaults |
| `storage.ts` | Typed `getStorage`/`setStorage` wrappers over `chrome.storage.local` |
| `prompts.ts` | Pure functions: `buildSystemPrompt`, `buildUserPrompt`, `buildSummaryPrompt`, `buildQuotesPrompt` |
| `translator.ts` | `translateParagraph()` via Vercel AI SDK `generateText()` with `@ai-sdk/openai-compatible` |
| `extractor.ts` | `extractParagraphs(container)` — TreeWalker over text block tags, attaches `data-contexta-id`, returns paragraphs with prev/next context |
| `injector.ts` | `injectTranslation`, `clearAllTranslations`, `switchDisplayMode` — all DOM manipulation |
| `messages.ts` | `sendToBackground`, `sendToTab`, `onMessage` — Chrome message wrappers |
| `obsidian.ts` | `buildObsidianMarkdown` (frontmatter + callouts) + `exportToObsidian` (PUT to local REST API) |

## Translation Flow

1. Popup sends `{ action: 'translate' }` → Background stores pending state, tells Content Script to `extract`
2. Content Script: Defuddle extracts article → `extractParagraphs()` finds text blocks → sends `extract-result` to Background
3. Background: Loops paragraphs sequentially, each with prev/next context in prompt. Two-step prompt strategy (literal → natural) in single LLM call. Pushes `translation-result` per paragraph.
4. Content Script: Injects same-tag element after original with `data-contexta="translation"`. Bilingual shows both; target-only hides originals.

## Translation Prompt System

Prompts are built from two layers:
- **Core rules** (hardcoded in `buildSystemPrompt`): preserve terms, code, URLs; normalize punctuation; two-step translate strategy
- **Preset rules** (from `constants.ts` or user custom): style-specific guidance appended to system prompt

4 built-in presets: `tech-blog` (default), `academic`, `popular-science`, `faithful`. Users can add custom presets in Options.

## Extension ID Stability

`wxt.config.ts` has a fixed `manifest.key` to keep the extension ID stable across rebuilds. Without this, `chrome.storage.local` data (API keys, config) is lost when the output directory changes. See exp-book for details.

## Testing

Vitest with `happy-dom` environment. Tests cover pure logic modules: `prompts`, `providers`, `extractor`, `injector`, `obsidian`. No tests for Chrome API-dependent code (background, content script, storage) — those are tested manually.

## Styling

Tailwind CSS v4 with emerald green theme: `primary` (#059669), `primary-dark` (#065f46), `primary-light` (#ecfdf5), `primary-border` (#a7f3d0). shadcn/ui components in `components/ui/`. Popup CSS uses `@import "tailwindcss"` (v4 syntax).
