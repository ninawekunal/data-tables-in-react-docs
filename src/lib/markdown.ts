import { Marked } from 'marked'
import type { Tokens } from 'marked'
import type { Heading } from '@/lib/types'

const CALLOUTS = {
  TLDR: 'TL;DR',
  TERMS: 'Words you will meet',
  ANALOGY: 'Think of it like this',
  STEPS: 'Steps',
  NUANCE: 'Nuances',
  INTERVIEW: 'Interview must-know',
  GOTCHA: 'Gotcha',
  WIN: 'The win',
} as const

type CalloutKey = keyof typeof CALLOUTS

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)

/**
 * Lifts `> [!TLDR]` blockquote callouts out of the source so marked never
 * sees them, leaving a comment placeholder we substitute after rendering.
 */
const extractCallouts = (source: string): { source: string; blocks: string[] } => {
  const lines = source.split(/\r?\n/)
  const out: string[] = []
  const blocks: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i].match(/^>\s*\[!([A-Z]+)\]\s*$/)

    if (!open || !(open[1] in CALLOUTS)) {
      out.push(lines[i])
      continue
    }

    const key = open[1] as CalloutKey
    const inner: string[] = []
    let j = i + 1

    while (j < lines.length && /^>/.test(lines[j])) {
      inner.push(lines[j].replace(/^>\s?/, ''))
      j += 1
    }

    blocks.push(
      `<div class="callout callout-${key.toLowerCase()}">` +
        `<span class="callout-label">${CALLOUTS[key]}</span>` +
        renderInner(inner.join('\n')) +
        `</div>`,
    )
    out.push(`<!--CALLOUT:${blocks.length - 1}-->`)
    i = j - 1
  }

  return { source: out.join('\n'), blocks }
}

const plain = new Marked({ gfm: true, breaks: false })

const renderInner = (md: string): string => plain.parse(md, { async: false }) as string

export type Rendered = { html: string; headings: Heading[] }

export const renderMarkdown = (source: string): Rendered => {
  const headings: Heading[] = []
  const seen = new Set<string>()
  const extracted = extractCallouts(source)

  const marked = new Marked({ gfm: true, breaks: false })

  marked.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const text = this.parser.parseInline(token.tokens)
        const base = slugify(text) || `section-${headings.length + 1}`
        let id = base
        let n = 2

        while (seen.has(id)) {
          id = `${base}-${n}`
          n += 1
        }
        seen.add(id)

        if (token.depth === 2 || token.depth === 3) {
          headings.push({ id, text: text.replace(/<[^>]*>/g, ''), level: token.depth as 2 | 3 })
        }

        return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`
      },
    },
  })

  let html = marked.parse(extracted.source, { async: false }) as string

  html = html.replace(/<!--CALLOUT:(\d+)-->/g, (_m, i: string) => extracted.blocks[Number(i)] ?? '')
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')

  return { html, headings }
}
