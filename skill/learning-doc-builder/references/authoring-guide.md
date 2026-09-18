# Authoring guide

Read this fully before writing. The reader reads fast, skips prose walls, and
loses the thread if a section runs long. Structure is not decoration here; it is
the thing that makes the doc usable.

## Front matter

```yaml
---
title: Sentence case, under 60 characters
summary: One line that tells someone whether to read this.
date: YYYY-MM-DD
tags: [three, or, four]
minutes: 12
---
```

Flat keys only. Arrays use `[a, b]`. Nothing nested - the parser is deliberately
small.

## Sections

Six to nine `## ` sections. Each one stays under roughly 120 lines of markdown.

Section one is **The big picture** and opens with a table or an inline SVG. Never
open a doc with three paragraphs.

Every other section uses these buckets, in this order, and only the ones that
carry real content:

```markdown
> [!TLDR]
> One or two sentences. Never three.

Prose, a snippet, or a table.

> [!STEPS]
> 1. **Do the thing.** One sentence on why.
> 2. **Then this.** One sentence on why.

> [!NUANCE]
> - A tradeoff, an edge case, or an option that was rejected and why.
> - Three to six bullets.

> [!INTERVIEW]
> - *The question someone will ask.* The one-line answer.
```

Plus, once per doc each:

```markdown
> [!GOTCHA]
> The single trap that costs people hours. Spend this once.

> [!WIN]
> The measured outcome, or the structural payoff.
```

## Code

At most one snippet per section, 5 to 15 lines. Use a language tag. If the code
is real, follow it with a source line:

```markdown
Source: `app/features/worklist/bff/compute.ts`
```

Never paste a snippet you have not read. Never invent a path.

## Diagrams

Inline SVG, not an image. Use a `viewBox`, give it `role="img"` and an
`aria-label`, and use the CSS variables so it works in both themes:

```html
<svg viewBox="0 0 720 200" role="img" aria-label="What the diagram shows">
  <rect x="10" y="40" width="200" height="90" rx="12" fill="none"
        stroke="var(--primary)" stroke-width="2"/>
  <text x="110" y="70" text-anchor="middle" font-size="15"
        fill="var(--text)">Label</text>
</svg>
```

Available tokens: `--primary`, `--accent`, `--ok`, `--warn`, `--info`, `--text`,
`--text-muted`, `--border`. Never hardcode a hex - it will be unreadable in one
of the two themes.

Keep it to boxes, arrows and labels. A diagram that needs a legend is too busy.

## Tables

Use a table wherever a comparison would otherwise become three paragraphs. The
app wraps tables for horizontal scroll on mobile automatically.

A good closing section is a cheat sheet: 8 to 14 rows of
`thing | where it lives | the one-line rule`.

## Voice

Short sentences. Second person. Concrete nouns. No filler, no "in this section
we will", no closing summary that repeats the TL;DR.

No em dashes. A plain hyphen or a colon does the job.
