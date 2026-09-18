---
title: Cell design - when to group, when to standardize
summary: When two fields belong in one cell, when they must stay apart, and how to make money, PnL and empty cells impossible to render inconsistently.
date: 2026-09-17
part: 5
tags: [ux, tanstack-table, formatting]
minutes: 15
---

## The big picture

> [!TLDR]
> Tables age badly when every field gets its own column and every page formats
> money its own way. Group context, keep peer numbers apart, and standardize the
> cells people compare.

| Decision | Rule |
| --- | --- |
| Group two fields | Only when the second is read against the first and never sorted, filtered or reconciled alone |
| Keep apart | Peer numbers: quantity and price, market value and PnL |
| Renderer | Presentation only. Sort, filter and CSV read the accessor |
| Money | Two decimals, `tabular-nums` inside the component, pinned locale, code only when it differs from base |
| Conventions | `ColumnDef.meta` flags, applied in one cell wrapper |
| Copy | Right-click, so the single click stays free for the row action |

Every column costs horizontal pixels and one more stop for the eye on every row.
Once the table scrolls sideways, the instrument name leaves the screen while you
read the PnL.

![The 14-column Positions blotter, cut off at Market value by horizontal scroll](images/05-cell-design-grouping-and-standard-cells/before-14-columns.png)

## When to group

> [!TLDR]
> Group when the second value means nothing to the reader except as context for
> the first. Nobody scans for "NVIDIA Corp"; they scan for `NVDA` and the name confirms the hit.

![Two questions decide it: is the second value only read against the first, and does anyone sort or filter by it alone](images/05-cell-design-grouping-and-standard-cells/group-or-keep-separate.png)

> [!STEPS]
> 1. **Instrument.** Symbol primary; name and asset class as a muted second line.
> 2. **Filled / Qty.** Not two facts but one ratio, with a 4px progress bar that reads as texture.
> 3. **Desk / Trader.** Filing context: both lines muted so they never compete with values.
> 4. **Submitted.** A timestamp with its age pill, derived from the date so they can never disagree.

> [!NUANCE]
> - Fourteen columns became nine: five text fields folded into two cells, the
>   currency column folded into the money cell, and the position id moved to the detail drawer.
> - Alert icons for a risky row go on the secondary line, so the primary column stays scannable.
> - Compute age from an `asOf` stamped in the loader, never `Date.now()` in render,
>   or server and browser HTML differ and hydration fails.
> - The day someone asks "can I sort by trader?", the trader gets its own column back.

![The same rows as 9 grouped columns, fitting the viewport](images/05-cell-design-grouping-and-standard-cells/after-grouped-cells.png)

## When NOT to group

> [!TLDR]
> Text context groups well. Peer numbers almost never do. `Filled / Qty` is the
> exception only because the second number is the denominator of the first.

A `Qty @ Price` cell fails three checks at once:

> [!NUANCE]
> - **Sort.** A risk manager sorts by quantity, a trader by price. One column has one sort key.
> - **Filter.** `quantity < 0` and `lastPrice < 5` cannot both live on one column.
> - **Compare down the column.** People read numbers digit under digit; a stack breaks that.
> - Market value and unrealized PnL are reconciled against **different reports**, so they stay neighbours, not a pair.

> [!INTERVIEW]
> - *How do you label a grouped header?* Name both halves in the cell's order with
>   the cell's separator - "Filled / Qty" - plus a tooltip saying which half the
>   sort uses. "Instrument" stays one word because it is a real noun for the pair.

## The renderer is presentation only

> [!TLDR]
> TanStack never reads `cell` when it sorts, filters or builds facets. Merge two
> fields and you owe the table one answer: which value is this column?

![One column definition feeds three consumers: the cell draws the screen, the accessorFn drives sort and filter, and a separate CSV list re-splits the pair](images/05-cell-design-grouping-and-standard-cells/three-consumers-of-a-column.png)

```tsx
export const filledColumn: ColumnDef<OrderRow> = {
  id: "filledQuantity",
  // Sorts by filled quantity, not fill ratio: "who has the most done"
  // is what this blotter answers. The Qty half is context only.
  accessorFn: (row) => row.filledQuantity,
  cell: ({ row }) => <FilledCell filled={row.original.filledQuantity} quantity={row.original.quantity} />,
};
```

> [!NUANCE]
> - Write the sort choice down in a comment. When someone reports the column
>   "sorts wrong", the comment is how they learn it was a decision.
> - Under server sorting the column `id` goes to the BFF, so sort keys live in a
>   plain module the server can import.
> - The CSV re-splits every merged cell and has **more** columns than the screen.
>   Numbers go out raw; a spreadsheet cannot sum `"EUR -879,400.00"`. The UI's
>   empty glyph becomes a genuinely blank field.

## Standardize money

> [!TLDR]
> Money must look identical in every table, because people reconcile it line by
> line. Lock the decisions inside one `MoneyCell`, not at call sites.

> [!STEPS]
> 1. **Two decimals, always.** `1,640,750.00`, never `879,400.5` on the next row. Avoid `style: "currency"`, which picks digits per currency.
> 2. **`tabular-nums` inside the component.** A rule at call sites gets forgotten.
> 3. **Pin the locale.** Otherwise SSR hydration breaks and some users see `1.640.750,00`.
> 4. **Currency code only when it differs from base,** muted and on the **left**, so digit right-edges stay aligned.
> 5. **`null` renders `EmptyCell`,** never `0.00`, which is a claim about the value.

> [!NUANCE]
> - Compact notation ("1.6M") is banned from cells: it hides exactly the digits
>   someone is matching against another system.
> - With a second line, the code must use `items-start` and a matching line height.
>   `items-center` floats it between the two lines.

![Money, PnL and Day % columns: USD rows show no code, JPY and GBP rows show a muted code on the left, every right edge lines up](images/05-cell-design-grouping-and-standard-cells/money-and-pnl-cells.png)

## PnL, percent and empty

> [!TLDR]
> One `EmptyCell` for "no value", a sign plus a colour for PnL, and a `signed` flag
> that separates a day change from a portfolio weight.

| Cell | Rule | Why |
| --- | --- | --- |
| Empty | One muted glyph with an `aria-label` | Blank is ambiguous (failed load or nothing?); "N/A" reads as a word among numbers |
| PnL | Explicit `+` / `-` and a gain/loss token | Colour alone disappears on a greyscale printout |
| Percent | Format the number, append `%` | `style: "percent"` multiplies by 100, so 1.84 prints as 184.00% |
| Loss colour | A `loss` token separate from `destructive` | A losing position is information, not an error |

## Conventions as ColumnDef.meta flags

> [!TLDR]
> Columns declare **what** they are through `meta` flags; one `DataTableCell`
> wrapper decides **how** that renders. Change the money display once, touch zero columns files.

![Before, every columns file draws money itself; after, a column declares meta flags and one DataTableCell wrapper renders MoneyCell](images/05-cell-design-grouping-and-standard-cells/meta-flags-one-wrapper.png)

```tsx
export const marketValueColumn: ColumnDef<PositionRow> = {
  accessorKey: "marketValue",
  header: "Market value",
  meta: { money: true }, // no cell, no MoneyCell import, no text-right
};
```

> [!GOTCHA]
> A `getCurrency` meta that returns `Currency | null | undefined` has three meanings:
> a currency ("this amount is in X"), `null` ("deliberately no code, already
> converted to base"), and `undefined` ("use the row's currency"). Collapsing null
> and undefined into one falsy check makes a converted USD column pick up the
> row's local currency - and label a USD figure as EUR.

> [!NUANCE]
> - `meta` is an empty interface you extend by module augmentation. It is the one
>   place `interface` is required, because type aliases do not merge.
> - Reading `MoneyCell`'s source and picking a variant at each call site feels like
>   research. It is invention. Conventions are flags, applied in one wrapper.

## Copy and the two-line budget

> [!TLDR]
> Copy lives on right-click, which nothing else uses. Every cell gets at most two
> lines, so row heights stay equal.

> [!NUANCE]
> - A copy icon repeats on every row and adds a second click target to a row that
>   already opens a drawer. Right-click keeps the single click free.
> - Copy the accessor value, not the rendered text: the clipboard gets `1640750`.
> - Honest limit: a `td` is not focusable and touch needs a long press, so keep the
>   id as selectable text in the detail view too.
> - `min-w-0` on the flex container, or `truncate` silently does nothing - a flex
>   child refuses to shrink below its content.
> - `min-h-4` on the secondary line keeps rows equal, which a fixed-`estimateSize` virtualizer relies on.
> - Long single values use `line-clamp-2` plus `whitespace-normal`, because shadcn's
>   `TableCell` sets `whitespace-nowrap`.
> - Status pills come from one `Record<Status, variant>` map, so "rejected" is the same red everywhere.

> [!WIN]
> Nine readable columns instead of fourteen, money that matches the statement on
> every screen, and conventions that live in one wrapper instead of forty files.

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
