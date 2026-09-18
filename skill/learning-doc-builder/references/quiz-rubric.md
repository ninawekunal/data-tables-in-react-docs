# Quiz rubric

The quiz is the part of the doc that measures anything. A doc with a bad quiz is
worse than a doc with none, because it hands the reader false confidence.

## Shape

- 12 to 15 items. Default to 15 for a substantial doc.
- 2 to 3 select-all items: `"multi": true` with `answer` as an array of 2 or 3
  indices.
- 4 options each.
- The block goes at the very end of the file:

````markdown
```quiz
[
  {
    "q": "...",
    "options": ["...", "...", "...", "..."],
    "answer": 2,
    "expl": "..."
  }
]
```
````

## The questions

**Never lift a sentence from the doc.** If the reader can answer by recognising
phrasing, you tested reading.

Every question sets a fresh scenario. Pick from:

- a bug to diagnose from a symptom
- a design choice between two defensible options
- a teammate's proposal to push back on
- "what breaks if..."
- a number or a profile result to interpret

## The options

- All four within about three words of each other in length. The correct option
  must not be the longest or the shortest.
- Every distractor is a real misconception - something a competent person
  actually believes - or a true statement that does not answer *this* question,
  or the right mechanism attributed to the wrong cause.
- Never "all of the above", never "none of the above".
- Spread the correct index across 0, 1, 2 and 3 roughly evenly. Never cluster.

## The explanation

Two or three sentences. Say why the right answer is right **and** why the most
tempting wrong one is wrong. The second half is the part that teaches.

## Calibration

Target: a reader who skimmed scores around 60 percent; a reader who understood
scores above 90. If you cannot imagine a competent person picking a given
distractor, replace it.

## Self-check before you finish

Run `pnpm check:content`. It verifies count, JSON validity, index ranges, the
presence of `expl` on every item, and that at least two items are select-all.
Then read three questions aloud and ask whether you could answer them from the
doc's wording alone. If yes, rewrite them.
