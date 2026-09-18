---
title: Data table basics - sort, filter, paginate
summary: Build a sortable, filterable, paginated table twice - once with plain React state for interviews, once with TanStack Table and shadcn/ui.
date: 2026-09-17
part: 1
series: Data Tables in React
tags: [tanstack-table, shadcn, interviews]
minutes: 16
---

## The big picture

> [!TERMS]
> - **Row** - one record on screen, like one stock position.
> - **Column definition** - a small object that says how to read one value out of a row and how to draw it.
> - **Pipeline** - a fixed series of steps the rows go through, where each step takes the previous step's output.
> - **Headless library** - a library that does the logic but draws nothing; you supply the HTML.
> - **TanStack Table** - the headless table library this series uses.
> - **shadcn/ui** - a set of copy-into-your-project React components; here, the styled table pieces.
> - **State** - a value React remembers between renders, like "which page am I on".
> - **Render** - React running your component function to work out what the screen should show.

> [!TLDR]
> Every table on screen is the result of three steps done in a strict order: filter, then sort, then cut out one page.
> Most basic table bugs come from doing those steps in the wrong order, or forgetting to go back to page 1.

Picture a spreadsheet of about 240 stock positions.
A trader types "NVDA" in a search box, clicks a column to sort it, and flips through pages of 20.
That is the whole job of this part.

We use one made-up app all series long, called **Meridian**.
Its "Positions blotter" is a table of the positions a trading desk holds.
"Blotter" is just trading slang for "the table of what we have right now".

Every data table, in any library, has four parts:

| Part | What it is | Who writes it |
| --- | --- | --- |
| Data | The array of row objects | You |
| Column definitions | How to read and draw each value | You |
| Row pipeline | Filter, sort, page | TanStack Table (or you, in an interview) |
| Markup | The actual `<table>` HTML and controls | shadcn/ui pieces, wired up by you |

![TanStack Table hands rows to your component, your component maps them to JSX, and shadcn/ui supplies the styled table elements.](images/01-data-table-basics/headless-split.png)

> [!ANALOGY]
> TanStack Table is the kitchen and shadcn/ui is the plates.
> The kitchen prepares the food (which rows, in what order), the plates make it look good, and your component is the waiter carrying one to the other.

## The interview version: plain state

> [!TLDR]
> In an interview you get no library.
> You keep three pieces of state - the search text, the sort, and the page number - and work out the visible rows from them every time.

Here is the key idea.
You never store "the rows on screen" anywhere.
You store only what the user chose, and you *calculate* the rows from that, on every render.
That calculation is called **derived state**: it is derived from other state, so it can never fall out of sync.

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

`useMemo` just means "only redo this calculation when one of these inputs changes".

> [!STEPS]
> 1. **Filter first.** Throw away rows that do not match the search. Now there is less to sort.
> 2. **Sort a copy.** JavaScript's `.sort()` changes the array you call it on, so sort `[...rows]`, a fresh copy.
> 3. **Paginate last.** A page is a window onto the *finished* list. Cut it out at the very end.
> 4. **Search named fields only.** Match symbol, name and trader. Matching every field finds rows by numbers the user cannot see, which looks broken.

Why does the order matter so much?
If you paginate first, you cut out 20 rows and then search only those 20.
A match on page 5 simply disappears.

> [!NUANCE]
> - Empty values (like "no price yet") should sit at the bottom whether you sort up or down.
>   Handle them *before* you flip the direction, or they jump to the top when the user flips the sort.
> - The total in the footer must count the filtered rows, not the page, or it says "20" when 57 matched.
> - Clicking a header cycles three ways: ascending, descending, then off.

> [!INTERVIEW]
> - *Why filter before sort?* Sorting costs more as the list grows, so shrink the list first.
> - *Where do empty values go when sorting descending?* Still at the bottom. Handle them before applying the direction.

## Going back to page 1

> [!TLDR]
> Whenever the user changes the search, a filter or the sort, jump back to page 1.
> Do it in the same click or keystroke handler, not later.

Imagine you are on page 7 and you type a search that matches only 12 rows.
There is no page 7 any more.
Without a reset you are staring at an empty table that says "page 7 of 1".

```tsx
const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
  setQuery(event.target.value);
  setPage(1); // same event, so React shows both changes together
};
```

> [!NUANCE]
> - You *could* reset the page in a `useEffect` that watches the search text.
>   A `useEffect` runs *after* the screen has already updated, so the user sees one wrong frame first.
> - **Debouncing** means waiting until the user pauses typing before doing the work.
>   Keep the input box instant; debounce only the filtering.

Interviewers tend to ask the same follow-ups: a page-size picker (reset to page 1 when it changes), debounced search, empty values, and accessibility.

> [!INTERVIEW]
> - *Where does `aria-sort` go?* `aria-sort` tells a screen reader how a column is sorted. It goes on the header cell (`th`), not on the button inside it.
> - *Why make the header a real `Button`?* Keyboard users can tab to it and press Enter, for free.

![The plain React version: a search box, six sortable headers, twenty rows and a page label](images/01-data-table-basics/interview-version.png)

## Columns, and why "the same object" matters

> [!TLDR]
> Create your column definitions once, outside the component.
> Always tell TanStack how to find each row's real id with `getRowId`.

React and TanStack both check whether things changed by asking "is this the *same object* as last time?", not "does it look the same?".
Programmers call this **identity**.
Two arrays with identical contents are still two different objects.

So if you build the columns array inside your component, you build a brand new array on every render.
TanStack sees "new columns!" every time and rebuilds everything.

```tsx
const columnHelper = createColumnHelper<PositionRow>();

// Outside the component: made once, the same object forever.
export const positionColumns = [
  columnHelper.accessor("quantity", {
    header: "Quantity",
    cell: (info) => formatQuantity(info.getValue()), // TypeScript knows this is a number
  }),
];
```

An **accessor** is the part that reads the raw value (`quantity`).
The `cell` is the part that draws it ("12,500").
Sorting uses the raw value, so numbers sort as numbers, not as text like "$1,640,750".

> [!GOTCHA]
> Here is a real bug that looks like a flaky button.
> A page built its columns inside the component so a cell button could call a page handler.
> Every render made a new columns array, TanStack rebuilt every cell, and React swapped the button out from under the user's mouse.
> The click landed on a button that no longer existed, so nothing happened.
> The fix: keep columns outside the component, and pass live handlers through the table's `meta` option, which cells can read when they draw.

> [!NUANCE]
> - The same rule applies to data. `data={positions ?? []}` creates a new empty array every render. Use a constant empty array instead.
> - From here on, every table feature is the same recipe: turn on one "row model" option and add one piece of state.

> [!INTERVIEW]
> - *What does `getRowId` fix?* Without it, TanStack names rows "0, 1, 2..." by position. Tick row 0, sort, and a different position is now row 0 - and looks ticked.

## Pagination with TanStack

> [!TLDR]
> Turn on `getPaginationRowModel` and keep `{ pageIndex, pageSize }` in your own state.
> `pageIndex` starts at 0, not 1.

A **row model** is TanStack's name for "the list of rows after a step".
There is one for filtering, one for sorting, one for paging.
You switch each one on by passing it in.

> [!STEPS]
> 1. **Hold the page in `useState`.** Owning it yourself means you can later put it in the URL.
> 2. **Count the total before the page is cut.** `getPrePaginationRowModel()` is the filtered, sorted list before slicing.
> 3. **Label the footer honestly.** "1-20 of 240", and "0 of 0" when nothing matches. "0-0 of 0" describes a range that does not exist.
> 4. **Let the table drive the buttons.** `getCanNextPage()` tells you whether Next should be enabled.

> [!NUANCE]
> - TanStack resets to page 1 for you by default (`autoResetPageIndex`).
>   But it also does it when the data refreshes, so on a live screen the user is thrown back to page 1 every few seconds.
> - If you switch that off, resetting on search and sort is your job again.

![The blotter on page 3 with 50 rows per page, the footer reading 101-150 of 240](images/01-data-table-basics/page-3-size-50.png)

## Sorting with TanStack

> [!TLDR]
> Turn on `getSortedRowModel` and keep the sort in state.
> Three columns need a deliberate choice: signed numbers, empty values and custom orders.

```tsx
columnHelper.accessor((row) => row.dayChangePct ?? undefined, {
  id: "dayChangePct",
  sortingFn: byMagnitude,  // biggest move first, up or down
  sortUndefined: "last",   // empty values stay at the bottom
});
```

A **sorting function** compares two rows and returns a negative number, zero or a positive number, just like the function you pass to `.sort()`.
You write it for ascending order only; TanStack flips it for descending.

> [!NUANCE]
> - That flip is why your own sorting function cannot keep empty values at the bottom: the flip moves them to the top.
>   `sortUndefined: "last"` runs *before* the flip, so it works.
> - `sortUndefined` only notices `undefined`, not `null`. That is why the accessor turns `null` into `undefined`.
> - Keep quantities as signed numbers (-4,000 for a short position). If the accessor returns the text "(4,000)", it sorts alphabetically.
> - On the first click, TanStack sorts text A to Z but numbers **largest first**. `sortDescFirst: false` makes everything start ascending.

> [!INTERVIEW]
> - *How do you sort by two columns?* Shift-click the second one. TanStack keeps an array of sorts; `getSortIndex()` tells you which one is the tie-breaker.

## Filtering with TanStack

> [!TLDR]
> One filtering row model powers both the search box and dropdown filters.
> Write your own search function that names exactly which fields it checks.

A **global filter** is the search box: it looks across the whole row.
A **column filter** narrows one column, like "Desk is FX".

```ts
export const matchPosition: FilterFn<PositionRow> = (row, _columnId, value) => {
  const needle = String(value).trim().toLowerCase();

  if (needle === "") return true;

  return SEARCH_FIELDS.some((field) =>
    row.original[field].toLowerCase().includes(needle));
};
```

> [!NUANCE]
> - TanStack guesses which columns are searchable by looking at the **first row only**.
>   If that row happens to have an empty trader, the trader column silently stops being searchable.
>   Naming the fields yourself avoids the guess.
> - A dropdown filter should match exactly (`filterFn: "equals"`). The default "contains" match means "FX" also matches "FX Options".
> - The dropdown component refuses an empty value, so "All desks" uses a stand-in value that clears the filter.

![Searching for "nvda" narrows the blotter to 18 NVIDIA positions and the footer reads 1-18 of 18](images/01-data-table-basics/search-nvda.png)

## Making it easy to read all day

> [!TLDR]
> Headers are labels, so make them small and quiet.
> Numbers line up on the right with equal-width digits, so a trader can compare them at a glance.

`tabular-nums` is a font setting that makes every digit the same width, so columns of numbers line up like a ledger.

| Concern | What to do |
| --- | --- |
| Number columns | Right-aligned, `tabular-nums` |
| Narrow columns | Set `minSize` as well as `size` |
| Header that stays put while scrolling | Put the fill colour on each header cell, not the row |
| Missing value | One shared "empty" marker, never a blank |
| No results | A clear message that spans every visible column |
| Loading | A few grey placeholder rows under the real header, so nothing jumps |
| Gains and losses | Colour tokens, plus the + or - sign so colour is not the only clue |

> [!NUANCE]
> - TanStack works out a width as "at least `minSize`, at most `maxSize`".
>   If the whole app says `minSize: 200`, a column asking for 80px still gets 200px until it sets its own `minSize`.
> - A sticky row (`position: sticky`) does not carry its background colour, so rows scroll visibly behind the header text. Colour each header cell instead.

![TanStack resolves width as min(max(minSize, size), maxSize), so a column with size 80 and a default minSize of 200 renders at 200px until it sets its own minSize.](images/01-data-table-basics/column-width-resolution.png)

> [!WIN]
> The finished table filters, sorts and pages in the right order, goes back to page 1 whenever it should, keeps its columns stable, and is comfortable to read for a whole trading day.

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
