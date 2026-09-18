#!/usr/bin/env node
/**
 * Validates every content file before it ships: front matter, quiz JSON,
 * answer ranges, and the house style rules the renderer cannot enforce.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIRS = ['content/docs', 'content/blog']
const REQUIRED = ['title', 'summary', 'date', 'tags']

const problems = []
const warnings = []
const slugs = new Map()

const fail = (file, message) => problems.push(`${file}: ${message}`)
const warn = (file, message) => warnings.push(`${file}: ${message}`)

const readFrontmatter = (source) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)

  if (!match) return null

  const fields = {}

  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)

    if (kv) fields[kv[1]] = kv[2].trim()
  }

  return fields
}

const checkQuiz = (file, source, isDoc) => {
  const match = source.match(/```quiz\r?\n([\s\S]*?)```/)

  if (!match) {
    if (isDoc) warn(file, 'no quiz block (docs should normally have one)')

    return
  }

  let quiz

  try {
    quiz = JSON.parse(match[1])
  } catch (error) {
    fail(file, `quiz block is not valid JSON: ${error.message}`)

    return
  }

  if (!Array.isArray(quiz)) {
    fail(file, 'quiz block must be a JSON array')

    return
  }

  if (isDoc && (quiz.length < 12 || quiz.length > 15)) {
    warn(file, `${quiz.length} questions (the rubric asks for 12 to 15)`)
  }

  let multis = 0
  const indexCounts = [0, 0, 0, 0]

  quiz.forEach((item, i) => {
    const at = `${file} q${i + 1}`

    if (typeof item.q !== 'string' || item.q.length === 0) fail(at, 'missing q')
    if (!Array.isArray(item.options) || item.options.length !== 4) fail(at, 'needs exactly 4 options')
    if (typeof item.expl !== 'string' || item.expl.length === 0) fail(at, 'missing expl')

    const answers = Array.isArray(item.answer) ? item.answer : [item.answer]

    if (answers.length === 0) fail(at, 'missing answer')

    for (const a of answers) {
      if (!Number.isInteger(a) || a < 0 || a > 3) fail(at, `answer index ${a} out of range`)
    }

    if (Array.isArray(item.answer)) {
      multis += 1
      if (item.multi !== true) warn(at, 'array answer should set "multi": true')
    } else {
      indexCounts[item.answer] += 1
    }

    const lengths = (item.options ?? []).map((o) => String(o).split(/\s+/).length)
    const longest = Math.max(...lengths)

    if (!Array.isArray(item.answer) && lengths[item.answer] === longest && longest > Math.min(...lengths) + 3) {
      warn(at, 'correct option is the longest by more than 3 words')
    }
  })

  if (isDoc && multis < 2) warn(file, `${multis} select-all items (the rubric asks for 2 to 3)`)
  if (isDoc && indexCounts.some((n) => n === 0) && quiz.length >= 12) {
    warn(file, `correct-answer indices are clustered: ${indexCounts.join('/')}`)
  }
}

for (const dir of DIRS) {
  let files = []

  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    continue
  }

  for (const name of files) {
    const file = join(dir, name)
    const source = readFileSync(file, 'utf8')
    const slug = name.replace(/\.md$/, '')

    if (slugs.has(slug)) fail(file, `duplicate slug, also in ${slugs.get(slug)}`)
    slugs.set(slug, file)

    const meta = readFrontmatter(source)

    if (!meta) {
      fail(file, 'missing front matter')
      continue
    }

    for (const key of REQUIRED) {
      if (!meta[key]) fail(file, `front matter is missing "${key}"`)
    }

    if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) fail(file, 'date must be YYYY-MM-DD')

    const body = source.slice(source.indexOf('---', 3) + 3)
    const sections = body.match(/^## .+$/gm) ?? []

    if (dir === 'content/docs' && (sections.length < 4 || sections.length > 12)) {
      warn(file, `${sections.length} sections (aim for 6 to 9)`)
    }

    const gotchas = (body.match(/> \[!GOTCHA\]/g) ?? []).length

    if (gotchas > 1) warn(file, `${gotchas} gotcha callouts (spend it once)`)

    const badCallout = body.match(/> \[!([A-Z]+)\]/g)?.find(
      (m) => !['TLDR', 'STEPS', 'NUANCE', 'INTERVIEW', 'GOTCHA', 'WIN'].includes(m.slice(4, -1)),
    )

    if (badCallout) fail(file, `unknown callout ${badCallout}`)

    if (source.includes('—')) fail(file, 'contains an em dash')

    checkQuiz(file, source, dir === 'content/docs')
  }
}

for (const line of warnings) console.warn(`warn  ${line}`)
for (const line of problems) console.error(`ERROR ${line}`)

console.log(
  `\nchecked ${slugs.size} file(s): ${problems.length} error(s), ${warnings.length} warning(s)`,
)

process.exit(problems.length > 0 ? 1 : 0)
