# Data Tables in React

A seven-part learning series on building data tables with TanStack Table v8 and
shadcn/ui, from the plain-state interview version to server-driven tables with
header filters.
Each part ends with a graded, scenario-based quiz.

Live: https://ninawekunal.github.io/data-tables-in-react-docs/

| Part | Topic |
| --- | --- |
| 1 | Sort, filter, paginate |
| 2 | Server-driven tables behind a BFF |
| 3 | Virtualization, and when not to |
| 4 | Row selection and cross-page bulk actions |
| 5 | Cell design: group or standardize |
| 6 | Row click UX |
| 7 | Column header filters |

The docs live in `content/docs/*.md`, one markdown file per part with a fenced
quiz block.
The format and renderer come from
[learning-doc-builder](https://github.com/ninawekunal/learning-doc-builder).

```bash
pnpm install
pnpm dev
pnpm check:content
```

Pushing to `main` validates, builds and deploys to GitHub Pages.

MIT licensed.
