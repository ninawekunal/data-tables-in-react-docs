---
title: Column header filters with shadcn Popover
summary: Spreadsheet-style filters in the column header, backed by one typed filter object that feeds every surface, the URL and the BFF.
date: 2026-09-17
part: 7
tags: [filters, shadcn, state-design]
minutes: 16
---

## The big picture

> [!TLDR]
> The title opens the filter, a small button sorts. Each popover drafts locally and
> commits on Apply. One page-owned filter object feeds every surface through one serializer.

![The Trade orders blotter with filterable column headers: each filterable title has a funnel and a separate sort button, and plain headers sit at the same height](images/07-column-header-filters-popover/default.png)

| Surface | Reads | Writes |
| --- | --- | --- |
| Header popovers | `filters[key]` | `updateFilters({ key })` on Apply |
| "All filters" panel | A draft copy of `filters` | `updateFilters(draft)` on Apply |
| Chips row | `buildChips(filters)` | The patch that removes one value |
| URL, list request, CSV, query key | One serializer | - |

A header filter sits where the eyes already are, so nobody translates "this column"
into "that field in a form". It is the wrong tool for cross-column OR logic and for
saved views, which snapshot the whole object and belong in the toolbar.

## Design the state before the UI

> [!TLDR]
> One plain object, one key per thing a user can narrow. Strings, numbers, string
> arrays or `null` - so it survives a URL round trip and a server render.

```ts
export type OrderFilters = {
  symbols: string[];
  statuses: OrderStatus[];
  quantityMin: number | null;
  quantityMax: number | null;
  submittedFrom: string | null; // ISO date, "2026-09-17"
  submittedTo: string | null;
};
```

> [!NUANCE]
> - `countActiveFilters` counts **groups**, not values. A min and a max together are one active filter.
> - No `Date` objects in state. `Date` exists only inside the date popover.

## The filter header

> [!TLDR]
> One click target cannot mean both sort and filter. A sort is one click, so it
> survives a small target. A filter is multi-step, so it gets the title.

> [!STEPS]
> 1. **Title is the popover trigger.** Children receive `close` (dismiss after Apply) and `open` (gate fetching).
> 2. **Indicator shows state.** Muted funnel when inactive; `text-primary` title and a count `Badge` when active.
> 3. **Sort is a separate icon button** that shows direction, because a column can be sorted and filtered at once.
> 4. **Each body marks its own control with `autoFocus`.** Radix would otherwise focus the first tabbable element - for the calendar, a preset button.

> [!NUANCE]
> - No `aria-label` on a trigger with visible text: it would replace the title, and
>   voice-control users say the title they see. Add context in a visually hidden
>   span, so it reads "Status, filter, 2 active".
> - The icon-only trigger for narrow columns is the exception - it has no visible text, so it needs a label.
> - A filtered table that does not look filtered reads as broken data.
> - If sorting lives in a toolbar popover instead, the active sort becomes invisible once it closes. Add a sort chip.

![Orders blotter with the Symbol popover open under its title, the sort icon button beside the title and the option list loaded](images/07-column-header-filters-popover/symbol-popover-open.png)

## Draft, Apply, Clear

> [!TLDR]
> In a server-driven table, every committed tick is a request and a history entry.
> Draft in `useState`, commit once on Apply, and let Escape or an outside click discard.

![Committing on every tick fires one request and one history entry per tick, while a draft that commits on Apply fires one request, and Escape or an outside click discards the draft by unmounting the body](images/07-column-header-filters-popover/draft-apply-commit.png)

> [!NUANCE]
> - There is no effect that resets the draft on open. `PopoverContent` unmounts its
>   children on close, so the body mounts fresh and `useState` re-reads the
>   committed value. Discard-on-escape is the same mechanism. `forceMount` would break both.
> - A popover's Clear resets only its **draft**. Table-level "Clear all" lives with
>   the chips. Mixing the two confuses users.
> - Hide Clear when there is nothing to clear.

## Searchable options, ranges and dates

> [!TLDR]
> Big option lists come from the server, lazily, from the **unfiltered** baseline.
> Ranges draft as strings. Dates cross into `Date` only inside the popover.

> [!NUANCE]
> - The body takes a hook, `useOptions(enabled)`, not an options array. `enabled: open`
>   means no request until the popover opens; `staleTime: Infinity` makes the second open instant.
> - Options from filtered rows collapse to the one symbol you picked, so you can never add a second.
> - Selected items sort first by the **committed** value, not the draft - or every tick moves the row out from under the cursor.
> - cmdk `keywords` let "nvidia" find `NVDA`. The `Checkbox` is decoration; the `CommandItem` is the control.
> - An options error renders with retry, never as an empty list. "No symbols" and "the request failed" are different facts.
> - Range drafts are two strings, because a half-typed input is not a number. Parse and validate on every render - never store the parsed value.
> - One `error` value drives `aria-invalid`, the message and the disabled Apply.

> [!GOTCHA]
> `new Date("2026-09-17")` parses as **UTC midnight**, which is still the 16th in New
> York - so the calendar highlights the wrong day. Convert with local calendar
> fields (`new Date(y, m - 1, d)`), store ISO date strings, and let the BFF decide
> where a trading day starts. Compute presets like "This week" only inside `onClick`,
> so nothing in render reads the clock.

![Submitted popover with Today and This week presets above a range calendar, three days selected, and the Clear and Apply footer](images/07-column-header-filters-popover/date-range-popover.png)

## One object, many surfaces

> [!TLDR]
> The usual bug is drift: a chip says one thing and a header badge another. The fix
> is to have nothing to keep in sync - one object, one write path.

![The page owns one OrderFilters object that header popovers, the All filters panel and the chips row read and write, and one serializer turns it into the URL, the list request, the CSV link and the query key](images/07-column-header-filters-popover/one-filter-object.png)

> [!STEPS]
> 1. **Own it in the page.** Expose `filters` and `updateFilters(patch)` through context.
> 2. **Reset `page` inside `updateFilters`.** Page 7 of the unfiltered list does not exist in a list of 12.
> 3. **Build chips as a pure function.** Each chip carries the patch that removes only its value.
> 4. **Give the panel its own draft.** Same rule one level up: copy on open, commit on Apply.

> [!NUANCE]
> - Use context, not a `getColumns(filters)` factory. A columns array rebuilt on every
>   filter change gives each header a new identity and React remounts it.
> - Pin option pickers inside the panel to `side="bottom" align="start"`, so a picker
>   never covers the next field the user wants to fill.

![Blotter with Symbol, Status and Quantity badges active, the matching chips row, and the All filters sheet open showing the same symbols, status and minimum quantity](images/07-column-header-filters-popover/all-filters-panel.png)

## URL, BFF and TanStack column filters

> [!TLDR]
> One function writes the object to `URLSearchParams`; one zod schema reads it back,
> on the client **and** in the BFF loader.

> [!NUANCE]
> - Canonical output: skip defaults, fixed key order, sorted list values. Ticking
>   NVDA then AAPL gives the same string as the reverse, so equivalent views share a cache entry.
> - Every field has a `.catch`, so a hand-edited `?status=banana` degrades to "no filter", not an error page.
> - The list query, prefetch and CSV link use one serializer, so the export cannot encode a different view than the screen.
> - For a **client-side** table, TanStack's `filterFn: "arrIncludesSome"` plus
>   `getFacetedUniqueValues` gives options with counts for free, and the same header works.
> - For a server table, `ColumnFiltersState` in the middle means a mapper each way
>   with `value: unknown` at every step. Skip it.

> [!INTERVIEW]
> - *What did the unused filter API teach?* A shared kit shipped a second header-filter
>   API bound to TanStack column filters. No feature adopted it; it became dead code.
>   Build the abstraction after the second real call site, not before the first.

| Styling rule | Value |
| --- | --- |
| Filter and plain headers | Same `h-8`, `text-xs`, `font-medium` |
| Popover widths | `w-64` picker, `w-72` range, `w-auto` calendar |
| Alignment | `align="start"`, so the popover edge lines up with its title |
| Focus ring | Keep it; switch to inset if a sticky header clips it |
| `header` column prop | The component itself, so its identity never changes |

> [!WIN]
> Filter on the title, sort on a button, draft locally, commit on Apply - and every
> surface, the URL and the export agree because there is only one object.

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
