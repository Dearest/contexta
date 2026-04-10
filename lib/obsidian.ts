import type { ArticleMetadata, ObsidianConfig } from './types'

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
): Promise<void> {
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
}
