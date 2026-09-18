---
title: Row selection - from one page to cross-page bulk actions
summary: Checkbox selection in TanStack Table and shadcn/ui - stable row ids, disabled rows, a bulk action bar, cross-page selection and a React Compiler trap.
date: 2026-09-17
part: 4
series: Data Tables in React
tags: [tanstack-table, selection, react-compiler]
minutes: 15
---

## The big picture

> [!TERMS]
> - **Row selection** - ticking checkboxes to pick rows for a bulk action.
> - **Row id** - a value that names a row forever, like an order number. Unlike its position, it never changes.
> - **Bulk action** - one button that acts on every ticked row: cancel, reassign, export.
> - **Bubbling** - a click on an inner element also reaches every element around it, unless something stops it.
> - **Controlled state** - state you hold yourself and hand to a component, instead of letting it keep its own.
> - **Server pagination** - the browser only ever holds the current page; the server has the rest.
> - **React Compiler** - a build tool that adds memo-style caching to your components automatically.

> [!TLDR]
> A checkbox column takes ten minutes.
> Making the ticks survive sorting, paging, search and a build-tool upgrade is the real work.
> Nearly all of it comes down to one thing: remember ticks by the row's id, not its position.

Our example is the trade orders table from part 2.
Traders want to tick rows and press "Cancel orders", "Reassign trader" or "Export selected".
Only orders that are still `working` or `partially_filled` can be cancelled - and that one rule shapes half the design.

| Problem | When you notice it | Fix |
| --- | --- | --- |
| The tick jumps to another row | After a sort, refresh or page change | Give TanStack the real row id |
| Missing the checkbox opens the row | Tables where a row click does something | Make the whole cell swallow the click |
| "Why can't I tick this one?" | Rows that cannot be acted on | Greyed checkbox plus a tooltip saying why |
| The count resets on page 2 | Server pagination | Count from the tick list, not the page |
| The bar is stuck on "0 selected" | After turning on React Compiler | Opt that component out, or pass plain values |

## The checkbox column, and a bigger target

> [!TLDR]
> The checkbox sits inside a wrapper that fills the whole cell and stops the click there.
> A near miss then does nothing, instead of opening the order.

![Two copies of the same row: with the handler on the checkbox a near-miss click bubbles to TableRow and opens the detail, with the handler on a cell-filling wrapper both clicks stop there](images/04-row-selection-checkboxes/select-cell-click-path.png)

A 16px checkbox inside a clickable row is a trap.
Miss it by two pixels and the click lands on the cell's padding, bubbles up to the row, and opens the order.

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
> - The click-stopper belongs on the **wrapper**. A click in the padding never touches the checkbox, so a handler on the checkbox never runs.
> - `-m-2 p-2` pulls the wrapper out to the cell's edges and puts the spacing back inside it.
> - Name the order in each label, so a screen reader says "Select order ORD-118204", not "checkbox, checkbox, checkbox".
> - Fix the column at 40px and switch off sorting and hiding for it.

## Remember ticks by id, not position

> [!TLDR]
> TanStack stores ticks as a list like `{ "row-id": true }`.
> If you do not tell it the real id, it uses the row's position - and a position points at a different order after every sort.

> [!ANALOGY]
> It is like remembering a person as "whoever sits in seat 3".
> The moment people change seats, you are talking to someone else.

> [!STEPS]
> 1. **You tick the first row, order ORD-118204.** TanStack stores `{ "0": true }` - "row 0 is ticked".
> 2. **You sort by symbol.** The server sends a new list; row 0 is now ORD-117950.
> 3. **Nothing updated the ticks.** So ORD-117950 now shows as ticked.
> 4. **You press "Cancel orders".** You cancel an order nobody chose.

The fix is one line: `getRowId: (row) => row.id`.
Now the tick list says `{ "ORD-118204": true }`, which means the same order on every page and under every sort.

> [!INTERVIEW]
> - *When do you hold the tick list yourself?* When something outside the table needs it, like a side panel or ticks loaded from the URL.
> - *Does every list need TanStack for this?* No. For a simple list, a small hook around a JavaScript `Set` of ids is simpler.

## Rows you cannot tick

> [!TLDR]
> Tell TanStack which rows may be ticked.
> A refused row must look refused and say why: a greyed checkbox plus a tooltip.

```ts
export const isCancellable = (order: TradeOrder): boolean =>
  order.status === "working" || order.status === "partially_filled";

useReactTable({ enableRowSelection: (row) => isCancellable(row.original) });
```

> [!NUANCE]
> - Keep the rule in its own file, because the bulk action bar needs it too.
> - A disabled button ignores the mouse completely, so a tooltip placed on it never opens. Put the tooltip on a `span` wrapped around it.
> - The "tick all" checkbox in the header only counts rows that can be ticked.

![A filled order row with a greyed-out checkbox and the tooltip "Order is filled and cannot be cancelled"](images/04-row-selection-checkboxes/disabled-row-tooltip.png)

## The bulk action bar

> [!TLDR]
> Only show an action if it works for **every** ticked row.
> Ask before doing anything destructive, and only clear the ticks once the action succeeded.

> [!STEPS]
> 1. **Check again in the bar.** Prices move: an order can fill after you ticked it, and TanStack never removes a tick by itself.
> 2. **Confirm destructive actions.** Label the "never mind" button "Keep orders". Next to "Cancel orders", a button called "Cancel" is a coin flip.
> 3. **Clear the ticks only on success.** If the request fails, the ticks stay, so the trader can retry without re-ticking twelve rows.
> 4. **Refresh the list** so cancelled orders reappear with their new status.
> 5. **Let the server check too.** The check in the browser is a courtesy; the server's check is the real guard.

> [!NUANCE]
> - A button that quietly skips some of the ticked rows is worse than no button.
> - The bar swaps in for the search box in a slot of fixed height. If it pushed the table down, the trader's next click would land on a different row.

![The bulk bar showing 3 selected with Cancel orders, Reassign trader, Export selected and Clear, and the confirm dialog open over the table](images/04-row-selection-checkboxes/cancel-confirm-dialog.png)

## Ticks across pages

> [!TLDR]
> When the server does the paging, the table only holds the current page.
> TanStack's "selected rows" helper can only see that page, so count from the tick list itself.

![Three orders ticked on page 1, then page 2 loaded: getSelectedRowModel returns 0 rows because it only sees the page, while the id-keyed rowSelection map still returns 3 ids](images/04-row-selection-checkboxes/page-scoped-vs-id-keyed-selection.png)

```ts
export const getSelectedIds = (selection: RowSelectionState): string[] =>
  Object.keys(selection).filter((id) => selection[id]);

const selectedIds = getSelectedIds(table.getState().rowSelection);
```

> [!NUANCE]
> - A footer that says "3 selected" on page 1 and "0 selected" on page 2 is a very common bug. It is reading the page, not the tick list.
> - An id tells you *which* rows, not *what is in them*. Either send the ids to the server, or remember each row as its page loads.
> - That memory can decide what to **show**, never what is **allowed**. An id you never loaded means "do not offer the action".
> - "Select all 1,204 matching" should send the filter plus the rows to leave out, not 1,204 ids.

## Search, tabs and export

> [!TLDR]
> Keep ticks through a search only if you tell the user how many are now hidden.
> Clear them when the available actions change.
> Export exactly what was ticked.

> [!NUANCE]
> - Keeping ticks through a search supports "search NVDA, tick all, untick two, clear the search".
>   But the bar must then say "12 selected - 3 not on this page", or a trader sees nine ticks and cancels twelve orders.
> - Moving from the Working tab to the Filled tab changes what can be done, so clear the ticks - inside the tab's click handler.
> - "Export selected" sends the ids, and the server ignores the current search. Otherwise a row ticked under an earlier search gets filtered out, and the trader gets eleven rows after ticking twelve.
> - Shift-click to tick a range: remember the last clicked **id**, not its index, because the index goes stale after a sort.

![Page 2 of the blotter with no ticked rows visible, the bar reading "3 selected - 3 not on this page" and the footer reading "3 of 300 row(s) selected"](images/04-row-selection-checkboxes/cross-page-count.png)

## React Compiler and the stuck "0 selected"

> [!TLDR]
> TanStack keeps one `table` object and changes it in place, so it is always "the same object".
> React Compiler sees the same input and reuses the old drawing forever.
> Opt such components out with `"use no memo"`, or pass them plain values instead.

![React Compiler caches the bulk bar on the first render with the table prop, then on the next render sees the same table reference and reuses the cached "0 selected" while three rows are ticked](images/04-row-selection-checkboxes/react-compiler-frozen-bulk-bar.png)

```tsx
export const OrdersBulkBar = ({ table }: OrdersBulkBarProps) => {
  "use no memo"; // must be the first line: the table object never changes identity

  const count = getSelectedIds(table.getState().rowSelection).length;

  return <BulkBar count={count} />;
};
```

> [!GOTCHA]
> The opt-out works per component, and children in other files do not inherit it.
> After turning the compiler on, one team found every search box refused typing and every footer read "0-0 of 0" above visible rows.
> The toolbar and footer each received the unchanging `table` object.
> Every component that reads live values from `table` needs its own `"use no memo"`.
> A bar that happens to work because it lives inside an opted-out parent will freeze the day someone moves it into its own file.

> [!INTERVIEW]
> - *What is the cleaner long-term fix?* Pass plain values like `selectedIds` and `onClear`. They change when the ticks change, so the compiler caches correctly, and only the one parent reading `table` needs the opt-out.

> [!WIN]
> Ticks tied to real ids, honest counts on every page, refused rows that explain themselves, and a bar that survives a compiler upgrade.

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
