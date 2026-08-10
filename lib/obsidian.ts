import type { ArticleMetadata, ChangeKind, GapEntry, ObsidianConfig, TestResult } from './types'

/**
 * Verify the Local REST API is reachable and the token is accepted.
 * The root endpoint returns `{ status, versions, authenticated }`.
 */
export async function testObsidian(config: ObsidianConfig): Promise<TestResult> {
  const base = config.apiUrl.replace(/\/$/, '')
  if (!base) return { ok: false, error: '请先填写 REST API 地址' }
  if (!config.apiToken.trim()) return { ok: false, error: '请先填写 API Token' }

  let response: Response
  try {
    response = await fetch(`${base}/`, {
      headers: { Authorization: `Bearer ${config.apiToken}` },
    })
  } catch {
    return {
      ok: false,
      error: base.startsWith('https')
        ? '无法连接。HTTPS 端口使用自签证书，需先在浏览器中访问该地址并信任证书，或改用 http://127.0.0.1:27123'
        : '无法连接，请确认 Obsidian 已启动且 Local REST API 插件已开启',
    }
  }

  if (response.status === 401) return { ok: false, error: 'API Token 无效' }
  if (!response.ok) return { ok: false, error: `${response.status} ${response.statusText}` }

  const data = await response.json().catch(() => null)
  if (data && data.authenticated === false) {
    return { ok: false, error: 'API Token 无效' }
  }
  return { ok: true, detail: data?.service ? `已连接 ${data.service}` : '连接正常' }
}

export function buildFrontmatterAndCallouts(
  metadata: ArticleMetadata,
  summary?: string,
  quotes?: string,
): string {
  const parts: string[] = []

  parts.push('---')
  parts.push(`title: "${metadata.title}"`)
  if (metadata.author) parts.push(`author: "${metadata.author}"`)
  parts.push(`source: "${metadata.url}"`)
  if (metadata.published) parts.push(`date: ${metadata.published}`)
  parts.push('translated: true')
  parts.push('---')
  parts.push('')

  if (summary) {
    parts.push('> [!abstract] 摘要')
    for (const line of summary.split('\n')) {
      parts.push(`> ${line}`)
    }
    parts.push('')
  }

  if (quotes) {
    parts.push('> [!quote] 金句')
    for (const line of quotes.split('\n')) {
      parts.push(`> ${line}`)
    }
    parts.push('')
  }

  if (summary || quotes) {
    parts.push('---')
    parts.push('')
  }

  return parts.join('\n')
}

export async function exportToObsidian(
  config: ObsidianConfig,
  title: string,
  markdown: string,
): Promise<string> {
  const safeName = title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100)
  const path = `${config.vaultPath.replace(/\/$/, '')}/${safeName}.md`

  const url = `${config.apiUrl.replace(/\/$/, '')}/vault/${encodeURIComponent(path)}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'text/markdown',
    },
    body: markdown,
  })

  if (!response.ok) {
    throw new Error(`Obsidian API error: ${response.status} ${response.statusText}`)
  }

  return path
}

const KIND_LABEL: Record<ChangeKind, string> = {
  new: '新词',
  fix: '修正',
  add: '补充',
}

/** Fields are pipe-delimited, so a pipe inside one would break every parser downstream */
function escapeField(s: string): string {
  return s.replace(/[|\n]/g, ' ').trim()
}

export function formatGapEntries(entries: GapEntry[]): string {
  return entries
    .map((e) =>
      [
        '-',
        e.date,
        '|',
        KIND_LABEL[e.kind],
        '|',
        escapeField(e.source) || '—',
        '|',
        escapeField(e.target),
        '|',
        escapeField(e.reason),
        '|',
        escapeField(e.host),
      ].join(' '),
    )
    .join('\n')
}

/**
 * Append expression gaps to a single running note.
 *
 * POST, not PUT: the Local REST API treats POST as append-and-create, while
 * PUT (used for article export) overwrites. One append-only file keeps the log
 * greppable and diffable — its value is aggregate statistics over months, not
 * re-reading individual lines, which is why it isn't split into notes.
 */
export async function appendGapEntries(
  config: ObsidianConfig,
  notePath: string,
  entries: GapEntry[],
): Promise<void> {
  if (!entries.length) return

  const path = notePath.replace(/^\//, '')
  const url = `${config.apiUrl.replace(/\/$/, '')}/vault/${encodeURIComponent(path)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'text/markdown',
    },
    body: `\n${formatGapEntries(entries)}`,
  })

  if (!response.ok) {
    throw new Error(`Obsidian API error: ${response.status} ${response.statusText}`)
  }
}

export async function openInObsidian(
  config: ObsidianConfig,
  filePath: string,
): Promise<void> {
  const url = `${config.apiUrl.replace(/\/$/, '')}/open/${encodeURIComponent(filePath)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Obsidian API error: ${response.status} ${response.statusText}`)
  }
}
