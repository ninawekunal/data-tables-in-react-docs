---
title: About the series
summary: What the seven parts cover, how each doc is structured, and where the format comes from.
date: 2026-09-17
tags: [about]
---

## What this is

> [!TLDR]
> Seven learning docs on building data tables in React with TanStack Table v8 and
> shadcn/ui, each ending with a graded, scenario-based quiz.

The examples all use **Meridian**, a fictional portfolio analytics app. The
production lessons are real, drawn from building a shared table system that backs
dozens of tables, and translated out of their original domain.

| Part | Topic |
| --- | --- |
| 1 | Sort, filter, paginate - plain state for interviews, then TanStack |
| 2 | Server-driven tables behind a BFF: route triple, per-user cache, zod contract |
| 3 | Virtualization, and when a render cap wins instead |
| 4 | Row selection from one page to cross-page bulk actions |
| 5 | Cell design: when to group fields, when to standardize |
| 6 | Row click UX: expando, drawer, detail page or master-detail |
| 7 | Column header filters with one typed filter object |

## How to read a doc

> [!STEPS]
> 1. **Skim the TL;DR boxes first.** Each section opens with one or two sentences.
> 2. **Read the Steps and Nuances** for the section you care about.
> 3. **Use Interview must-know bullets** as self-test prompts.
> 4. **Take the quiz without scrolling back.** Retrieval is the point; a missed question with its explanation teaches more than a reread.

> [!NUANCE]
> - The quiz questions are fresh scenarios, not sentences from the doc. A skimmer
>   scores around 60 percent; someone who understood scores above 90.
> - The reading controls in the header - bionic reading, width and theme - persist per browser.
> - On a phone, the table of contents collapses into the sticky bar under the header.

## How the docs are built

The format and the React app come from
[learning-doc-builder](https://github.com/ninawekunal/learning-doc-builder), a
Claude skill plus renderer for ADHD-friendly learning docs. Each part here is a
single markdown file with a fenced quiz block; the app handles everything visual.
