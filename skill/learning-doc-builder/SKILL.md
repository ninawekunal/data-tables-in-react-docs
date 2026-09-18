---
name: learning-doc-builder
description: >-
  Write one ADHD-friendly interactive learning doc as a markdown file with a
  graded active-recall quiz appended, for the learning-doc-builder React app.
  Six to nine short sections, each with TL;DR / Steps / Nuances / Interview
  buckets, at most one real code snippet per section, an optional inline SVG
  diagram, a cheat-sheet table, and a 12-15 question scenario quiz with 2-3
  select-all items and an explanation on every answer. Use whenever the user
  wants a learning doc, explainer, reading guide, onboarding doc, study guide,
  or an "explain X" deliverable in this format / the same format / like those
  docs / in that style, or asks for a doc with a quiz, even without saying
  "skill". Triggers: "make a learning doc about X", "explain how X works as a
  reading guide", "build an onboarding explainer for X", "a guide for X with a
  quiz", "another one of those docs for X", "write a blog post in the doc
  format". Grounds in the local repo when the topic is a codebase.
---

# Learning doc builder

Produce ONE markdown file that teaches a technical topic in a format built for
a reader with a short attention span, then validate it.

Output path:

- a learning doc -> `content/docs/<kebab-slug>.md`
- a blog post -> `content/blog/<kebab-slug>.md` (quiz optional)

You write markdown only. Never write HTML, CSS, or a standalone page. The app
owns every visual decision, so a format change is one stylesheet, not 40 files.

## Golden rule: research first, template last

A beautiful shell around wrong facts is worse than no doc. Gather the substance
before you open the template. Never invent a file path, a PR number, a metric,
or a citation. If something is unverified, write "unverified" in the doc.

## Workflow

1. **Lock the scope.** Ask at most one question, and only if the answer changes
   the doc: depth, angle, or audience. Never ask about trivia.

2. **Ground it.**
   - Codebase topic: read the real code (Grep/Glob/Read, or an exploration
     subagent). Collect real file paths, real hook and function names, and
     short real snippets. Tag what exists versus what is planned.
   - General topic: work from knowledge or the web. Attribute claims to the
     study or spec they come from, and keep numbers you can defend.
   - Write down the misconception list as you go. You need it for distractors.

3. **Write the doc.** Follow `references/authoring-guide.md` exactly. Start from
   `assets/doc-template.md`.

4. **Write the quiz.** Read `references/quiz-rubric.md` first. This is where
   most docs fail: scenario questions in fresh situations, never a sentence
   lifted from the prose.

5. **Validate.** Run `pnpm check:content`. It fails on malformed quiz JSON, a
   missing front matter field, an answer index out of range, a duplicate slug,
   and an em dash. Fix and rerun until clean. Report the result.

6. **Look at it.** Run `pnpm dev` and open the doc. Check the mobile dropdown at
   375px wide and the dark theme before you call it done.

## Hard rules

- No em dashes anywhere. Use a plain hyphen or a colon.
- Front matter needs `title`, `summary`, `date`, `tags`. `minutes` is optional.
- Exactly one `## ` heading per section, 6 to 9 sections. Section one is always
  the big picture and leads with a table or a diagram, never a prose wall.
- At most one code snippet per section, 5 to 15 lines, with a source line under
  it when the code is real.
- Exactly one `> [!GOTCHA]` per doc. Spend it on the trap that costs real hours.
- The quiz block is the last thing in the file and must parse as JSON.
- Every quiz item needs `expl`. No exceptions.

## Reference files

- `references/authoring-guide.md` - the section shape, callouts, diagrams, tables
- `references/quiz-rubric.md` - how to write questions that measure anything
- `assets/doc-template.md` - the skeleton to copy
