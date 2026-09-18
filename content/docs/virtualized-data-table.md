---
title: Virtualizing a table - and when you should not
summary: Measure first, try a render cap, then wire useVirtualizer into a shadcn Table with spacer rows, measured heights, memoized rows and jsdom tests.
date: 2026-09-17
part: 3
tags: [virtualization, performance, testing]
minutes: 17
---

## The big picture

> [!TLDR]
> Virtualization is the last tool, not the first. Count mounted rows and time a
> render before changing anything - pagination or a render cap usually wins.

The Executions tape shows every fill for one trading day: 50,000 rows in one
scrollable panel, streamed in as the day goes on, and any fill can expand to show
its parent order. The first version mounted every row and the tab froze.

![A decision flow: a paginated list stops at pagination, light rows or a searched list get a render cap, and only an un-paginated list of heavy rows that people scroll through gets virtualized](images/03-virtualized-data-table/virtualize-decision.png)

| Question | If "no" |
| --- | --- |
| Is the list un-paginated? | Paginate. One page is all that reaches the DOM |
| Are the rows heavy? | A render cap is enough |
| Must the user scroll one continuous list? | Paginate or cap |

Only three "yes" answers earn a virtualizer. Plenty of production table systems
with dozens of tables never virtualize, on purpose, because every table paginates.

## Measure before you fix

> [!TLDR]
> Get two numbers: mounted row count, read straight off the DOM, and render time
> from a `Profiler`. Then decide.

> [!STEPS]
> 1. **Seed your data.** A seeded PRNG (mulberry32) gives server, browser and tests the same tape.
> 2. **Count real rows.** Query the DOM, so a virtualizer cannot fake the number.
> 3. **Time the render.** `Profiler` reports React's time in development builds only - treat it as relative.
> 4. **Time the interaction.** Layout and paint are invisible to React; measure them separately.

> [!NUANCE]
> - A classic trigger: an un-paginated line list where a 500-line document mounted
>   500 rows **and 500 dropdown menus** the moment someone chose "All".
> - Heavy off-screen DOM taxes the whole page, not just scrolling. Keeping 20 heavy
>   pages mounted in a document viewer made every layout pass roughly 12x slower
>   (about 40 ms versus 3 ms).

![The finished Executions tape at the top of the day, with the toolbar reading Mounted rows: 25 of 50,000](images/03-virtualized-data-table/tape-top.png)

## Cheaper alternatives that often win

> [!TLDR]
> 50,000 fills in memory is fine. 50,000 `<tr>` elements is not. Pagination and a
> render cap both limit mounted rows without any scroll math.

```tsx
const [visibleCount, setVisibleCount] = useState(STEP); // STEP = 20

// render fills.slice(0, visibleCount), then a sticky footer:
<Button onClick={() => setVisibleCount((n) => n + STEP)}>Show 20 more</Button>
```

> [!NUANCE]
> - The "Show more" button fetches nothing. Only `visibleCount` changes.
> - Put it `sticky bottom-0` inside the scroll box so it is always reachable.
> - A deliberate "do not virtualize" call on a 455-row activity feed is a good
>   decision, not laziness: hand-rolled virtualizers are a known maintenance regret.

![The recent fills panel after one click: 40 of 2,676 rows mounted, with the sticky Show 20 more button at the bottom of the box](images/03-virtualized-data-table/render-cap-tab.png)

## Wiring useVirtualizer into a table: spacer rows

> [!TLDR]
> In a table, window with two spacer rows - one above, one below - so body and
> sticky header stay in one table layout and share column widths.

![The scroll box holds a sticky header, a tall empty spacer row, the 25 mounted rows, and a second spacer row below them, so the scrollbar reads as 50,000 rows while only 25 exist](images/03-virtualized-data-table/windowed-body-spacer-rows.png)

```ts
const items = virtualizer.getVirtualItems();

export const getSpacerHeights = (items: VirtualItem[], total: number) => ({
  paddingTop: items.length > 0 ? items[0].start : 0,
  paddingBottom: items.length > 0 ? total - items[items.length - 1].end : 0,
});
// <SpacerRow height={paddingTop} /> {rows} <SpacerRow height={paddingBottom} />
```

> [!STEPS]
> 1. **Let the outer box scroll.** shadcn wraps `<table>` in an `overflow-x-auto` div, which captures sticky children; pass `containerClassName="overflow-visible"`.
> 2. **Key measurements by id.** `getItemKey` returns the fill id, in a `useCallback`, so inserted rows do not inherit the wrong height.
> 3. **Render spacers `aria-hidden`.** Screen readers skip them.
> 4. **Virtualize the row model**, not the raw array, if the table uses TanStack Table.

> [!NUANCE]
> - The docs' technique - absolutely positioned items with transforms - suits card
>   lists and chat logs. An absolutely positioned `<tr>` leaves table layout; cells
>   stop lining up and you hard-code every width twice.
> - Compute the window synchronously from `scrollTop`. `IntersectionObserver`
>   callbacks arrive after the frame, and a stale window shows blank content.
>   Blank-but-fast is a worse bug than slow.

## The scroll element must be state, not a ref

> [!TLDR]
> If the virtualizer lives in a child of the scroll box, pass the element down as
> **state**. A ref is still `null` when the child's layout effect reads it.

![Two timelines side by side: with a ref, the child's layout effect runs before the parent's ref attaches and the body stays empty; with state, the setter runs as the ref, the parent re-renders, and the child attaches to a real element](images/03-virtualized-data-table/scroll-element-ref-vs-state.png)

```tsx
const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

// <div ref={setScrollElement} className="h-[600px] overflow-y-auto">
//   <TapeBody scrollElement={scrollElement} />

useVirtualizer({
  getScrollElement: () => scrollElement,
  initialRect: { width: 1024, height: 600 }, // first window, even on the server
});
```

> [!GOTCHA]
> React runs layout effects children-first in the same commit it attaches refs.
> So the child's `useVirtualizer` reads `scrollRef.current` while it is still
> `null`, attaches no observers, and nothing ever re-runs it - writing to a ref
> does not render. The symptom is a header over an empty body on first render.
> A state setter is a valid callback ref: the element's arrival becomes a render.

> [!INTERVIEW]
> - *Why `initialRect`?* Until measured, the virtualizer thinks the viewport is 0px
>   tall and renders nothing - including on the server.

## Variable heights and memoized rows

> [!TLDR]
> Measure each row with `measureElement`, keep row state in the parent, and
> compare row props field by field so a keystroke re-renders one row, not all of them.

> [!STEPS]
> 1. **Give every row `data-index` and `ref={virtualizer.measureElement}`.** The estimate is only a seed; a ResizeObserver re-measures on wrap.
> 2. **Model the detail row as its own item.** A `<tr>` cannot hold a block under its cells; a pure index mapping shifts later fills by one.
> 3. **Lift expanded state to the parent.** A windowed row unmounts when scrolled away and takes its state with it.
> 4. **Compare props field-wise.** A per-row `draft` object is rebuilt every render; `memo` with a shallow-equal on that one prop fixes it.
> 5. **Pass one stable handler that takes an id.** An inline `() => toggle(id)` defeats the memo on every row.

> [!NUANCE]
> - `scrollPaddingEnd` must account for the sticky header covering the top 40px.
> - A pure `selectFills` that returns the **same array** when no filter is active
>   keeps `getItemKey` stable and saves a full recompute.
> - A parent form that rebuilds every row's buffer object on each keystroke, with
>   identity `memo`, re-renders every mounted row per keystroke. That is a real
>   production bug shape.

![Row 5 expanded: the order panel shows the parent order, a note field and a flag button, and the footer reads Row 5 open](images/03-virtualized-data-table/row-expanded.png)

## Finding rows and testing in jsdom

> [!TLDR]
> After windowing, the 412th fill is not the 412th `<tr>`. Scroll by index, find by
> `data-*` id. And jsdom has no layout, so shim the few numbers the virtualizer reads.

> [!NUANCE]
> - "Jump to fill": `scrollToIndex`, then retry the `querySelector` once per frame
>   (up to ten), because the row does not exist when `scrollToIndex` returns.
> - The row needs `tabIndex={-1}` to accept focus. Call the helper from an event
>   handler, never during render - the app also renders on the server.
> - jsdom shims: `offsetHeight`/`offsetWidth` (box and row sizes),
>   `scrollHeight`/`clientHeight` (large content, or `scrollToIndex` pins to the
>   top), and `scrollTo`, which jsdom does not implement. Fire the scroll event in
>   a microtask, like a browser.
> - Assert that **some** rows mount and **most** do not. Zero mounted rows catches the ref bug.

| Styling need | Why |
| --- | --- |
| `table-fixed` with explicit header widths | Auto layout sizes columns from whichever rows are mounted, so they shift while scrolling |
| Sticky classes on each `th` | A collapsed border does not travel with a sticky cell; use an inset shadow |
| Fixed-width side badges | "buy" vs "sell" would otherwise wobble the column |
| `tabular-nums` on counters | Stops the toolbar twitching as fills stream in |

> [!WIN]
> 50,000 fills, about 35 rows in the DOM at any scroll position, stable columns, and
> a test that fails if anyone reintroduces the ref bug.

![The finished Executions tape: sticky muted header, buy and sell badges, row numbers, a flagged fill with its order panel open and a note typed, and a footer strip reading Showing 50,000 fills](images/03-virtualized-data-table/tape-finished.png)

```quiz
[
  {
    "q": "A paginated table of 50 rows per page feels slow. A teammate proposes adding a virtualizer. Best first response?",
    "options": [
      "Measure first; 50 rows is rarely the DOM problem",
      "Agree, virtualization always reduces render cost",
      "Agree, but only with absolutely positioned rows",
      "Replace pagination with an infinite scroll instead"
    ],
    "answer": 0,
    "expl": "A paginated table already caps mounted rows. The cost is almost certainly elsewhere, so measure mounted rows and render time before adding scroll math."
  },
  {
    "q": "A side panel lists recent fills, usually a few hundred, light rows. What fits best?",
    "options": [
      "A full virtualizer with measured heights",
      "Server-side pagination behind a BFF route",
      "A render cap with a Show 20 more button",
      "Mounting all rows with content-visibility auto"
    ],
    "answer": 2,
    "expl": "Light rows in a bounded panel only need a cap. It adds no scroll math and fetches nothing."
  },
  {
    "q": "A virtualized table uses absolutely positioned rows. What is the typical visible defect?",
    "options": [
      "Rows flicker blank during fast scrolling",
      "The scrollbar height is wrong by one row",
      "Screen readers announce the spacer rows",
      "Body cells stop lining up with the header columns"
    ],
    "answer": 3,
    "expl": "An absolute tr leaves table layout, so cell widths are no longer shared with the header. Spacer rows keep everything in one table."
  },
  {
    "q": "The first render of a virtualized table shows a header and an empty body. The virtualizer is in a child, reading a ref from the parent. Why?",
    "options": [
      "estimateSize returned zero for every row",
      "The scroll element had overflow set to visible",
      "The child effect ran before the ref attached",
      "getItemKey returned duplicate keys for rows"
    ],
    "answer": 2,
    "expl": "Children's layout effects run before the parent's ref is set in the same commit. The virtualizer sees null and a ref write never re-renders to retry."
  },
  {
    "q": "What makes passing the scroll element as state fix that bug?",
    "options": [
      "State is available before any layout effect runs",
      "The setter as a callback ref triggers a re-render",
      "State avoids the stale closure inside useVirtualizer",
      "Refs cannot be read inside child components"
    ],
    "answer": 1,
    "expl": "React calls setScrollElement(node) when the div mounts, which re-renders the parent and hands the child a real element as a prop."
  },
  {
    "q": "Why build the virtual window from synchronous scroll math rather than IntersectionObserver?",
    "options": [
      "Observer callbacks arrive late, showing blank rows",
      "IntersectionObserver is unsupported in table elements",
      "Scroll math uses less memory for large lists",
      "IntersectionObserver cannot measure variable heights"
    ],
    "answer": 0,
    "expl": "Observer callbacks run after the frame, so a fast scroll paints a stale, blank window. Blank-but-fast is worse than slow."
  },
  {
    "q": "A user expands a fill, scrolls far away, scrolls back, and the fill is collapsed again. What is the fix?",
    "options": [
      "Lift the expanded id into the parent component",
      "Increase overscan so the row stays mounted",
      "Memoize the row with a field-wise comparator",
      "Use getItemKey so the row keeps its identity"
    ],
    "answer": 0,
    "expl": "A windowed row unmounts when it leaves the window, taking local state with it. State that must survive scrolling lives above the virtualizer."
  },
  {
    "q": "Typing in one row's note field re-renders all 35 mounted rows. Each row receives draft={{ flagged, note }}. Which changes fix it? Select all that apply.",
    "options": [
      "A memo comparator that compares draft field by field",
      "Passing one stable toggle handler that takes an id",
      "Raising overscan so fewer rows remount",
      "Moving drafts into a module-level variable"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "The rebuilt draft object and any inline handler both defeat memo. Overscan changes how many rows exist, not why they re-render; a module variable leaks and never renders."
  },
  {
    "q": "A test finds the 412th fill with querySelectorAll('tbody tr')[411]. After virtualization it clicks the wrong row. Why?",
    "options": [
      "Rows are rendered in reverse order when windowed",
      "jsdom does not support querySelectorAll on tbody",
      "Only a window mounts; row one is a spacer",
      "The virtualizer reorders rows by measured height"
    ],
    "answer": 2,
    "expl": "Position in the DOM no longer maps to position in the data. Find rows by a data attribute such as the fill id."
  },
  {
    "q": "After calling scrollToIndex, the code immediately querySelects the target row and gets null. What should it do?",
    "options": [
      "Call scrollToIndex a second time synchronously",
      "Wrap the lookup in flushSync to force a render",
      "Increase estimateSize so the row mounts sooner",
      "Retry the lookup each frame, bounded"
    ],
    "answer": 3,
    "expl": "The scroll, the new window and the React commit all happen later. A bounded per-frame retry finds the row once it exists."
  },
  {
    "q": "In vitest with jsdom, a virtualized table mounts zero rows. Which shims are needed? Select all that apply.",
    "options": [
      "offsetHeight and offsetWidth on elements",
      "A polyfill for requestIdleCallback",
      "scrollTo, which jsdom does not implement",
      "A mock for window.matchMedia queries"
    ],
    "answer": [
      0,
      2
    ],
    "multi": true,
    "expl": "jsdom does no layout, so sizes are zero and scrollToIndex has nothing to call. The virtualizer does not read idle callbacks or media queries."
  },
  {
    "q": "scrollToIndex in tests always leaves the table at the top. offsetHeight is shimmed. What is still missing?",
    "options": [
      "A fake timer to advance the scroll animation",
      "A large scrollHeight so the target is not clamped",
      "An act() wrapper around the scroll call",
      "A ResizeObserver mock on the scroll box"
    ],
    "answer": 1,
    "expl": "The virtualizer clamps a scroll target to scrollHeight minus clientHeight. With no content height, every target clamps to zero."
  },
  {
    "q": "Columns in a windowed table shift width as the user scrolls. What stops it?",
    "options": [
      "Increasing overscan to mount more rows",
      "whitespace-nowrap on every body cell",
      "table-fixed with explicit header widths",
      "Setting min-width on the scroll container"
    ],
    "answer": 2,
    "expl": "With auto layout the browser sizes columns from whichever rows are mounted. Fixed layout takes widths from the header alone."
  },
  {
    "q": "Why does selectFills return the input array unchanged when no filter is active?",
    "options": [
      "So getItemKey stays stable and avoids a recompute",
      "To avoid allocating memory on every render",
      "Because filter() throws on an empty predicate",
      "So React Query can deduplicate the result"
    ],
    "answer": 0,
    "expl": "getItemKey depends on the fills array. A fresh identity makes the virtualizer recompute every measurement."
  },
  {
    "q": "Without initialRect, what does a server render of the virtualized table contain?",
    "options": [
      "The first window of rows at the estimated size",
      "Every row, since the virtualizer is client-only",
      "A hydration error from mismatched row counts",
      "No body rows, because the viewport measures 0px"
    ],
    "answer": 3,
    "expl": "Before measuring, the virtualizer assumes a 0px viewport and returns no items. initialRect seeds a size so even the server HTML has a first window."
  }
]
```
