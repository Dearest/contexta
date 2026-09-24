import { describe, it, expect } from 'vitest'
import { getSiteRule } from '../lib/site-rules'
import { extractParagraphs } from '../lib/extractor'

describe('getSiteRule', () => {
  it('matches x.com, twitter.com and subdomains', () => {
    expect(getSiteRule('x.com')).toBeDefined()
    expect(getSiteRule('twitter.com')).toBeDefined()
    expect(getSiteRule('mobile.twitter.com')).toBeDefined()
  })

  it('does not match lookalike hosts', () => {
    expect(getSiteRule('notx.com')).toBeUndefined()
    expect(getSiteRule('example.com')).toBeUndefined()
  })
})

describe('extractParagraphs with X site rule', () => {
  const selector = getSiteRule('x.com')!.paragraphSelector

  function tweet(name: string, handle: string, body: string) {
    return `
      <article>
        <div data-testid="User-Name"><a href="/${handle}"><span>${name}</span></a><a href="/${handle}"><span>@${handle}</span></a></div>
        <time>17h</time>
        <div data-testid="tweetText" lang="en"><span>${body}</span></div>
        <div role="group"><span>575</span><span>Relevant</span></div>
      </article>`
  }

  it('extracts only tweet bodies, not names, handles or UI labels', () => {
    document.body.innerHTML = `
      <main>
        ${tweet('Dan Ellison', 'danellisona', 'X is full of founders')}
        ${tweet('Jayant Jagtap', 'IsagiYoich82851', 'What if founders are my customers')}
        <div contenteditable="true"><div>Post your reply</div></div>
      </main>`

    const paragraphs = extractParagraphs(document.body, selector)
    expect(paragraphs.map((p) => p.plainText)).toEqual([
      'X is full of founders',
      'What if founders are my customers',
    ])
  })

  it('skips injected translations on re-extraction', () => {
    document.body.innerHTML = `
      <div data-testid="tweetText"><span>Hello there</span></div>
      <div data-contexta="translation"><div data-testid="tweetText">你好</div></div>`

    expect(extractParagraphs(document.body, selector)).toHaveLength(1)
  })

  it('skips blocks already extracted, so feed pages only get new ones', () => {
    document.body.innerHTML = `<div data-testid="tweetText"><span>First tweet</span></div>`
    expect(extractParagraphs(document.body, selector)).toHaveLength(1)

    document.body.insertAdjacentHTML('beforeend', `<div data-testid="tweetText"><span>Scrolled in later</span></div>`)
    expect(extractParagraphs(document.body, selector).map((p) => p.plainText)).toEqual(['Scrolled in later'])
  })

  it('extracts long-form Article title and Draft.js blocks, not embeds', () => {
    // Trimmed from a real x.com Article page
    document.body.innerHTML = `
      <div data-testid="twitterArticleReadView">
        <div data-testid="twitter-article-title"><span>Where are the customers?</span></div>
        <div data-testid="longformRichTextComponent" class="public-DraftEditor-content">
          <div data-contents="true">
            <div class="longform-unstyled" data-block="true"><div class="public-DraftStyleDefault-block"><span><span>First paragraph.</span></span></div></div>
            <h2 class="longform-header-two" data-block="true"><div><span><span>A heading</span></span></div></h2>
            <section data-block="true">
              <div data-testid="simpleTweet"><article data-testid="tweet">
                <div data-testid="User-Name"><span>Someone</span></div>
                <div data-testid="tweetText"><span>Quoted tweet body</span></div>
              </article></div>
            </section>
            <section data-block="true"><div data-testid="tweetPhoto"><img alt="Image"></div></section>
            <pre class="public-DraftStyleDefault-pre"><div data-block="true"><span>const x = 1</span></div></pre>
            <blockquote class="longform-blockquote" data-block="true"><div><span><span>A quote</span></span></div></blockquote>
          </div>
        </div>
      </div>`

    expect(extractParagraphs(document.body, selector).map((p) => p.plainText)).toEqual([
      'Where are the customers?',
      'First paragraph.',
      'A heading',
      'Quoted tweet body',
      'A quote',
    ])
  })
})
