---
title: Cell design - when to group, when to standardize
summary: When two fields belong in one cell, when they must stay apart, and how to make money, PnL and empty cells impossible to render inconsistently.
date: 2026-09-17
part: 5
series: Data Tables in React
tags: [ux, tanstack-table, formatting]
minutes: 15
---

## The big picture

> [!TERMS]
> - **Cell** - one box in the table: one row, one column.
> - **Grouping** - showing two fields in one cell, one on top of the other.
> - **Accessor** - the function that reads the raw value a column stands for. Sorting and filtering use this, not what you draw.
> - **Renderer** - the function that draws the cell. It is only for the eyes.
> - **Reconcile** - checking figures line by line against another system, like a bank statement.
> - **Locale** - a country's number and date style: `1,640,750.00` in the US, `1.640.750,00` in Germany.
> - **ColumnDef.meta** - a free-form bag on each TanStack column where you can put your own flags.

> [!TLDR]
> Tables age badly when every field gets its own column and every page formats money its own way.
> Put context in the same cell as the value it explains, keep numbers people compare apart, and make money look identical everywhere.

| Decision | The rule |
| --- | --- |
| Put two fields in one cell | Only if the second is read *with* the first, and nobody sorts or filters by it alone |
| Keep apart | Numbers people compare: quantity and price, value and profit |
| What sorting uses | The accessor, never the drawn cell |
| Money | Two decimals, equal-width digits, a fixed locale, a currency code only when it differs |
| Shared rules | Flags on the column, applied in one place |
| Copying values | Right-click, so the normal click stays free |

Every column costs width and one more stop for the eye on every row.
Once a table scrolls sideways, the name of the thing you are looking at slides off-screen while you read its numbers.

![The 14-column Positions blotter, cut off at Market value by horizontal scroll](images/05-cell-design-grouping-and-standard-cells/before-14-columns.png)

## When two fields share a cell

> [!TLDR]
> Group two fields when the second one only makes sense next to the first.
> Nobody scans a column for "NVIDIA Corp". They scan for `NVDA`, and the name underneath just confirms it.

![Two questions decide it: is the second value only read against the first, and does anyone sort or filter by it alone](images/05-cell-design-grouping-and-standard-cells/group-or-keep-separate.png)

> [!ANALOGY]
> A grouped cell is a name badge: big name, small job title underneath.
> You read the name; the title just tells you which Sam this is.

> [!STEPS]
> 1. **Instrument.** The symbol on top; the full name and asset type small and grey below it.
> 2. **Filled / Qty.** "1,200 of 5,000 filled" is really one fact (a ratio), shown with a thin progress bar.
> 3. **Desk / Trader.** Who owns the row. Both lines grey, so they never compete with the numbers.
> 4. **Submitted.** A time, plus a small "3h" age label worked out from that same time, so they can never disagree.

> [!NUANCE]
> - Fourteen columns became nine, and the table fits on screen.
> - Warning icons go on the small second line, so the main column stays easy to scan.
> - Work out "3h ago" from a timestamp the server sends, never from the clock while drawing. Otherwise the server's HTML and the browser's differ.
> - The day someone asks to sort by trader, trader gets its own column back.

![The same rows as 9 grouped columns, fitting the viewport](images/05-cell-design-grouping-and-standard-cells/after-grouped-cells.png)

## When NOT to share a cell

> [!TLDR]
> Text context groups well.
> Numbers that people compare almost never do.

A "Qty @ Price" cell fails three ways at once:

> [!NUANCE]
> - **Sorting.** A risk manager sorts by quantity; a trader sorts by price. One column can only sort one way.
> - **Filtering.** "quantity below zero" and "price below 5" cannot both live on one column.
> - **Comparing down the page.** People compare numbers digit under digit. Two stacked numbers break that.
> - Market value and profit are checked against *different* reports, so they stay neighbours, not a pair.
> - "Filled / Qty" is the one exception, because the second number is the bottom of the first number's fraction.

> [!INTERVIEW]
> - *How should a grouped header be labelled?* Name both halves, in the same order and with the same separator as the cell: "Filled / Qty". Add a tooltip saying which half the sort uses.

## Sorting ignores what you draw

> [!TLDR]
> TanStack never looks at your drawn cell when it sorts or filters.
> So when you merge two fields, you must pick one value for the column to sort by - and write down why.

![One column definition feeds three consumers: the cell draws the screen, the accessorFn drives sort and filter, and a separate CSV list re-splits the pair](images/05-cell-design-grouping-and-standard-cells/three-consumers-of-a-column.png)

```tsx
export const filledColumn: ColumnDef<OrderRow> = {
  id: "filledQuantity",
  // Sorts by the filled amount, not the fill percentage:
  // "who has the most done" is the question this table answers.
  accessorFn: (row) => row.filledQuantity,
  cell: ({ row }) => <FilledCell filled={row.original.filledQuantity} quantity={row.original.quantity} />,
};
```

> [!NUANCE]
> - The comment is the point. When someone reports "this column sorts wrong", it tells them it was a choice.
> - The CSV export splits every merged cell back into separate columns and writes plain numbers, because a spreadsheet cannot add up "EUR -879,400.00".
> - An empty cell on screen becomes a truly blank field in the CSV.

## Money must look the same everywhere

> [!TLDR]
> People check money against statements, line by line.
> Put every money rule inside one `MoneyCell` component, so no page can get it wrong.

> [!STEPS]
> 1. **Always two decimals.** `1,640,750.00`, never `879,400.5` on the next row.
> 2. **Equal-width digits (`tabular-nums`)**, set inside the component, so no page can forget.
> 3. **One fixed locale.** Otherwise some readers see `1.640.750,00`, and the server and browser disagree.
> 4. **Show the currency code only when it differs from the book's own currency**, small and on the left, so the right edges of the numbers still line up.
> 5. **Show "no value" as a dash, never `0.00`.** Zero is a real claim about the value.

> [!NUANCE]
> - Never shorten to "1.6M" in a table cell. It hides exactly the digits someone is trying to match.
> - With a second line under the amount, align the currency code to the top line, or it floats awkwardly between the two.

![Money, PnL and Day % columns: USD rows show no code, JPY and GBP rows show a muted code on the left, every right edge lines up](images/05-cell-design-grouping-and-standard-cells/money-and-pnl-cells.png)

## Profit, percentages and "no value"

> [!TLDR]
> One shared empty-cell marker, a plus or minus sign as well as a colour for profit, and a clear difference between "changed by 1.8%" and "is 1.8% of the portfolio".

| Cell | Rule | Why |
| --- | --- | --- |
| Empty | One grey dash, with a label for screen readers | A blank could mean "failed to load"; "N/A" reads like a word among numbers |
| Profit / loss | A + or - sign as well as green or red | Colour disappears on a black-and-white printout |
| Percent | Format the number yourself, then add `%` | The built-in percent style multiplies by 100, so 1.84 becomes 184% |
| Loss colour | Its own colour, not the "error red" | A loss is normal information, not something broken |

## Shared rules as column flags

> [!TLDR]
> Each column just says **what** it is (`money: true`).
> One shared wrapper decides **how** that looks.
> Change the money style once, and no column file needs touching.

![Before, every columns file draws money itself; after, a column declares meta flags and one DataTableCell wrapper renders MoneyCell](images/05-cell-design-grouping-and-standard-cells/meta-flags-one-wrapper.png)

```tsx
export const marketValueColumn: ColumnDef<PositionRow> = {
  accessorKey: "marketValue",
  header: "Market value",
  meta: { money: true }, // no custom cell, no alignment classes - the wrapper handles it
};
```

> [!GOTCHA]
> A "which currency?" flag often has three possible answers: a currency ("this amount is in EUR"), `null` ("already converted, show no code") and `undefined` ("use the row's own currency").
> Treat `null` and `undefined` as the same "empty" case, and a column already converted to dollars quietly picks up each row's local currency - labelling a dollar figure as euros.

> [!NUANCE]
> - `meta` starts empty. You describe your flags by extending TanStack's type, which is the one place TypeScript needs `interface` instead of `type`.
> - Copying one cell's code into each page and tweaking it feels like research. It is how tables drift apart.

## Copying, and the two-line limit

> [!TLDR]
> Put "Copy value" on right-click, which nothing else uses.
> Give every cell at most two lines, so every row is the same height.

> [!NUANCE]
> - A copy icon in every row adds a second click target to a row that already opens a drawer.
> - Copy the raw value (`1640750`), not the drawn text, because that is what a spreadsheet wants.
> - Honest limit: keyboard users cannot right-click a cell, so also show the id as selectable text in the detail view.
> - Truncating long text inside a flex layout silently fails unless the container has `min-w-0`.
> - Status badges come from one lookup table, so "rejected" is the same red everywhere.

> [!WIN]
> Nine readable columns instead of fourteen, money that matches the statement on every screen, and rules that live in one place instead of forty files.

```quiz
[
  {
    "q": "A PM asks to merge Quantity and Last price into one 'Qty @ Price' cell to save width. Strongest objection?",
    "options": [
      "Two-line cells break virtualization estimates",
      "Price must always show a currency code",
      "They are peer numbers sorted and filtered independently",
      "Merged cells cannot be exported to CSV"
    ],
    "answer": 2,
    "expl": "One column has one sort key and one filter, and a stack breaks digit-under-digit comparison. Export can re-split merged cells, so that is not the blocker."
  },
  {
    "q": "Which pair is a good candidate for one cell?",
    "options": [
      "Symbol with the instrument name beneath it",
      "Market value and unrealized PnL",
      "Quantity and average cost",
      "Day change percent and portfolio weight"
    ],
    "answer": 0,
    "expl": "The name is only read to confirm the symbol and nobody sorts by it. The others are peer numbers reconciled or compared independently."
  },
  {
    "q": "A 'Filled / Qty' column sorts by filled quantity. A user reports it 'sorts wrong' because they expected fill ratio. What is the right response?",
    "options": [
      "Switch the accessor to compute the ratio",
      "Split the cell back into two columns",
      "Sort by the rendered text instead",
      "Point to the documented, deliberate sort key"
    ],
    "answer": 3,
    "expl": "A merged column needs one chosen sort value, and the comment records why. Changing it silently just moves the complaint."
  },
  {
    "q": "A column's cell renders 'NVDA / NVIDIA Corp', but sorting orders rows by an unrelated field. What is TanStack reading?",
    "options": [
      "The rendered cell text",
      "The column's accessor value",
      "The row's original index",
      "The header's sortingFn label"
    ],
    "answer": 1,
    "expl": "Sort, filter and facets read the accessor, never the renderer. Whatever accessorFn returns is what sorts."
  },
  {
    "q": "The CSV export sums badly in Excel: amounts arrive as 'EUR -879,400.00'. What should change?",
    "options": [
      "Use style: 'currency' in the CSV formatter",
      "Export raw numbers with currency in its own column",
      "Wrap each amount in double quotes",
      "Switch the export locale to de-DE"
    ],
    "answer": 1,
    "expl": "A spreadsheet needs a raw number to sum. Formatting belongs to the screen; the CSV re-splits every merged value into its own column."
  },
  {
    "q": "Some users see '1.640.750,00' in a table rendered on the server. What is missing?",
    "options": [
      "tabular-nums on the money cell",
      "A currency code for non-USD rows",
      "maximumFractionDigits set to two",
      "A pinned locale in the number formatter"
    ],
    "answer": 3,
    "expl": "Without a pinned locale, the browser formats in the user's locale and the server in its own, producing different strings and hydration errors."
  },
  {
    "q": "Why does the currency code sit to the left of the amount rather than after it?",
    "options": [
      "Digit right-edges stay aligned with or without a code",
      "Screen readers announce the code first",
      "The code must be visually de-emphasised",
      "Most locales put the symbol first"
    ],
    "answer": 0,
    "expl": "A trailing code on only some rows would push those numbers left, breaking the aligned right edge readers compare against."
  },
  {
    "q": "A position has no mark yet. Which rendering of its market value is right?",
    "options": [
      "0.00 in muted text",
      "An empty cell with no content",
      "A muted glyph with an aria-label",
      "The text N/A in small caps"
    ],
    "answer": 2,
    "expl": "0.00 is a claim about the value, blank is ambiguous with a failed load, and N/A reads as a word among numbers. One shared EmptyCell says 'no value'."
  },
  {
    "q": "A day change of 1.84 renders as 184.00%. What caused it?",
    "options": [
      "The value was stored as a fraction",
      "The locale used a comma decimal",
      "signDisplay was set to always",
      "The formatter used style: 'percent'"
    ],
    "answer": 3,
    "expl": "style: 'percent' multiplies by 100. The value is already in percent units, so format the number and append the sign."
  },
  {
    "q": "Which belong inside a shared MoneyCell rather than at each call site? Select all that apply.",
    "options": [
      "tabular-nums on the digits",
      "A fixed two-decimal format",
      "The column's sort direction",
      "Compact notation for large values"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Rules that live at call sites get forgotten, so lock digit style and precision in the component. Sorting is column logic, and compact notation is banned from cells."
  },
  {
    "q": "A column already converted to USD suddenly shows 'EUR' on European rows. getCurrency returns null for it. What bug is likely?",
    "options": [
      "The row currency was mapped incorrectly",
      "The meta flag was not typed by augmentation",
      "null and undefined shared one falsy check",
      "The CSV route overwrote the currency meta"
    ],
    "answer": 2,
    "expl": "null means 'deliberately no code'; undefined means 'use the row currency'. A falsy check sends null down the row-currency path."
  },
  {
    "q": "Why keep a separate loss colour token instead of reusing destructive?",
    "options": [
      "destructive fails contrast in dark mode",
      "A losing position is information, not an error",
      "Tailwind cannot alias existing tokens",
      "destructive is reserved for buttons only"
    ],
    "answer": 1,
    "expl": "Semantics differ: destructive means 'something failed or will be destroyed'. A loss is normal data that should read calmly."
  },
  {
    "q": "Which statements about copy-on-right-click are true? Select all that apply.",
    "options": [
      "It keeps the single click free for opening the row",
      "It should copy the accessor value, not the rendered text",
      "It is fully keyboard accessible by default on a td",
      "It removes the need for selectable ids elsewhere"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Right-click avoids a second click target and the raw value is what a spreadsheet wants. A td is not focusable, so keep the id selectable in the detail view."
  },
  {
    "q": "A two-line cell has truncate on its text but long names overflow anyway. What is missing?",
    "options": [
      "min-w-0 on the flex container",
      "overflow-hidden on the table cell",
      "whitespace-nowrap on the span",
      "A fixed max-width on the column"
    ],
    "answer": 0,
    "expl": "A flex child will not shrink below its content width unless min-width is zero, so truncate has nothing to clip."
  },
  {
    "q": "Why does the Submitted cell take an asOf prop instead of calling Date.now()?",
    "options": [
      "Server and browser render at different times",
      "Date.now() is slow inside tight render loops",
      "asOf is required for the CSV timestamps",
      "React Compiler removes Date.now() calls"
    ],
    "answer": 0,
    "expl": "An age computed from the clock during render differs between the server HTML and the client, causing a hydration mismatch. Stamp time once in the loader."
  }
]
```
