---
title: Data table basics - sort, filter, paginate
summary: Build a sortable, filterable, paginated table twice - once with plain React state for interviews, once with TanStack Table and shadcn/ui.
date: 2026-09-17
part: 1
tags: [tanstack-table, shadcn, interviews]
minutes: 16
---

## The big picture

> [!TLDR]
> A table is a pipeline: filter, then sort, then paginate. Every basic table bug
> is either the wrong order, an unstable column array, or a page index nobody reset.

The running example is **Meridian**, a fictional portfolio analytics app. This part
uses its Positions blotter: about 240 rows, all loaded into the browser at once.

| Part | What it is | Who owns it |
| --- | --- | --- |
| Data | An array of row objects | You |
| Column definitions | How to read a value and how to render it | You |
| Row pipeline | Rows on screen, derived from data + filter + sort + page | TanStack Table |
| Render | Header, body, controls | shadcn/ui markup, wired by you |

![TanStack Table hands rows to your component, your component maps them to JSX, and shadcn/ui supplies the styled table elements.](images/01-data-table-basics/headless-split.png)

"Headless" means TanStack renders nothing. It takes data, columns and state, and
hands back row models: arrays already filtered, sorted and sliced. Your component
is the glue.

## The interview version: plain state

> [!TLDR]
> Three pieces of state - query, sort, page. Everything on screen is derived from
> those plus the data, in one `useMemo`, in a fixed order.

![The row pipeline runs filter, sort, then paginate, and any change to the filter or sort sends the page back to 1.](images/01-data-table-basics/row-pipeline.png)

```ts
const { total, pageRows } = useMemo(() => {
  const filtered = filterPositions(positions, debouncedQuery); // 1. filter
  const sorted = sortPositions(filtered, sort);                 // 2. sort

  return {
    total: filtered.length,
    pageRows: paginate(sorted, page, PAGE_SIZE),               // 3. paginate
  };
}, [positions, debouncedQuery, sort, page]);
```

> [!STEPS]
> 1. **Filter first.** It shrinks the set you then have to sort.
> 2. **Sort a copy.** `Array.prototype.sort` mutates, so sort `[...rows]`.
> 3. **Paginate last.** A page is a window onto the final ordered list.
> 4. **Search named fields.** Matching `avgCost` gives results users cannot explain.

> [!NUANCE]
> - Check nulls **before** multiplying by the direction sign. Otherwise nulls flip
>   ends when the user flips the sort. Nulls go last in both directions.
> - `total` comes from the filtered list, not the page, or the footer lies.
> - The sort cycles asc, desc, off. Three states, not two.

> [!INTERVIEW]
> - *Why filter before sort?* Sorting is O(n log n); filtering first shrinks n.
> - *Where do nulls go when sorting descending?* Still last. Handle them before the sign flip.

## Resetting the page, and the follow-ups

> [!TLDR]
> Any change to the search, a filter or the sort must send the user back to
> page 1 - in the event handler, not in an effect.

```tsx
const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
  setQuery(event.target.value);
  setPage(1); // same event, same render
};
```

> [!NUANCE]
> - A `useEffect` watching `query` also resets the page, but only after one
>   render showing a wrong, often empty, page.
> - Without the reset users land on "page 7 of 2", staring at an empty table.
>   This happens in real production apps, not just interviews.
> - Debounce the filter, not the input. `query` stays bound to the `Input`; a
>   debounced copy feeds the `useMemo`.

The predictable follow-ups: a direction toggle, a page size control (reset to
page 1 on change), debounced search, nulls, and accessibility.

> [!INTERVIEW]
> - *Where does `aria-sort` go?* On the `th`, not the button inside it. The sort
>   icons are `aria-hidden` because the attribute already carries the meaning.
> - *Why is the sort control a real `Button`?* Keyboard focus and Enter/Space come free.

![The plain React version: a search box, six sortable headers, twenty rows and a page label](images/01-data-table-basics/interview-version.png)

## TanStack columns and identity

> [!TLDR]
> TanStack caches on the **identity** of `columns` and `data`. Declare columns at
> module scope, and always pass `getRowId`.

```tsx
const columnHelper = createColumnHelper<PositionRow>();

// Module scope: created once, same identity on every render.
export const positionColumns = [
  columnHelper.accessor("quantity", {
    header: "Quantity",
    cell: (info) => formatQuantity(info.getValue()), // typed as number
  }),
];

useReactTable({ data, columns: positionColumns, getRowId: (row) => row.id,
  getCoreRowModel: getCoreRowModel() });
```

> [!NUANCE]
> - The accessor returns the raw value and `cell` formats it, so sorting compares
>   numbers, never "$1,640,750".
> - Need a live handler in a cell? Keep the column constant and read the handler
>   from `table.options.meta` at render time. Augment `TableMeta` to type it.
> - Same rule for data: never `data={positions ?? []}` inline. `[]` is a new array
>   every render.
> - Every feature from here on is one more `get*RowModel` option plus one piece of state.

> [!GOTCHA]
> A column factory that closes over a page-level handler, called inside the
> component, returns a fresh `columns` array every render. The table rebuilds and
> remounts every cell, real clicks land on DOM nodes React already replaced, and
> the handler silently never runs. It looks like a flaky click; it is identity.

> [!INTERVIEW]
> - *What does `getRowId` fix?* Without it rows are keyed by index, so selection
>   or expansion follows the position, not the row, after a sort.

## Client-side pagination

> [!TLDR]
> One row model (`getPaginationRowModel`) and one piece of state
> (`{ pageIndex, pageSize }`, zero-based). Control it yourself so it can live in
> the URL later.

> [!STEPS]
> 1. **Hold `PaginationState` in `useState`.** Pass it via `state` and `onPaginationChange`.
> 2. **Count from `getPrePaginationRowModel()`.** That is filtered and sorted, not sliced.
> 3. **Label honestly.** "1-20 of 240", and "0 of 0" when empty - "0-0 of 0" is a range that does not exist.
> 4. **Drive buttons from the table.** `getCanPreviousPage()` / `getCanNextPage()`.

> [!NUANCE]
> - `autoResetPageIndex` is on by default, and a change in `data` counts. On a live
>   screen every refresh throws the user back to page 1.
> - Turn it off and the reset rule is your job again: reset `pageIndex` inside
>   `onSortingChange` and `onGlobalFilterChange`.

![The blotter on page 3 with 50 rows per page, the footer reading 101-150 of 240](images/01-data-table-basics/page-3-size-50.png)

## Sorting

> [!TLDR]
> `getSortedRowModel` plus `SortingState`, which is an array because multi-sort is
> built in. Signed numbers, nulls and custom orders each need one deliberate choice.

```tsx
const byMagnitude: SortingFn<PositionRow> = (rowA, rowB, columnId) =>
  Math.abs(rowA.getValue<number | undefined>(columnId) ?? 0) -
  Math.abs(rowB.getValue<number | undefined>(columnId) ?? 0);

columnHelper.accessor((row) => row.dayChangePct ?? undefined, {
  id: "dayChangePct",
  sortingFn: byMagnitude,  // written for ascending only
  sortUndefined: "last",   // applied before the direction flip
});
```

> [!NUANCE]
> - A `sortingFn` alone cannot put nulls last in both directions: TanStack flips
>   your comparator for descending. `sortUndefined: "last"` runs before the flip.
> - `sortUndefined` only sees `undefined`, which is why the accessor maps `null` to `undefined`.
> - Keep quantities signed. An accessor that returns "(4,000)" sorts text.
> - First click sorts strings ascending and numbers **descending** by default.
>   `sortDescFirst: false` makes everything start ascending.
> - Row model option order does not matter; TanStack always runs filter, sort, paginate.

> [!INTERVIEW]
> - *How do you show a tie-breaker in multi-sort?* `column.getSortIndex()`; render
>   "2" beside the secondary column. Cap it with `maxMultiSortColCount`.

## Filtering

> [!TLDR]
> One `getFilteredRowModel` serves both the search box (global filter) and the
> facets (column filters). Name your search fields yourself.

```ts
export const matchPosition: FilterFn<PositionRow> = (row, _columnId, value) => {
  const needle = String(value).trim().toLowerCase();

  if (needle === "") return true;

  return SEARCH_FIELDS.some((field) =>
    row.original[field].toLowerCase().includes(needle));
};
// useReactTable({ globalFilterFn: matchPosition,
//   getColumnCanGlobalFilter: (column) => column.id === "symbol" })
```

> [!NUANCE]
> - TanStack decides whether a column is globally searchable from the type of its
>   value in the **first row**. A column that is null on row 0 silently drops out of search.
> - `globalFilterFn` runs once per searchable column per row. Nominate one
>   never-null column to carry it, and read `row.original` directly.
> - A facet should use `filterFn: "equals"`. The default "includes" makes "FX"
>   match "FX Options" the day someone adds one.
> - Radix `Select` rejects an empty string value, so "All desks" is a sentinel
>   that sets the filter to `undefined`.

![Searching for "nvda" narrows the blotter to 18 NVIDIA positions and the footer reads 1-18 of 18](images/01-data-table-basics/search-nvda.png)

## Styling it to be read all day

> [!TLDR]
> Headers label, numbers align. Smaller muted header text, right-aligned
> `tabular-nums` for numerics, and real empty and loading states.

| Concern | Rule |
| --- | --- |
| Numeric columns | Right-aligned, `tabular-nums`, via `meta.className` |
| Narrow columns | Set `minSize` too, or `defaultColumn.minSize` wins |
| Sticky header | Scroll box on the shadcn `Table` container; fill on the `th` |
| Header rule | Inset shadow, because a bottom border does not travel with a sticky cell |
| Empty value | One shared `EmptyCell`, never blank |
| Empty result | Span `getVisibleLeafColumns().length`, so hidden columns do not break it |
| Loading | Five skeleton rows under the real header, so nothing jumps |
| Gain / loss | Two tokens (`--gain`, `--loss`), and keep the sign so colour is not the only signal |

> [!NUANCE]
> - TanStack resolves width as `min(max(minSize, size), maxSize)`. With an app-wide
>   `minSize: 200`, a column that sets `size: 80` still renders at 200px.
> - A `max-h-*` on a wrapper you add never makes the header stick: shadcn's `Table`
>   already scrolls its own `div`. Add a `containerClassName` prop instead.
> - A sticky `tr` does not carry its background. Put the fill on each `th`.

![TanStack resolves width as min(max(minSize, size), maxSize), so a column with size 80 and a default minSize of 200 renders at 200px until it sets its own minSize.](images/01-data-table-basics/column-width-resolution.png)

> [!WIN]
> The finished blotter: filter, sort and paginate in the right order, a page reset
> on every change, stable columns, and a table you can read for a whole trading day.

![The finished Positions blotter: muted headers, right-aligned tabular numerics, green and red PnL, an em-dash for a missing day change](images/01-data-table-basics/table-default.png)

```quiz
[
  {
    "q": "A candidate's table paginates, then filters the current page by the search box. What does the user see?",
    "options": [
      "Correct results, just computed less efficiently",
      "An error because the page index goes out of range",
      "Correct rows but the sort order is randomised",
      "Only this page's matches, wrong total"
    ],
    "answer": 3,
    "expl": "Paginating first means the filter only sees twenty rows, so matches on other pages vanish and the count is wrong. It is not merely inefficient; the order changes the result."
  },
  {
    "q": "Sorting descending by Day %, rows with no previous close jump to the top. The comparator returns sign * compare(a, b) with null checks inside compare. What is the fix?",
    "options": [
      "Map nulls to zero inside the accessor function",
      "Handle nulls before applying the direction sign",
      "Filter out rows with nulls before sorting",
      "Sort ascending and reverse the array afterwards"
    ],
    "answer": 1,
    "expl": "If the null check sits under the sign flip, nulls flip ends with the direction. Mapping to zero hides a real 'no value' and puts those rows mid-table."
  },
  {
    "q": "A teammate resets the page with useEffect(() => setPage(1), [query]). What is the visible cost?",
    "options": [
      "None, effects run before the browser paints",
      "One render showing a stale, often empty, page",
      "An infinite loop between query and page updates",
      "The page resets only after the debounce delay ends"
    ],
    "answer": 1,
    "expl": "The effect runs after a render has already committed with the new query and the old page. Resetting in the same handler that sets the query avoids that frame."
  },
  {
    "q": "Buttons inside a TanStack cell sometimes do nothing when clicked. The columns come from buildColumns({ onOpen }) called in the component body. Most likely cause?",
    "options": [
      "The onOpen handler is a stale closure from mount",
      "flexRender swallows click events inside cells",
      "getRowId is missing so the row id is undefined",
      "A new columns array each render remounts every cell"
    ],
    "answer": 3,
    "expl": "TanStack caches on column identity, so a fresh array rebuilds the model and React replaces the cell nodes under the click. A stale closure would call the wrong handler, not silently call none."
  },
  {
    "q": "Which change keeps the columns stable while still giving cells the current page handler?",
    "options": [
      "Read the handler from table.options.meta at render",
      "Wrap buildColumns in useCallback with no dependencies",
      "Store the handler in a module-level mutable variable",
      "Pass the handler through the row data objects"
    ],
    "answer": 0,
    "expl": "Constant module-scope columns plus meta keeps identity stable and reads the live value when the cell renders. A module variable leaks across instances and requests."
  },
  {
    "q": "A user selects three rows, then sorts by market value. Three different rows now look selected. What was missing?",
    "options": [
      "A controlled rowSelection state object",
      "enableRowSelection on the table options",
      "getRowId returning the position id",
      "A stable key on each TableRow element"
    ],
    "answer": 2,
    "expl": "Without getRowId TanStack keys rows by index, so selection sticks to positions 0, 4 and 7 rather than to the rows. A React key fixes DOM reuse, not TanStack's row identity."
  },
  {
    "q": "On a live-updating blotter, users keep getting thrown back to page 1 every few seconds. Which option explains it?",
    "options": [
      "manualPagination defaulting to false",
      "pageSize reverting to its initialState value",
      "getPaginationRowModel recomputing on every tick",
      "autoResetPageIndex treating new data as a reset"
    ],
    "answer": 3,
    "expl": "autoResetPageIndex is on by default and a change to data counts. Turning it off means you must reset the page yourself on sort and filter changes."
  },
  {
    "q": "The pagination footer shows 1-20 of 20 while the search matches 57 rows. Which row model is the footer counting?",
    "options": [
      "getCoreRowModel, which ignores filters entirely",
      "getPrePaginationRowModel, which is filtered and sorted",
      "getRowModel, which is already sliced to the page",
      "getFilteredRowModel, which has not been sorted yet"
    ],
    "answer": 2,
    "expl": "getRowModel is the end of the pipeline, so it holds one page. The total belongs to getPrePaginationRowModel, filtered and sorted but not sliced."
  },
  {
    "q": "Which statements about putting nulls last in both sort directions with TanStack are true? Select all that apply.",
    "options": [
      "sortUndefined: 'last' is applied before the direction flip",
      "A custom sortingFn alone handles it in both directions",
      "sortUndefined ignores null, so map null to undefined",
      "Setting sortDescFirst: false keeps nulls at the end"
    ],
    "answer": [
      0,
      2
    ],
    "multi": true,
    "expl": "TanStack negates your comparator for descending, so a sortingFn cannot pin nulls. sortUndefined runs before the flip but only checks undefined. sortDescFirst only changes the first-click direction."
  },
  {
    "q": "The global search stops finding traders, but only on days when the first position has no trader assigned. Why?",
    "options": [
      "The includes filter is case-sensitive by default",
      "Searchability is inferred from the first row's value type",
      "Global filters skip string columns with nulls",
      "The debounce drops the first character typed"
    ],
    "answer": 1,
    "expl": "TanStack checks the type of the first row's value to decide whether a column is globally filterable. A null there silently removes the column, which is why you name fields in globalFilterFn."
  },
  {
    "q": "Someone adds an 'FX Options' desk and the FX facet now shows its rows too. What fixes it?",
    "options": [
      "Set filterFn: 'equals' on the desk column",
      "Trim whitespace from the desk values",
      "Move the desk into the global search fields",
      "Use a sentinel value for the 'All desks' option"
    ],
    "answer": 0,
    "expl": "The default string filter is an includes match, so 'FX' matches 'FX Options'. A facet is an exact choice. The sentinel is about Radix rejecting empty strings, a different problem."
  },
  {
    "q": "A narrow Ccy column sets size: 80 but renders 200px wide. The app sets defaultColumn: { minSize: 200 }. What is the fix?",
    "options": [
      "Set minSize: 80 on the column alongside size",
      "Set maxSize: 80 on the column instead of size",
      "Lower the global maxSize to 800 pixels",
      "Apply a w-20 class to the column's cells"
    ],
    "answer": 0,
    "expl": "Width resolves as min(max(minSize, size), maxSize), so the inherited minSize of 200 wins. maxSize: 80 would also clamp it, but the intended declaration is the column's own minSize."
  },
  {
    "q": "Which are needed for a sticky header that does not show rows scrolling behind it? Select all that apply.",
    "options": [
      "A scroll container on the table's own wrapper div",
      "A background colour on each th cell",
      "A max-height on a parent div you add yourself",
      "A background colour on the sticky tr element"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "shadcn's Table already scrolls its own div, so a max-height on an outer parent never makes the header stick. A sticky tr does not carry its fill, so it has to be on each th."
  },
  {
    "q": "Why does the PnL column format negative values with a minus sign even though they are already red?",
    "options": [
      "Screen readers cannot announce CSS colour values",
      "Tabular numerals require an explicit sign glyph",
      "So the table still reads without colour",
      "Sorting would otherwise treat values as positive"
    ],
    "answer": 2,
    "expl": "Colour should never be the only signal: colour-blind readers, printouts and greyscale screens all lose it. Sorting runs on the raw number, not the formatted string."
  },
  {
    "q": "The empty-state row spans a hardcoded 8 columns. A user hides two columns. What happens?",
    "options": [
      "The row still spans correctly because hidden columns keep width",
      "TanStack recalculates colSpan on the row automatically",
      "Hidden columns reappear to fill the extra span",
      "The empty message overflows past the visible header"
    ],
    "answer": 3,
    "expl": "A hardcoded colSpan no longer matches the visible column count, so the cell extends past the header. Spanning getVisibleLeafColumns().length keeps it correct."
  }
]
```
