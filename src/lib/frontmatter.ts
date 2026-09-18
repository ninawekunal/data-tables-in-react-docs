import type { Frontmatter } from '@/lib/types'

const stripQuotes = (v: string) => v.replace(/^['"]|['"]$/g, '').trim()

const parseValue = (raw: string): string | string[] | boolean | number => {
  const v = raw.trim()

  if (v.startsWith('[')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => stripQuotes(s))
      .filter(Boolean)
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)

  return stripQuotes(v)
}

/**
 * Minimal YAML front matter reader. Supports the flat `key: value` and
 * `key: [a, b]` shapes the authoring template uses - nothing nested.
 */
export const parseFrontmatter = (source: string): { meta: Frontmatter; body: string } => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)

  if (!match) {
    return { meta: { title: 'Untitled', summary: '', date: '', tags: [] }, body: source }
  }

  const fields: Record<string, unknown> = {}

  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)

    if (kv) fields[kv[1]] = parseValue(kv[2])
  }

  const meta: Frontmatter = {
    title: String(fields.title ?? 'Untitled'),
    summary: String(fields.summary ?? ''),
    date: String(fields.date ?? ''),
    tags: Array.isArray(fields.tags) ? (fields.tags as string[]) : [],
    minutes: typeof fields.minutes === 'number' ? fields.minutes : undefined,
    draft: fields.draft === true,
    part: typeof fields.part === 'number' ? fields.part : undefined,
    series: typeof fields.series === 'string' ? fields.series : undefined,
  }

  return { meta, body: source.slice(match[0].length) }
}
