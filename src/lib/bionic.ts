const SKIP = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'KBD', 'SAMP'])

// SVG cannot hold an HTML span, so diagrams are left exactly as authored.
const SKIP_SUBTREE = 'pre, code, svg, kbd, samp'

/** Bolds the leading fixation half of a word. Short words get one letter. */
const fixationLength = (word: string): number => {
  if (word.length <= 1) return word.length
  if (word.length <= 3) return 1
  if (word.length <= 6) return 2
  if (word.length <= 9) return 3

  return Math.ceil(word.length * 0.4)
}

const markWord = (word: string): string => {
  const head = word.slice(0, fixationLength(word))
  const tail = word.slice(fixationLength(word))

  return `<b class="fx">${head}</b>${tail}`
}

/**
 * Rewrites an HTML string so every readable word carries a bold fixation
 * prefix. Code, pre and inline markup are left untouched. Runs in the browser
 * only - it needs DOMParser.
 */
export const applyBionic = (html: string): string => {
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const parent = node.parentElement

    if (!parent || SKIP.has(parent.tagName)) continue
    if (parent.closest(SKIP_SUBTREE)) continue
    if (!node.nodeValue?.trim()) continue

    targets.push(node)
  }

  for (const node of targets) {
    const replaced = node.nodeValue!.replace(/[\p{L}\p{N}'’-]+/gu, markWord)
    const span = doc.createElement('span')

    span.innerHTML = replaced
    node.replaceWith(span)
  }

  return doc.body.innerHTML
}
