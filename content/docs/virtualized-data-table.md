---
title: Virtualizing a table - and when you should not
summary: Measure first, try a render cap, then wire useVirtualizer into a shadcn Table with spacer rows, measured heights, memoized rows and jsdom tests.
date: 2026-09-17
part: 3
series: Data Tables in React
tags: [virtualization, performance, testing]
minutes: 17
---

## The big picture

> [!TERMS]
> - **DOM** - the live tree of elements the browser keeps for your page. Every `<tr>` is a node in it.
> - **Mounted** - actually present in the DOM right now.
> - **Virtualization (windowing)** - only mounting the rows you can currently see, and faking the rest with empty space.
> - **Render cap** - showing the first N rows with a "Show more" button.
> - **Overscan** - a few extra rows mounted just outside the visible area, so fast scrolling does not show blanks.
> - **Ref** - React's way to hold a direct handle to a DOM element.
> - **Layout effect** - code React runs right after changing the DOM, before the screen is painted.
> - **Memo** - telling React to skip re-drawing a component when its inputs have not changed.
> - **jsdom** - a fake browser used in tests. It has a DOM but does no layout, so every size is 0.

> [!TLDR]
> Virtualization is the last tool to reach for, not the first.
> Measure first. Most slow tables are fixed by paging or a "Show more" button.

The Executions tape shows every trade fill for one day: 50,000 rows in one scrollable panel, arriving through the day.
Any fill can expand to show its parent order, so rows are not all the same height.
The first version put all 50,000 rows in the DOM, and the browser tab froze.

> [!ANALOGY]
> Virtualization is a train window.
> The landscape is miles long, but you only ever see one window's worth, and the scenery outside it does not need to exist until you reach it.

![A decision flow: a paginated list stops at pagination, light rows or a searched list get a render cap, and only an un-paginated list of heavy rows that people scroll through gets virtualized](images/03-virtualized-data-table/virtualize-decision.png)

Ask three questions before you virtualize:

| Question | If the answer is "no" |
| --- | --- |
| Is the list un-paged? | Page it. Only one page ever reaches the DOM |
| Are the rows heavy (menus, inputs, charts)? | A "Show more" cap is enough |
| Does the user need one continuous scroll? | Page it or cap it |

Only three "yes" answers earn a virtualizer.
Plenty of production table systems never virtualize at all, on purpose, because every table pages.

## Measure before you fix

> [!TLDR]
> Get two numbers: how many rows are really in the DOM, and how long a render takes.
> Then decide.

> [!STEPS]
> 1. **Use the same fake data everywhere.** A seeded random generator makes the server, browser and tests all see the same 50,000 rows.
> 2. **Count real rows** by asking the DOM directly, so nothing can fake the number.
> 3. **Time the render** with React's `Profiler`. It only reports in development builds, so compare numbers, do not quote them.
> 4. **Time the whole interaction** too. React cannot see the browser's layout and paint work.

> [!NUANCE]
> - A classic trigger: a 500-line list that, when someone picked "All", mounted 500 rows **and 500 dropdown menus** at once.
> - Heavy off-screen DOM slows the whole page, not just scrolling. Twenty heavy pages kept mounted made every layout pass about 12x slower (roughly 40ms instead of 3ms).

![The finished Executions tape at the top of the day, with the toolbar reading Mounted rows: 25 of 50,000](images/03-virtualized-data-table/tape-top.png)

## The cheaper fixes that usually win

> [!TLDR]
> Keeping 50,000 rows *in memory* is fine.
> Putting 50,000 `<tr>` elements *in the DOM* is not.
> Paging and a "Show more" cap both fix the second without any scroll maths.

```tsx
const [visibleCount, setVisibleCount] = useState(20);

// draw fills.slice(0, visibleCount), then a button stuck to the bottom of the box:
<Button onClick={() => setVisibleCount((n) => n + 20)}>Show 20 more</Button>
```

> [!NUANCE]
> - The button fetches nothing. It only changes a number.
> - Make it `sticky bottom-0` inside the scroll box, so it is always reachable.
> - Choosing "no virtualizer" for a 455-row feed is a good decision, not a lazy one. Hand-built virtualizers are a known maintenance headache.

![The recent fills panel after one click: 40 of 2,676 rows mounted, with the sticky Show 20 more button at the bottom of the box](images/03-virtualized-data-table/render-cap-tab.png)

## Virtualizing a table: two spacer rows

> [!TLDR]
> Mount only the visible rows, and put one empty "spacer" row above them and one below them, each as tall as the rows it stands in for.
> The scrollbar then behaves as if every row were there.

![The scroll box holds a sticky header, a tall empty spacer row, the 25 mounted rows, and a second spacer row below them, so the scrollbar reads as 50,000 rows while only 25 exist](images/03-virtualized-data-table/windowed-body-spacer-rows.png)

```ts
const items = virtualizer.getVirtualItems(); // the rows in view, plus overscan

const paddingTop = items.length > 0 ? items[0].start : 0;
const paddingBottom = items.length > 0 ? total - items[items.length - 1].end : 0;
// <SpacerRow height={paddingTop} /> {visible rows} <SpacerRow height={paddingBottom} />
```

Each virtual item knows where it starts and ends, in pixels.
The gap before the first one and after the last one become the two spacers.

> [!STEPS]
> 1. **Let the outer box do the scrolling.** shadcn's table wraps itself in its own scrolling box, which would trap the sticky header; switch that inner scroll off.
> 2. **Key each measurement by the row's id**, not its position, so inserting a row does not give it the wrong height.
> 3. **Hide spacers from screen readers** with `aria-hidden`.

> [!NUANCE]
> - The library's docs position each row absolutely. That suits card lists and chat logs.
>   In a table, an absolutely positioned row leaves the table's layout, so its cells stop lining up with the header.
> - Work out the visible window straight from the scroll position. Tools that report visibility *later* (after the frame) show blank rows during fast scrolls. Blank-but-fast is worse than slow.

## The scroll box must be state, not a ref

> [!TLDR]
> If the virtualizer lives in a child component, hand it the scroll box through **state**, not a ref.
> Otherwise the first render shows an empty table.

![Two timelines side by side: with a ref, the child's layout effect runs before the parent's ref attaches and the body stays empty; with state, the setter runs as the ref, the parent re-renders, and the child attaches to a real element](images/03-virtualized-data-table/scroll-element-ref-vs-state.png)

```tsx
const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

// <div ref={setScrollElement} className="h-[600px] overflow-y-auto">
//   <TapeBody scrollElement={scrollElement} />

useVirtualizer({
  getScrollElement: () => scrollElement,
  initialRect: { width: 1024, height: 600 }, // a guess, so even the first render shows rows
});
```

> [!GOTCHA]
> React finishes children before parents.
> So the child's virtualizer looks for the scroll box *before* the parent has attached its ref, finds nothing, and gives up.
> Writing to a ref later does not trigger a re-render, so nothing ever tells it to try again.
> The symptom is a header over an empty body.
> Passing the state setter as the ref fixes it: when the box appears, React calls the setter, the parent re-renders, and the child gets a real element.

> [!INTERVIEW]
> - *Why `initialRect`?* Until it has measured anything, the virtualizer assumes the box is 0px tall and shows nothing - including in the server-rendered HTML.

## Rows of different heights, and stopping extra re-draws

> [!TLDR]
> Let the virtualizer measure each row, keep row state in the parent, and compare row inputs field by field so typing in one row redraws one row.

> [!STEPS]
> 1. **Measure each row.** Give it `data-index` and `ref={virtualizer.measureElement}`. The size you guess up front is only a starting point.
> 2. **Treat the expanded detail as its own row.** A `<tr>` cannot hold a block underneath its own cells.
> 3. **Keep "which row is open" in the parent.** A row unmounts when it scrolls out of view and would forget it was open.
> 4. **Compare row inputs field by field.** A small object rebuilt for every row on every render looks "new" each time, so plain memo never skips anything.
> 5. **Pass one stable click handler that takes an id.** A fresh `() => toggle(id)` per row also defeats memo.

> [!NUANCE]
> - Tell the virtualizer about the sticky header (`scrollPaddingEnd`), or "scroll to row" hides the row under it.
> - When no filter is active, return the **same** array rather than a filtered copy, so the virtualizer does not recalculate everything.

![Row 5 expanded: the order panel shows the parent order, a note field and a flag button, and the footer reads Row 5 open](images/03-virtualized-data-table/row-expanded.png)

## Finding rows, and testing

> [!TLDR]
> After virtualizing, the 412th fill is no longer the 412th `<tr>`.
> Find rows by a `data-` id, and give the fake test browser a few made-up sizes so it mounts anything at all.

> [!NUANCE]
> - "Jump to fill": scroll to the index, then look for the row by id once per frame for a few frames, because it is not in the DOM the instant you ask.
> - The row needs `tabIndex={-1}` so you can move keyboard focus to it.
> - jsdom reports every size as 0. Fake `offsetHeight`, `scrollHeight` and `clientHeight`, and add `scrollTo`, which jsdom lacks. Then assert that *some* rows mount and *most* do not.

| Styling need | Why |
| --- | --- |
| `table-fixed` with set header widths | Otherwise the browser sizes columns from whichever rows happen to be mounted, and they jump while scrolling |
| Sticky styles on each header cell | Borders and backgrounds do not travel with a sticky row |
| Fixed-width buy/sell badges | "buy" and "sell" are different widths and would wobble the column |
| `tabular-nums` on live counters | Stops the numbers twitching as fills stream in |

> [!WIN]
> 50,000 fills, about 35 rows in the DOM at any moment, columns that stay still, and a test that fails if anyone brings the empty-table bug back.

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
