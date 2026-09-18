---
title: Column header filters with shadcn Popover
summary: Spreadsheet-style filters in the column header, backed by one typed filter object that feeds every surface, the URL and the BFF.
date: 2026-09-17
part: 7
series: Data Tables in React
tags: [filters, shadcn, state-design]
minutes: 16
---

## The big picture

> [!TERMS]
> - **Header filter** - a filter you open by clicking a column's title, like in a spreadsheet.
> - **Popover** - a small floating panel that opens next to what you clicked.
> - **Draft** - your in-progress choices inside the popover, not yet applied.
> - **Commit / Apply** - turning the draft into the real filter the table uses.
> - **Chips** - small removable tags under the toolbar, one per active filter.
> - **Serializer** - a function that turns an object into text, here the `?key=value` part of a URL.
> - **ISO date** - a date written as `2026-09-17`, year first.

> [!TLDR]
> Click a column title to filter it; a small separate button sorts it.
> Each popover keeps a draft and applies it once on "Apply".
> One filter object, owned by the page, feeds every place that shows or changes filters.

![The Trade orders blotter with filterable column headers: each filterable title has a funnel and a separate sort button, and plain headers sit at the same height](images/07-column-header-filters-popover/default.png)

Everyone who has used a spreadsheet knows the move: click the column header, tick two values, done.
A header filter sits right where your eyes already are, so nobody has to translate "this column" into "that field in a form".

| Place | Reads | Changes |
| --- | --- | --- |
| Header popovers | Its own filter key | Its own key, on Apply |
| "All filters" panel | A draft copy of everything | Everything, on Apply |
| Chips row | Every active filter | Removes one value |
| URL, data request, export | Everything, through one serializer | - |

> [!NUANCE]
> Header filters are the wrong tool for "working orders OR anything from my desk" (that crosses columns) and for saved views (those belong in the toolbar).

## Decide the shape of the filters first

> [!TLDR]
> Before any UI, write one plain object with one key per thing a user can narrow.
> Only strings, numbers, lists of strings and `null`, so it survives being put into a URL and read back.

```ts
export type OrderFilters = {
  symbols: string[];
  statuses: OrderStatus[];
  quantityMin: number | null;
  quantityMax: number | null;
  submittedFrom: string | null; // "2026-09-17"
  submittedTo: string | null;
};
```

> [!NUANCE]
> - Count active filters by group: a minimum and a maximum together count as one filter.
> - No `Date` objects in here. Dates are text; `Date` only exists inside the date picker.

## The filter header

> [!TLDR]
> One click target cannot mean both "sort" and "filter".
> Sorting is one click, so it can live on a small button.
> Filtering takes several steps, so it gets the big target: the title.

> [!STEPS]
> 1. **The title opens the popover.** The popover can close itself after Apply, and knows when it is open so it can load options.
> 2. **The funnel shows the state.** Grey when off; the title turns coloured with a count badge when on.
> 3. **Sort gets its own small button**, which shows the direction, because a column can be sorted and filtered at once.
> 4. **Each popover chooses where the cursor starts**, so keyboard users land on the right control.

> [!NUANCE]
> - Do not add an `aria-label` to a button that already shows text. It replaces what screen readers and voice control hear. Add extra words in hidden text instead, so it reads "Status, filter, 2 active".
> - A table that is filtered but does not look filtered reads as missing data.

![Orders blotter with the Symbol popover open under its title, the sort icon button beside the title and the option list loaded](images/07-column-header-filters-popover/symbol-popover-open.png)

## Draft, Apply, Clear

> [!TLDR]
> If every tick applied immediately, four ticks would mean four server requests and four Back-button steps.
> So each popover keeps a draft, applies it once, and throws it away on Escape or a click outside.

> [!ANALOGY]
> It is a shopping basket, not a vending machine.
> You gather what you want, then pay once at the till.

![Committing on every tick fires one request and one history entry per tick, while a draft that commits on Apply fires one request, and Escape or an outside click discards the draft by unmounting the body](images/07-column-header-filters-popover/draft-apply-commit.png)

> [!NUANCE]
> - No special reset code is needed. The popover's content is removed when it closes, so next time it starts fresh from the applied filter.
> - A popover's "Clear" clears only its own draft. "Clear all" lives with the chips. Mixing them up confuses people.

## Long option lists, ranges and dates

> [!TLDR]
> Long lists load from the server the first time a popover opens, and come from **all** the user's data, not the filtered rows.
> Number ranges keep what was typed as text until Apply.
> Dates only become `Date` objects inside the calendar.

> [!NUANCE]
> - If options came from the filtered rows, picking one symbol would leave only that symbol to pick.
> - Put already-applied items at the top of the list - using the applied value, not the draft, or rows jump under the cursor as you tick.
> - Let "nvidia" find `NVDA` by giving each option extra search words.
> - If the options fail to load, say so and offer a retry. An empty list means "nothing exists", which is a different fact.
> - A half-typed number like "1e" is not a number yet, so keep the text and check it each time, instead of storing a number.

> [!GOTCHA]
> `new Date("2026-09-17")` means midnight in **UTC**, the world's reference clock - which is still the evening of the 16th in New York.
> So the calendar highlights the wrong day for American users.
> Build dates from year, month and day in local time, store plain `2026-09-17` text, and let the server decide when a trading day starts.

![Submitted popover with Today and This week presets above a range calendar, three days selected, and the Clear and Apply footer](images/07-column-header-filters-popover/date-range-popover.png)

## One object, many places

> [!TLDR]
> The usual bug is two places disagreeing: a chip says one thing and a header badge another.
> The fix is to have only one copy, so there is nothing to keep in sync.

![The page owns one OrderFilters object that header popovers, the All filters panel and the chips row read and write, and one serializer turns it into the URL, the list request, the CSV link and the query key](images/07-column-header-filters-popover/one-filter-object.png)

> [!STEPS]
> 1. **The page owns the object** and shares it, plus one `updateFilters` function, with everything below it.
> 2. **`updateFilters` also resets to page 1**, because page 7 of the full list does not exist in a list of 12.
> 3. **Chips are worked out from the object**, each knowing how to remove only its own value.
> 4. **The "All filters" panel keeps its own draft** too, applied once.

> [!NUANCE]
> - Share the object through React context rather than rebuilding the columns with it. Rebuilt columns make every header restart, closing any open popover.

![Blotter with Symbol, Status and Quantity badges active, the matching chips row, and the All filters sheet open showing the same symbols, status and minimum quantity](images/07-column-header-filters-popover/all-filters-panel.png)

## Into the URL and to the server

> [!TLDR]
> One function writes the filters into the URL; one schema reads them back - in the browser and on the server.

> [!NUANCE]
> - Always write the same filters the same way: skip defaults, fixed key order, sorted lists. Then "NVDA then AAPL" and "AAPL then NVDA" make the same URL and share a cache.
> - Someone can type anything into a URL. A nonsense value like `?status=banana` should quietly mean "no status filter", not an error page.
> - The data request, the preload and the export link all use the same writer, so the export always matches the screen.
> - For a table whose rows are all in the browser, TanStack's own column filters work well and give you option counts for free.
> - For a server table, TanStack's filter state is just an extra, untyped layer to translate in and out of. Skip it.

> [!INTERVIEW]
> - *What did an unused filter API teach?* A shared table kit shipped a second filter API that no page ever used, and it became dead code. Build the shared version after the second real use, not before the first.

| Styling rule | Value |
| --- | --- |
| Filter headers and plain headers | Same height and text size |
| Popover widths | Narrower for a list, wider for a range, auto for the calendar |
| Alignment | Popover's left edge lines up with its title |
| Focus ring | Keep it; draw it inside if the sticky header clips it |

> [!WIN]
> Filter from the title, sort from a small button, draft and apply once - and every chip, badge, URL and export agrees, because there is only one filter object.

```quiz
[
  {
    "q": "A column header is one button: click to sort, and a funnel opens the filter. Users keep sorting by accident. Best redesign?",
    "options": [
      "Title filters; a small button sorts",
      "Open the filter on right-click instead",
      "Require a double-click to sort the column",
      "Move both actions into a toolbar menu"
    ],
    "answer": 0,
    "expl": "A filter is multi-step and deserves the large target; a sort is one click and survives a small one. Right-click and double-click are undiscoverable."
  },
  {
    "q": "In a server-driven table, each checkbox tick in a filter popover commits immediately. What does the user notice?",
    "options": [
      "Checkboxes lag until the popover closes",
      "The popover closes after every tick",
      "Other headers lose their badges",
      "A request and a history entry per tick"
    ],
    "answer": 3,
    "expl": "Every commit is a request and a URL write, so four ticks mean four requests and four back-button stops. A draft committed on Apply sends one."
  },
  {
    "q": "A popover body initialises its draft from props with useState. Reopening it shows the committed value, with no reset effect. Why does that work?",
    "options": [
      "useState re-reads its initial value on every render",
      "PopoverContent unmounts children when it closes",
      "Radix resets form fields on the close event",
      "The context value changes and forces a remount"
    ],
    "answer": 1,
    "expl": "Closing unmounts the body, so opening mounts it fresh and the initializer runs again. forceMount would keep it mounted and break this."
  },
  {
    "q": "A popover's Clear button also clears every other column's filters. What is wrong with that?",
    "options": [
      "It fires too many requests at once",
      "Local clear and table-wide clear are different jobs",
      "Clear should only exist in the chips row",
      "It bypasses the zod validation step"
    ],
    "answer": 1,
    "expl": "Inside a popover, Clear resets that draft. Clearing everything belongs next to everything it clears, in the chips row. Mixing them confuses users."
  },
  {
    "q": "The Symbol picker only lists symbols from the current page of results. What is the correct source for its options?",
    "options": [
      "The current filtered result set on the server",
      "Unique values from getFacetedUniqueValues",
      "A static list bundled with the client",
      "The unfiltered per-user baseline"
    ],
    "answer": 3,
    "expl": "Options from filtered rows shrink to what is already chosen. The unfiltered, scoped baseline keeps every valid value available."
  },
  {
    "q": "Ticking a symbol makes that row jump to the top of the list while the cursor is on it. What causes it?",
    "options": [
      "Selected-first sorting reads the draft",
      "cmdk re-sorts by relevance on each tick",
      "The keywords prop reorders matching items",
      "The options query refetches after each tick"
    ],
    "answer": 0,
    "expl": "Sorting selected items first from the draft moves rows on every tick. Sort by the committed value, which only changes on Apply."
  },
  {
    "q": "The options request fails and the picker shows 'No symbols found'. What should it show?",
    "options": [
      "The last cached options, silently",
      "An empty list with a loading skeleton",
      "An error with a retry action",
      "A disabled popover trigger"
    ],
    "answer": 2,
    "expl": "'No symbols' and 'the request failed' are different facts. Showing an empty list hides the outage."
  },
  {
    "q": "The quantity range draft stores parsed numbers. Typing '1e' makes the input jump to empty. Fix?",
    "options": [
      "Use type='number' on the input",
      "Debounce the parse by 300 ms",
      "Parse only on the Apply click",
      "Keep string drafts, parse on render"
    ],
    "answer": 3,
    "expl": "A half-typed input is not a number yet. Keep the text, derive parsed values and the error each render, so they cannot fall out of step."
  },
  {
    "q": "A user in New York picks 17 September and the calendar highlights the 16th. The code uses new Date('2026-09-17'). Why?",
    "options": [
      "react-day-picker uses UTC internally",
      "The locale was not pinned to en-US",
      "Date-only strings parse as UTC",
      "toISOString drops the day component"
    ],
    "answer": 2,
    "expl": "Date-only ISO strings are UTC midnight, which is the previous evening in New York. Build dates from local calendar fields."
  },
  {
    "q": "Which keep a date filter hydration-safe? Select all that apply.",
    "options": [
      "Store ISO date strings in the filter object",
      "Compute 'This week' presets only inside onClick",
      "Default the range to the current week on render",
      "Store Date objects so both sides share a type"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Strings serialize identically everywhere and reading the clock only in handlers keeps render deterministic. A default from the clock or Date objects differ between server and client."
  },
  {
    "q": "A chip says 'Symbol: NVDA' but the header badge shows 2 active. What design removes this class of bug?",
    "options": [
      "A sync effect between chips and headers",
      "One page-owned object that every surface reads",
      "Deriving chips from the URL on each render",
      "Storing each surface's state in context"
    ],
    "answer": 1,
    "expl": "Drift comes from separate copies. If every surface reads and writes one object, there is nothing to reconcile."
  },
  {
    "q": "Headers are built by getColumns(filters). Each filter change makes open popovers flash closed. Why?",
    "options": [
      "A new columns array remounts every header",
      "The filters object is too large to compare",
      "Popover state is stored in the columns",
      "The context provider re-renders the table root"
    ],
    "answer": 0,
    "expl": "A rebuilt columns array gives headers new identities and React remounts them. Read filters from context and keep columns a module constant."
  },
  {
    "q": "Which properties make the filter serializer's output canonical? Select all that apply.",
    "options": [
      "Default values are skipped",
      "List values are sorted before writing",
      "Keys are written in insertion order",
      "Values are base64 encoded"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Skipping defaults and sorting lists makes equivalent views produce identical strings, so they share cache entries. Insertion order would depend on click order."
  },
  {
    "q": "A user hand-edits the URL to ?status=banana. What should happen?",
    "options": [
      "The status filter is treated as empty",
      "A 400 error page from the BFF",
      "The table shows zero rows for banana",
      "The client redirects to the default view"
    ],
    "answer": 0,
    "expl": "A URL is user input. A .catch on each field degrades junk to 'no filter', which the chips row makes visible."
  },
  {
    "q": "For a server-driven table, why skip TanStack's ColumnFiltersState for header filters?",
    "options": [
      "It cannot represent multi-value filters",
      "It forces client-side filtering of all rows",
      "It adds untyped mappers both ways",
      "It breaks manualFiltering mode"
    ],
    "answer": 2,
    "expl": "The state must become request params and come back out of the URL anyway. An intermediate untyped layer adds two mappers and no value."
  }
]
```
