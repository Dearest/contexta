// Per-site overrides for paragraph extraction. The generic pipeline (Defuddle →
// container → TreeWalker) assumes an article page; feeds like X are rows of
// UI chrome around short bodies, and the leaf-block fallback translates the
// chrome too (names, handles, timestamps, button labels, input placeholders).
export interface SiteRule {
  hosts: string[]
  /** Elements whose text is the content to translate — nothing else is touched. */
  paragraphSelector: string
}

const SITE_RULES: SiteRule[] = [
  {
    // data-testid is X's own test hook, far more stable than its hashed classes.
    // Long-form Articles render through Draft.js: one [data-block] per paragraph,
    // heading, list item or quote. <section> blocks hold embeds (images, quoted
    // tweets) — a quoted tweet's own tweetText is still picked up on its own.
    hosts: ['x.com', 'twitter.com'],
    paragraphSelector: [
      '[data-testid="tweetText"]',
      '[data-testid="twitter-article-title"]',
      '[data-testid="longformRichTextComponent"] [data-block]:not(section)',
    ].join(', '),
  },
]

export function getSiteRule(hostname: string): SiteRule | undefined {
  return SITE_RULES.find((rule) =>
    rule.hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`)),
  )
}
