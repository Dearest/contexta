import { describe, it, expect } from 'vitest'
import { createPolishParser } from '../lib/polish-parse'

/** Feed a whole response through in one go */
function parseAll(response: string) {
  const parser = createPolishParser()
  const first = parser.push(response)
  const last = parser.finish()
  return {
    body: first.bodyDone ?? last.bodyDone,
    changes: [...first.changes, ...last.changes],
  }
}

describe('polish response parsing', () => {
  it('splits the polished text from the change list', () => {
    const { body, changes } = parseAll(
      [
        'I want to ensure this feature works properly before we ship',
        '---',
        '确保 | ensure | 语气比 make sure 更确定',
        '~ can work | works | 去掉多余情态动词',
      ].join('\n'),
    )

    expect(body).toBe('I want to ensure this feature works properly before we ship')
    expect(changes).toEqual([
      { kind: 'new', source: '确保', target: 'ensure', reason: '语气比 make sure 更确定' },
      { kind: 'fix', source: 'can work', target: 'works', reason: '去掉多余情态动词' },
    ])
  })

  it('emits the body as soon as the separator arrives, before the changes', () => {
    const parser = createPolishParser()

    expect(parser.push('Hello ').bodyDone).toBeUndefined()
    expect(parser.push('world\n').bodyDone).toBeUndefined()

    const atSeparator = parser.push('---\n')
    expect(atSeparator.bodyDone).toBe('Hello world')
    expect(atSeparator.changes).toEqual([])

    const later = parser.push('你好 | Hello | 问候语\n')
    expect(later.bodyDone).toBeUndefined()
    expect(later.changes).toHaveLength(1)
  })

  it('reassembles lines split across chunk boundaries', () => {
    const parser = createPolishParser()
    parser.push('polished text\n---\n确保 | ens')
    const rest = parser.push('ure | 更正式\n')

    expect(rest.changes).toEqual([
      { kind: 'new', source: '确保', target: 'ensure', reason: '更正式' },
    ])
  })

  it('treats the whole response as body when no separator ever comes', () => {
    // Small models drop the separator often enough that losing the rewrite
    // here would make the feature unusable on them
    const { body, changes } = parseAll('Just the polished sentence.')

    expect(body).toBe('Just the polished sentence.')
    expect(changes).toEqual([])
  })

  it('finds the change list even when the model forgets the separator', () => {
    // Verbatim from a real X compose box: the model produced a well-formed
    // change list but no `---`. Treating it all as body pasted the
    // explanations straight into the user's tweet.
    const { body, changes } = parseAll(
      [
        'I want to learn psychology',
        '',
        '学习心理学 | learn psychology | 将中文词"心理学"翻译为英文"psychology"',
        '~ I want learn | I want to learn | 补充不定式to，符合英语语法要求',
      ].join('\n'),
    )

    expect(body).toBe('I want to learn psychology')
    expect(changes).toEqual([
      {
        kind: 'new',
        source: '学习心理学',
        target: 'learn psychology',
        reason: '将中文词"心理学"翻译为英文"psychology"',
      },
      {
        kind: 'fix',
        source: 'I want learn',
        target: 'I want to learn',
        reason: '补充不定式to，符合英语语法要求',
      },
    ])
  })

  it('applies the body at the implicit boundary, mid-stream', () => {
    const parser = createPolishParser()
    parser.push('I want to learn psychology\n\n')
    const atFirstChange = parser.push('学习心理学 | learn psychology | 理由\n')

    expect(atFirstChange.bodyDone).toBe('I want to learn psychology')
    expect(atFirstChange.changes).toHaveLength(1)
  })

  it('does not mistake ordinary prose for a change line', () => {
    const { body, changes } = parseAll(
      'Ship it before Friday — the API returns a | delimited list.',
    )

    expect(body).toBe('Ship it before Friday — the API returns a | delimited list.')
    expect(changes).toEqual([])
  })

  it('recognises additions, which carry no source text', () => {
    const { changes } = parseAll('text\n---\n+ properly | 补充副词，明确「正常工作」的含义')

    expect(changes).toEqual([
      { kind: 'add', source: '', target: 'properly', reason: '补充副词，明确「正常工作」的含义' },
    ])
  })

  it('accepts the full-width pipe some models emit mid-Chinese', () => {
    const { changes } = parseAll('text\n---\n确保 ｜ ensure ｜ 更正式')

    expect(changes).toEqual([
      { kind: 'new', source: '确保', target: 'ensure', reason: '更正式' },
    ])
  })

  it('strips bullet markers and quotes the model adds on its own', () => {
    const { changes } = parseAll('text\n---\n- "确保" | "ensure" | 更正式')

    expect(changes[0]).toMatchObject({ kind: 'new', source: '确保', target: 'ensure' })
  })

  it('keeps pipes that belong to the reason', () => {
    const { changes } = parseAll('text\n---\n确保 | ensure | 对比 make sure | guarantee 更自然')

    expect(changes[0].reason).toBe('对比 make sure | guarantee 更自然')
  })

  it('drops malformed lines instead of failing the whole response', () => {
    const { body, changes } = parseAll(
      ['polished', '---', 'this line has no pipes at all', '   ', '确保 | ensure | 更正式'].join('\n'),
    )

    expect(body).toBe('polished')
    expect(changes).toHaveLength(1)
    expect(changes[0].target).toBe('ensure')
  })

  it('handles an empty change list after the separator', () => {
    const { body, changes } = parseAll('Already good English.\n---\n')

    expect(body).toBe('Already good English.')
    expect(changes).toEqual([])
  })

  it('preserves multi-line body structure', () => {
    const { body } = parseAll('First line.\n\nSecond line.\n---\n确保 | ensure | 更正式')

    expect(body).toBe('First line.\n\nSecond line.')
  })
})
