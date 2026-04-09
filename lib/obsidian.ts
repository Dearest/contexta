import type { ExtractedArticle, ExportFormat, ObsidianConfig } from './types'

interface BuildMarkdownOptions {
  article: ExtractedArticle
  translations: Map<string, string>
  format: ExportFormat
  summary?: string
  quotes?: string
}

export function buildObsidianMarkdown(options: BuildMarkdownOptions): string {
  const { article, translations, format, summary, quotes } = options
  const { metadata, paragraphs } = article
  const parts: string[] = []

  // Frontmatter
  parts.push('---')
  parts.push(`title: "${metadata.title}"`)
  if (metadata.author) parts.push(`author: "${metadata.author}"`)
  parts.push(`source: "${metadata.url}"`)
  if (metadata.published) parts.push(`date: ${metadata.published}`)
  parts.push('translated: true')
  parts.push('---')
  parts.push('')

  // Summary callout
  if (summary) {
    parts.push('> [!abstract] 摘要')
    for (const line of summary.split('\n')) {
      parts.push(`> ${line}`)
    }
    parts.push('')
  }

  // Quotes callout
  if (quotes) {
    parts.push('> [!quote] 金句')
    for (const line of quotes.split('\n')) {
      parts.push(`> ${line}`)
    }
    parts.push('')
  }

  // Separator if callouts exist
  if (summary || quotes) {
    parts.push('---')
    parts.push('')
  }

  // Content
  for (const paragraph of paragraphs) {
    const translation = translations.get(paragraph.id)

    switch (format) {
      case 'target-only':
        if (translation) parts.push(translation)
        break
      case 'source-only':
        parts.push(paragraph.text)
        break
      case 'bilingual':
        parts.push(paragraph.text)
        parts.push('')
        if (translation) parts.push(translation)
        break
    }
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
