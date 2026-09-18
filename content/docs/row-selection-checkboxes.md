---
title: Row selection - from one page to cross-page bulk actions
summary: Checkbox selection in TanStack Table and shadcn/ui - stable row ids, disabled rows, a bulk action bar, cross-page selection and a React Compiler trap.
date: 2026-09-17
part: 4
tags: [tanstack-table, selection, react-compiler]
minutes: 15
---

## The big picture

> [!TLDR]
> A checkbox column takes ten minutes. Making selection survive sorting, paging,
> search and a build-tool upgrade is the real work - and almost all of it comes
> down to keying selection by a real id.

The example is the server-driven Trade orders blotter from part 2. Traders want
"Cancel orders", "Reassign trader" and "Export selected". Only `working` and
`partially_filled` orders can be cancelled, and that one rule shapes half the design.

| Problem | Where it bites | Fix |
| --- | --- | --- |
| Selection follows position | Any sort, refetch or page change | `getRowId` |
| Near-miss click opens the row | Clickable rows | Cell-filling wrapper stops propagation |
| "Why can't I tick this?" | Non-actionable rows | Disabled checkbox plus a tooltip reason |
| Count resets on page 2 | Server pagination | Read the `rowSelection` map, not the row model |
| Bar frozen at "0 selected" | React Compiler | `"use no memo"`, or primitive props |

## The select column and its hit target

> [!TLDR]
> A column with no data, fixed at 40px, not sortable or hideable, with a
> cell-filling wrapper that swallows the click so a near miss never opens the order.

![Two copies of the same row: with the handler on the checkbox a near-miss click bubbles to TableRow and opens the detail, with the handler on a cell-filling wrapper both clicks stop there](images/04-row-selection-checkboxes/select-cell-click-path.png)

```tsx
export const SelectCell = ({ row }: SelectCellProps) => (
  <div className="-m-2 p-2" onClick={(e) => e.stopPropagation()}>
    <Checkbox
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onCheckedChange={(v) => row.toggleSelected(!!v)}
      aria-label={`Select order ${row.original.id}`}
    />
  </div>
);
```

> [!NUANCE]
> - `stopPropagation` belongs on the **wrapper**. A click in the padding never
>   touches the checkbox, so a handler there never runs.
> - `-m-2 p-2` cancels the cell padding and re-adds it inside, so the wrapper covers the cell.
> - To make a near miss count as a tick, toggle only when `e.target === e.currentTarget`,
>   or you double-toggle.
> - Name the order in each `aria-label`, not "checkbox, checkbox, checkbox".
> - `size`, `minSize` and `maxSize` all 40, sorting and hiding off. A visibility menu with a "select" entry is a bug report waiting to happen.
> - Reusing `id: "select"` lets a feature swap in radio buttons for a picker dialog - same slot, different control.

## Row identity: getRowId or nothing works

> [!TLDR]
> TanStack stores selection as `{ [rowId]: true }`. Without `getRowId` the id is the
> array index, so a tick belongs to "row 0", whatever row 0 is now.

> [!STEPS]
> 1. **Tick ORD-118204 at row 0.** State: `{ "0": true }`.
> 2. **Sort by symbol.** The server returns a new array; row 0 is now ORD-117950.
> 3. **State is unchanged.** ORD-117950 now looks ticked.
> 4. **Press "Cancel orders".** You cancel an order nobody selected.

> [!NUANCE]
> - It bites whenever `data` changes: a server sort, a refetch, a page change.
> - Selections seeded from outside the table, like ids in a URL, land on whatever
>   rows sit at those indexes.
> - With `getRowId: (row) => row.id` the key means the same order on every page and under every sort.

> [!INTERVIEW]
> - *When do you lift `rowSelection` out of the table?* When something outside
>   needs it - a URL seed, a side panel. A reusable wrapper is controlled only when
>   **both** `rowSelection` and `onRowSelectionChange` are passed.
> - *Does every list need TanStack for this?* No. A non-table list is often simpler
>   with a `Set<string>` hook: `isChecked`, `toggle`, `clear`, `hasAny`.

## Rows that cannot be selected

> [!TLDR]
> `enableRowSelection` takes a per-row function. A refused row must **look**
> refused and say why: disabled checkbox plus a tooltip.

```ts
export const isCancellable = (order: TradeOrder): boolean =>
  order.status === "working" || order.status === "partially_filled";

useReactTable({ enableRowSelection: (row) => isCancellable(row.original) });
```

> [!NUANCE]
> - The rule lives in its own file because the bulk bar needs it too.
> - Wrap the disabled checkbox in a `span` for the tooltip. A disabled button fires
>   no pointer or focus events, so a tooltip on it never opens.
> - The header checkbox only counts selectable rows.

![A filled order row with a greyed-out checkbox and the tooltip "Order is filled and cannot be cancelled"](images/04-row-selection-checkboxes/disabled-row-tooltip.png)

## The bulk action bar

> [!TLDR]
> Show an action only when it applies to **every** selected row. Confirm
> destructive ones, and clear the selection only when the mutation succeeds.

> [!STEPS]
> 1. **Re-check eligibility in the bar.** The blotter is live: an order can fill after you tick it, and TanStack never drops an id on its own.
> 2. **Confirm destructive actions.** Label the dismiss "Keep orders" - next to "Cancel orders", a dismiss labelled "Cancel" is a coin flip.
> 3. **Clear on success only.** On failure the ticks stay so the trader can retry without re-ticking twelve rows.
> 4. **Invalidate and refetch.** Cancelled rows come back with their new status.
> 5. **Let the server re-check.** The client check is a courtesy, not a guard.

> [!NUANCE]
> - `resetRowSelection(true)` resets to an empty map, not to the seeded initial state.
> - A button that silently skips part of the selection is worse than no button.
> - Put the bar in a fixed-height toolbar slot (it replaces the search box). If it
>   pushes the table down, the second click lands on a different order.

![The bulk bar showing 3 selected with Cancel orders, Reassign trader, Export selected and Clear, and the confirm dialog open over the table](images/04-row-selection-checkboxes/cancel-confirm-dialog.png)

## Selection across server-side pages

> [!TLDR]
> Under `manualPagination`, `getSelectedRowModel()` only sees the current page. The
> cross-page truth is the `rowSelection` map itself.

![Three orders ticked on page 1, then page 2 loaded: getSelectedRowModel returns 0 rows because it only sees the page, while the id-keyed rowSelection map still returns 3 ids](images/04-row-selection-checkboxes/page-scoped-vs-id-keyed-selection.png)

```ts
export const getSelectedIds = (selection: RowSelectionState): string[] =>
  Object.keys(selection).filter((id) => selection[id]);

const selectedIds = getSelectedIds(table.getState().rowSelection);
```

> [!NUANCE]
> - Footers and export buttons built on `getFilteredSelectedRowModel()` quietly
>   show only the current page's count. This is a common production bug.
> - Ids say what is selected, not what the rows contain. Either send ids to the
>   server, or fold each loaded page into an `id -> row` map.
> - That map decides what to **show**, never what is **allowed**. An id seeded from
>   a URL may never have loaded; unknown means "do not offer the action".
> - The header checkbox is page-scoped. "Select all 1,204 matching" sends the filter
>   plus `excludeIds`, not 1,204 ids.

## Search, tabs and export

> [!TLDR]
> Keep ticks through a search if you say how many are hidden. Clear them when the
> available actions change. Export exactly the selection.

> [!NUANCE]
> - Keeping selection through a search protects "search NVDA, tick all, untick
>   two, clear search". The bar must then read "12 selected - 3 not on this page",
>   or a trader sees nine ticks and cancels twelve orders.
> - Switching Working to Filled changes what is actionable, so clear the selection
>   - in the tab's event handler, not an effect watching `tab`.
> - "Export selected" sends `ids` and the server drops the filters. Otherwise a row
>   ticked under an earlier search is filtered out and the trader gets eleven rows
>   after selecting twelve. Scope still applies, so a hand-edited `ids=` cannot
>   pull someone else's orders.
> - Shift-click range selection: remember the last clicked **id**, not its index,
>   and resolve positions in `table.getRowModel().rows` - what the user sees.

![Page 2 of the blotter with no ticked rows visible, the bar reading "3 selected - 3 not on this page" and the footer reading "3 of 300 row(s) selected"](images/04-row-selection-checkboxes/cross-page-count.png)

## React Compiler and the frozen bulk bar

> [!TLDR]
> TanStack mutates one `table` object in place. React Compiler sees the same
> reference forever and reuses cached output. Opt out with `"use no memo"`, or pass
> primitives.

![React Compiler caches the bulk bar on the first render with the table prop, then on the next render sees the same table reference and reuses the cached "0 selected" while three rows are ticked](images/04-row-selection-checkboxes/react-compiler-frozen-bulk-bar.png)

```tsx
export const OrdersBulkBar = ({ table }: OrdersBulkBarProps) => {
  "use no memo"; // first statement: the table reference never changes

  const count = getSelectedIds(table.getState().rowSelection).length;

  return <BulkBar count={count} />;
};
```

> [!GOTCHA]
> The opt-out is per component, and children defined elsewhere do not inherit it.
> After enabling the compiler, search boxes on every table could not be typed into
> and footers read "0-0 of 0" over visible rows, because the toolbar and footer
> took the stable `table` prop. Every component that reads live state off `table`
> needs its own `"use no memo"`. A bar rendered inline in an opted-out parent is
> safe only by accident of placement - move it into its own file and it freezes.

> [!INTERVIEW]
> - *What is the cleaner long-term fix?* Pass primitives (`selectedIds`, `onClear`).
>   The props change with the selection, and the compiler caches correctly. Only
>   the parent that reads `table` needs the opt-out, and the mistake is visible in review.

> [!WIN]
> Selection keyed by id, honest counts on every page, refused rows that explain
> themselves, and a bar that survives a compiler upgrade.

```quiz
[
  {
    "q": "A trader ticks an order, the blotter refetches after 30 seconds, and a different order is now ticked. What is missing?",
    "options": [
      "autoResetRowSelection set to false",
      "getRowId returning the order id",
      "A controlled rowSelection state",
      "A stable key on each rendered row"
    ],
    "answer": 1,
    "expl": "Without getRowId the selection map is keyed by index, so a new data array moves the tick to whatever row is now at that index. A React key only fixes DOM reuse."
  },
  {
    "q": "Users keep opening the order drawer when they mean to tick a checkbox. stopPropagation is on the Checkbox's onClick. Why does it still happen?",
    "options": [
      "Radix checkboxes re-dispatch the click event",
      "stopPropagation does not work on React synthetic events",
      "The row handler runs in the capture phase first",
      "Near misses hit padding, not the checkbox"
    ],
    "answer": 3,
    "expl": "A click in the padding never reaches the checkbox, so its handler never runs and the click bubbles to the row. The wrapper that fills the cell must stop it."
  },
  {
    "q": "A disabled checkbox has a Tooltip explaining why, but the tooltip never appears. Fix?",
    "options": [
      "Put the tooltip on a wrapping span",
      "Set pointer-events: auto on the checkbox",
      "Replace disabled with aria-disabled only",
      "Add tabIndex={0} to the disabled checkbox"
    ],
    "answer": 0,
    "expl": "Disabled buttons fire no pointer or focus events, so the tooltip trigger never activates. A wrapping span receives them instead."
  },
  {
    "q": "Only cancellable rows can be ticked. Why does the bulk bar still re-check every selected row before showing Cancel?",
    "options": [
      "The header checkbox can select disabled rows",
      "React batches updates and may skip the check",
      "An order can fill after it was ticked",
      "Selection state is shared across tabs"
    ],
    "answer": 2,
    "expl": "The data is live and TanStack never removes an id from rowSelection by itself, so a ticked row can become ineligible."
  },
  {
    "q": "A cancel mutation fails with a 500. What should happen to the selection?",
    "options": [
      "Clear it so the user sees fresh data",
      "Keep only rows that are still cancellable",
      "Reset it to the initial seeded state",
      "Keep it so the trader can retry"
    ],
    "answer": 3,
    "expl": "Clearing on failure forces the trader to re-tick every row. Clear only on success."
  },
  {
    "q": "Under server pagination, a trader ticks 3 orders on page 1 and moves to page 2. The footer says 0 selected. What is it reading?",
    "options": [
      "table.getState().rowSelection",
      "The seen-rows id-to-row cache",
      "table.getFilteredSelectedRowModel()",
      "The rowSelection prop from the URL seed"
    ],
    "answer": 2,
    "expl": "Selected row models are built from rows the table holds, which is one page. The id-keyed state map is the cross-page truth."
  },
  {
    "q": "The bar uses a cache of rows seen on earlier pages to decide whether to offer Cancel. What is that cache allowed to decide?",
    "options": [
      "Whether the server should accept the cancel",
      "Whether to show the action at all",
      "Which rows the server will cancel",
      "Whether to skip the confirm dialog"
    ],
    "answer": 1,
    "expl": "The cache is only as fresh as the last page load, so it can hide an action but never authorize one. The server re-checks."
  },
  {
    "q": "How should 'Select all 1,204 matching' be sent to the server?",
    "options": [
      "As the filter plus a list of excluded ids",
      "As 1,204 ids in a form POST body",
      "As page numbers the user has visited",
      "As a CSV of ids built on the client"
    ],
    "answer": 0,
    "expl": "The client never holds all matching rows. Sending the filter and exceptions lets the server resolve the set itself."
  },
  {
    "q": "Which are sound choices for selection and search? Select all that apply.",
    "options": [
      "Keep ticks through a search and show how many are hidden",
      "Clear ticks when switching to a tab with different actions",
      "Keep ticks through a search without mentioning hidden rows",
      "Clear ticks in an effect that watches the search query"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Keeping ticks is fine only if hidden ones are disclosed, and a tab change invalidates the actions. Clearing belongs in the event handler, which knows the user caused it."
  },
  {
    "q": "A trader ticked 12 orders across two searches and clicks Export selected, but gets 11 rows. What did the CSV route do?",
    "options": [
      "It applied the current filter to the selected ids",
      "It paginated the export to the current page size",
      "It dropped ids that were not in the seen cache",
      "It scoped the ids to the caller's desks"
    ],
    "answer": 0,
    "expl": "One id was ticked under an earlier search, so today's filter excludes it. With ids present, the export should ignore filters but keep scope."
  },
  {
    "q": "After enabling React Compiler, the bulk bar stays at '0 selected'. It receives the TanStack table as a prop. Why?",
    "options": [
      "The compiler strips useState calls from children",
      "rowSelection is not reactive under the compiler",
      "The table reference never changes, so cached output is reused",
      "The compiler moves the bar outside the table context"
    ],
    "answer": 2,
    "expl": "TanStack mutates one table object in place. The compiler sees an identical input and returns the memoized render."
  },
  {
    "q": "The parent table component has 'use no memo'. Its toolbar child, in another file, reads table.getState(). Is the toolbar safe?",
    "options": [
      "Yes, the directive covers the whole render tree",
      "Yes, as long as the toolbar is a function component",
      "No, but only in production builds",
      "No, each component needs its own opt-out"
    ],
    "answer": 3,
    "expl": "The opt-out is per component and is not inherited. Each child that reads live table state needs it, or should take primitive props."
  },
  {
    "q": "Which make a bulk bar robust under React Compiler? Select all that apply.",
    "options": [
      "Passing selectedIds and onClear as primitive props",
      "Putting 'use no memo' on each component reading table",
      "Wrapping the bar in React.memo with no comparator",
      "Storing the table object in a useRef inside the bar"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Primitive props change with the selection, and the opt-out disables caching for components reading the mutable table. memo and refs both keep the stale result."
  },
  {
    "q": "Shift-click range selection stores the index of the last clicked row. What breaks?",
    "options": [
      "The range includes disabled rows",
      "A sort makes the index stale",
      "Ctrl-click stops toggling single rows",
      "The header checkbox shows indeterminate"
    ],
    "answer": 1,
    "expl": "An index goes stale on any sort or page change. Store the id and resolve its position in the visible row model at click time."
  },
  {
    "q": "The confirm dialog for 'Cancel orders' has buttons 'Cancel' and 'Confirm'. What is the problem?",
    "options": [
      "Destructive dialogs should not have a dismiss button",
      "Confirm should be styled as the destructive variant",
      "Cancel is ambiguous next to an action about cancelling",
      "The dialog should list every order id first"
    ],
    "answer": 2,
    "expl": "'Cancel' could mean cancel the orders or cancel the dialog. 'Keep orders' makes the dismiss unambiguous."
  }
]
```
