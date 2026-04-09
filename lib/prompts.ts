interface UserPromptParams {
  title: string
  current: string
  prev?: string
  next?: string
}

export function buildSystemPrompt(targetLang: string, presetRules: string): string {
  return `你是一位精通${targetLang}的专业翻译。

翻译规则：
- 技术术语、产品名、公司名保留英文原文（如 Transformer、OpenAI、Token）
- 代码、变量名、命令、URL 不翻译
- 全角括号换成半角括号，半角括号前后各加一个半角空格
- 英文术语与中文之间加一个半角空格
- 保留原始 Markdown 格式
- 仅输出译文，不要解释或附加内容
${presetRules ? '\n' + presetRules : ''}
策略：先直译，确保信息完整；再基于直译结果意译，使表达自然流畅，符合${targetLang}表达习惯。仅输出最终意译结果。`
}

export function buildUserPrompt(params: UserPromptParams): string {
  const parts: string[] = []
  parts.push(`[文章标题] ${params.title}`)
  if (params.prev) {
    parts.push('')
    parts.push('[上文（仅供参考，不翻译）]')
    parts.push(params.prev)
  }
  parts.push('')
  parts.push('[请翻译以下段落]')
  parts.push(params.current)
  if (params.next) {
    parts.push('')
    parts.push('[下文（仅供参考，不翻译）]')
    parts.push(params.next)
  }
  return parts.join('\n')
}

export function buildSummaryPrompt(translatedContent: string): string {
  return `请为以下文章生成一段简洁的摘要（3-5句话），概括文章的核心观点和主要内容。仅输出摘要文本，不要加标题或前缀。\n\n${translatedContent}`
}

export function buildQuotesPrompt(translatedContent: string): string {
  return `请从以下文章中提取 3-5 条最精彩、最有洞察力的金句。每条金句单独一行，以"- "开头。仅输出金句列表，不要加标题或其他内容。\n\n${translatedContent}`
}
