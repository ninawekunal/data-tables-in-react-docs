import { parseFrontmatter } from '@/lib/frontmatter'
import type { ContentEntry, ContentKind, QuizItem } from '@/lib/types'

const docFiles = import.meta.glob('/content/docs/*.md', { query: '?raw', import: 'default', eager: true })
const blogFiles = import.meta.glob('/content/blog/*.md', { query: '?raw', import: 'default', eager: true })

/** Pulls the ```quiz fenced block out of the prose and parses it. */
const extractQuiz = (body: string): { body: string; quiz: QuizItem[] } => {
  const match = body.match(/```quiz\r?\n([\s\S]*?)```/)

  if (!match) return { body, quiz: [] }

  let quiz: QuizItem[] = []

  try {
    const parsed: unknown = JSON.parse(match[1])

    if (Array.isArray(parsed)) quiz = parsed as QuizItem[]
  } catch {
    // A malformed quiz should not blank the doc. `pnpm check:content` catches it.
    quiz = []
  }

  return { body: body.replace(match[0], '').trim(), quiz }
}

const build = (
  files: Record<string, unknown>,
  kind: ContentKind,
): ContentEntry[] =>
  Object.entries(files)
    .map(([path, raw]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '')
      const { meta, body } = parseFrontmatter(String(raw))
      const extracted = extractQuiz(body)

      return { kind, slug, meta, body: extracted.body, quiz: extracted.quiz }
    })
    .filter((entry) => !entry.meta.draft)
    .sort((a, b) =>
      a.meta.part !== undefined && b.meta.part !== undefined
        ? a.meta.part - b.meta.part
        : b.meta.date.localeCompare(a.meta.date),
    )

export const docs = build(docFiles, 'doc')
export const posts = build(blogFiles, 'blog')

export const allTags = (entries: ContentEntry[]): string[] =>
  [...new Set(entries.flatMap((e) => e.meta.tags))].sort()

export const findEntry = (kind: ContentKind, slug: string): ContentEntry | undefined =>
  (kind === 'doc' ? docs : posts).find((e) => e.slug === slug)
