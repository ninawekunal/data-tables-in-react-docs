export type QuizItem = {
  q: string
  options: string[]
  /** 0-based index, or an array of indices for a select-all item. */
  answer: number | number[]
  multi?: boolean
  expl: string
}

export type ContentKind = 'doc' | 'blog'

export type Frontmatter = {
  title: string
  summary: string
  date: string
  tags: string[]
  minutes?: number
  /** Series position; docs with a part sort by it ascending. */
  part?: number
  draft?: boolean
}

export type Heading = { id: string; text: string; level: 2 | 3 }

export type ContentEntry = {
  kind: ContentKind
  slug: string
  meta: Frontmatter
  /** Prose markdown with the quiz block stripped out. */
  body: string
  quiz: QuizItem[]
}
