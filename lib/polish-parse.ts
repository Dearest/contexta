/**
 * Incremental parser for the input-polish response format:
 *
 *   <polished English>
 *   ---
 *   中文原文 | 英文 | 中文解释
 *   ~ 原英文 | 改后英文 | 中文解释
 *   + 新增内容 | 中文解释
 *
 * It is incremental for one reason: the polished text can be applied to the
 * input the instant the `---` line arrives, without waiting for the change
 * list. Perceived latency then tracks the length of the text itself rather
 * than the length of the whole response.
 *
 * Malformed change lines are dropped silently rather than throwing. The free
 * and small models this project targets drift on format often enough that a
 * strict parser would routinely cost the user the one thing they actually
 * asked for — the rewritten text.
 */

import type { ChangeKind, PolishChange } from './types'

export interface ParseEvent {
  /** Set exactly once, on the chunk that completes the polished text */
  bodyDone?: string
  changes: PolishChange[]
}

export interface PolishParser {
  push(chunk: string): ParseEvent
  /** Flush trailing state. Also the fallback path when no separator ever came. */
  finish(): ParseEvent
}

/** A separator line: three or more dashes, nothing else. */
const SEPARATOR = /^-{3,}$/

/** Bullet markers some models prepend to list items */
const BULLET = /^[-*]\s+/

/**
 * Does this line look like a change entry rather than prose?
 *
 * Models drop the `---` line often enough that the separator can't be the only
 * signal. Without this, a response that omits it but still lists its changes
 * would have the entire list pasted into the user's input box — the worst
 * possible outcome, and worse than showing nothing at all.
 *
 * Two pipes means three fields, which prose in this feature never has. One
 * pipe counts only behind a `~`/`+` marker, which prose never starts with.
 */
function looksLikeChangeLine(raw: string): boolean {
  const line = normalizePipes(raw).trim()
  if (!line) return false
  const pipes = (line.match(/\|/g) ?? []).length
  if (pipes >= 2) return true
  return pipes >= 1 && /^[~+]/.test(line)
}

/** Models occasionally emit the full-width pipe, especially mid-Chinese */
function normalizePipes(line: string): string {
  return line.replace(/｜/g, '|')
}

function stripQuotes(s: string): string {
  return s.replace(/^["'「『“”]+|["'」』“”]+$/g, '').trim()
}

function parseChangeLine(raw: string): PolishChange | null {
  let line = normalizePipes(raw).trim()
  if (!line) return null

  let kind: ChangeKind = 'new'
  if (/^~/.test(line)) {
    kind = 'fix'
    line = line.slice(1).trim()
  } else if (/^\+/.test(line)) {
    kind = 'add'
    line = line.slice(1).trim()
  } else {
    line = line.replace(BULLET, '')
  }

  const parts = line.split('|').map((p) => p.trim())
  if (kind === 'add') {
    const target = stripQuotes(parts[0] ?? '')
    if (!target) return null
    return { kind, source: '', target, reason: parts.slice(1).join(' | ').trim() }
  }

  const source = stripQuotes(parts[0] ?? '')
  const target = stripQuotes(parts[1] ?? '')
  if (!source || !target) return null
  // Reason may itself contain a pipe; keep everything after the second field
  return { kind, source, target, reason: parts.slice(2).join(' | ').trim() }
}

export function createPolishParser(): PolishParser {
  const bodyLines: string[] = []
  let buffer = ''
  let sawSeparator = false

  function consumeLine(line: string, out: ParseEvent) {
    if (sawSeparator) {
      const change = parseChangeLine(line)
      if (change) out.changes.push(change)
      return
    }
    if (SEPARATOR.test(line.trim())) {
      sawSeparator = true
      out.bodyDone = bodyLines.join('\n').trim()
      return
    }
    // Missing separator: the change list announces itself by its own shape
    if (looksLikeChangeLine(line)) {
      sawSeparator = true
      out.bodyDone = bodyLines.join('\n').trim()
      const change = parseChangeLine(line)
      if (change) out.changes.push(change)
      return
    }
    bodyLines.push(line)
  }

  return {
    push(chunk: string): ParseEvent {
      const out: ParseEvent = { changes: [] }
      buffer += chunk

      const segments = buffer.split('\n')
      // The last segment may be a partial line — hold it until more arrives
      buffer = segments.pop() ?? ''
      for (const line of segments) consumeLine(line, out)

      return out
    },

    finish(): ParseEvent {
      const out: ParseEvent = { changes: [] }
      if (buffer) {
        consumeLine(buffer, out)
        buffer = ''
      }
      // Nothing in the response looked like a change list either — it really
      // is all polished text. Losing explanations is bad; losing the rewrite
      // is worse.
      if (!sawSeparator) {
        sawSeparator = true
        out.bodyDone = bodyLines.join('\n').trim()
      }
      return out
    },
  }
}
