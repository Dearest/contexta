# Privacy Policy — Contexta（境译）

**Last updated: 2026-08-05**

Contexta is a browser extension that translates web articles using an AI model
provider that **you** configure with **your own** API key.

## The short version

- The developer of Contexta operates **no servers** and **collects nothing**.
- Your API keys and settings are stored **only in your own browser**.
- Article text is sent **directly from your browser** to the AI provider and the
  Obsidian vault that *you* configured — never through any intermediary.

## What Contexta stores, and where

Everything below lives in `chrome.storage.local` on your own machine. None of it
is transmitted anywhere except as described in the next section.

| Data | Why it exists |
| --- | --- |
| Provider name, Base URL, API key | To call the AI model you chose |
| Selected model names | To know which model to use |
| Translation preferences (target language, style preset, display mode) | To apply your settings |
| Obsidian REST API address, token, save path | To export notes to your vault |

Translations themselves are **not** stored. They live in the page's DOM and
disappear when you close or reload the tab. A small in-memory cache (up to 50
entries) holds recent selection translations for the lifetime of the page only.

## What leaves your browser

Contexta makes network requests to exactly two kinds of destinations, both of
which you configure yourself:

**1. Your AI model provider** (e.g. OpenAI-compatible endpoints such as 智谱,
硅基流动, Kimi, MiniMax, or any custom Base URL you enter)

- Sent: the text of the article paragraphs or the text you selected, the
  article title, adjacent paragraphs used as translation context, and your API
  key for authentication.
- Not sent: your browsing history, cookies, form data, credentials for other
  sites, or any identifier of you or your device beyond what your provider's own
  API requires.
- When you request a summary or key quotes on export, the translated text is
  also sent to this provider.

**2. Your Obsidian vault** (only if you configure and use the export feature)

- Sent: the translated article, as Markdown, to the Obsidian Local REST API
  address you specify — by default `http://127.0.0.1:27123`, a server running on
  your own computer.

Both destinations are chosen by you. Their handling of your data is governed by
**their** privacy policies, not this one. Please review the privacy policy of
whichever AI provider you configure.

## What Contexta never does

- No analytics, telemetry, crash reporting, or usage tracking of any kind.
- No advertising, and no data sold, rented, or shared with anyone.
- No account, sign-up, or login.
- No remote code execution: all executable code ships inside the extension
  package. Network responses are treated strictly as data.
- No reading of pages you have not asked to translate. The content script is
  present on pages so it can respond when you invoke translation or select text,
  but it transmits nothing unless you act.

## Permissions, and why each is needed

| Permission | Purpose |
| --- | --- |
| `storage` | Save your provider settings and preferences locally |
| `activeTab` | Read the article in the tab you are currently viewing, only when you start a translation |
| Content script on all sites | Articles can live on any domain, so translation must be available anywhere you read. Nothing is collected or sent without your action. |

## Your control over your data

- All settings can be viewed and edited on the extension's options page.
- Removing an API key or provider deletes it from local storage immediately.
- Uninstalling Contexta erases everything it stored.
- Turning off selection translation in settings stops all selection handling.

## Children

Contexta is a productivity tool for general audiences and is not directed at
children under 13.

## Changes

Material changes to this policy will be published in this file and noted in the
project's CHANGELOG. The "Last updated" date above always reflects the current
version.

## Contact

Questions or concerns: please open an issue at
<https://github.com/Dearest/contexta/issues>.
