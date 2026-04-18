interface UserPromptParams {
  title: string
  current: string
  prev?: string
  next?: string
}

export function buildSystemPrompt(targetLang: string, presetRules: string): string {
  return `你是一位精通${targetLang}的专业翻译。翻译<source>标签内的文本为${targetLang}，仅输出译文。

规则：
- 技术术语、产品名、公司名保留英文原文
- 代码、变量名、命令、URL 不翻译
- 英文术语与中文之间加半角空格
- 仅输出译文，不要输出XML标签、解释或附加内容
- 【严格】文本中形如 <a1>...</a1>、<em1>...</em1> 的编号标签是结构占位符，必须原样保留在译文中。只翻译标签内外的文字，不得删除、修改、合并或新增任何占位符标签。占位符数量和嵌套关系必须与原文完全一致。
${presetRules ? '\n' + presetRules : ''}
<context>标签内是上下文，仅供参考，不要翻译。
策略：先直译确保完整，再意译使表达自然流畅。仅输出最终意译结果。`
}

export function buildUserPrompt(params: UserPromptParams): string {
  const parts: string[] = []

  if (params.prev || params.next) {
    parts.push('<context>')
    if (params.prev) parts.push(`前文：${params.prev}`)
    if (params.next) parts.push(`后文：${params.next}`)
    parts.push('</context>')
    parts.push('')
  }

  parts.push(`<source>${params.current}</source>`)

  return parts.join('\n')
}

export function buildSummaryPrompt(translatedContent: string): string {
  return `请为以下文章生成一段简洁的摘要（3-5句话），概括文章的核心观点和主要内容。仅输出摘要文本，不要加标题或前缀。\n\n${translatedContent}`
}

export function buildQuotesPrompt(translatedContent: string): string {
  return `请从以下文章中提取 3-5 条最精彩、最有洞察力的金句。每条金句单独一行，以"- "开头。仅输出金句列表，不要加标题或其他内容。\n\n${translatedContent}`
}
