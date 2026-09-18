---
title: Row click UX - expando, drawer or detail page
summary: What should clicking a table row do? A decision framework, the three guards every clickable row needs, and URL-driven drawers.
date: 2026-09-17
part: 6
tags: [ux, accessibility, react-router]
minutes: 15
---

## The big picture

> [!TLDR]
> A pointer cursor is a promise. A row click can mean four different things, and
> users only learn one per table - so pick it by what the user does **next**.

![Flow from a row click through two questions, keep the list in view and how deep is the work, to expando, side drawer, master-detail or a detail page](images/06-row-click-ux/row-click-decision.png)

| Option | The job | User's next step |
| --- | --- | --- |
| Expando | Peek at child rows of the same record | Keep scanning the list |
| Side drawer | Inspect or lightly edit one record | Look at the next row |
| Detail page | Deep work across several sections | Spend ten minutes here |
| Master-detail | The list **is** the work queue | Work through records in order |

> [!NUANCE]
> - Write the decision down as a discriminated union type (`kind: "expando" | "drawer" | "page"`). A type forces one answer per table.
> - `cursor-pointer` only when a handler exists. A pointer on a row that does nothing is a broken promise.

## One handler, three guards

> [!TLDR]
> The shared table owns the click handler, and it ignores three things: a click
> that ends a text selection, a click on an interactive child, and a click inside a portal.

![Three guards in order, portal check, interactive child, ended a text selection, each of which stops the click before the row action fires](images/06-row-click-ux/row-click-guards.png)

```ts
const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
  const target = event.target;

  if (!(target instanceof Element)) return;
  if (!event.currentTarget.contains(target)) return; // clicked inside a portal
  if (hitInteractiveChild(target, event.currentTarget)) return; // button, a, input, role=checkbox
  if (endedTextSelection()) return; // user was copying a number

  onRowClick?.(row);
};
```

> [!NUANCE]
> - `instanceof Element`, not `as HTMLElement`: a lucide icon inside a `Button` is an `SVGElement`.
> - A `DropdownMenu` renders its items in a portal elsewhere in the page. React
>   still bubbles the click to the row, but `rowElement.contains(target)` is false.
> - `window.getSelection()` runs only inside the handler, never during render, so the table still server-renders.
> - A "selectable text" cell wrapper is the wrong default on a picker table, where the whole row is the choice. Make it opt-in per column.

> [!GOTCHA]
> A shared table that guards double-click but not single click forces every cell
> with a link or button to hand-write `e.stopPropagation()`. Forget it once and a
> checkbox click also opens the drawer. Put the guard in the table, then delete
> every `stopPropagation` from your cells - shadcn's `Checkbox` renders a
> `button role="checkbox"`, which the selector already matches.

## Expando: peek at child rows

> [!TLDR]
> TanStack's expanding feature holds the state. Keep `ExpandedState` yourself to
> force single-open, and let `getRowCanExpand` decide which rows can open at all.

> [!STEPS]
> 1. **Gate with `getRowCanExpand`.** A working order with no fills shows no chevron and does not look clickable.
> 2. **Force one open.** `keepSingleOpen` finds the id that turned on and drops the rest. Note `ExpandedState` can be `true`, meaning "all".
> 3. **Render a real chevron `Button`.** That is what keyboard and screen reader users operate; the row click is a bigger target on top.
> 4. **Render the sub-row as a second `TableRow`** with `colSpan={row.getVisibleCells().length}`, so hidden columns do not break it.

> [!NUANCE]
> - The guard recognises the chevron button, so clicking it does not toggle twice.
> - `aria-expanded` goes on the chevron, not the row - it is the element the user operates.
> - Heavy children: let the sub-row fetch on mount and show `Skeleton` rows.

![Orders blotter with ORD-118001 expanded, showing the nested fills table on a muted background and the rotated chevron; the working order below it has no chevron](images/06-row-click-ux/expando-open.png)

## Side drawer: the open id lives in the URL

> [!TLDR]
> Whatever a click opens, its id belongs in the URL - so reload and sharing work.
> Write it with `replace: true` and `preventScrollReset: true`.

```ts
const open = (id: string) =>
  setSearchParams(
    (prev) => { const next = new URLSearchParams(prev); next.set("position", id); return next; },
    { replace: true, preventScrollReset: true },
  );
```

> [!NUANCE]
> - The updater copies existing params, so filters and sort survive.
> - `replace: true`: the back button leaves the page instead of replaying every drawer opened.
> - `preventScrollReset: true`: without it, every row click on a page with scroll restoration yanks the list to the top.
> - Drawers that keep the open id in component state are neither shareable nor reload-safe.
> - `useLastNonNull` keeps the last record rendered while the `Sheet` slides closed, so it does not slide out empty.
> - The URL only opens ids in the rows on screen. Shared links that must always work fetch by id on load.

> [!INTERVIEW]
> - *Why do the drawer's Previous and Next buttons matter?* A `Sheet` blocks the
>   list behind it. Without them, walking the list is close, click, close, click.
>   Walk `table.getRowModel().rows`, so "next" means the next row on screen.

![After pressing Next the drawer shows POS-00004, the highlight has moved to that row, and the location caption reads ?position=POS-00004](images/06-row-click-ux/drawer-url-param.png)

## Detail page: a real link, then a row click

> [!TLDR]
> A row that navigates still needs a real anchor in its first cell. The row click
> is the convenience layer on top.

> [!NUANCE]
> - A real `Link` gives cmd-click and middle-click new tabs, "Copy link address",
>   and a link announcement for screen readers. A bare `onClick` that calls `navigate()` breaks all three.
> - Clicking the link does not also fire the row action, because `a` matches the interactive-child guard.
> - Back returns to the exact list only because filters, sort and page live in the URL (part 2). Pass `from` in link state for the back link.

![Order detail page for a rejected order: a back link to Orders, the status badge, a rejection alert, the order facts card and an empty fills card](images/06-row-click-ux/detail-page.png)

## Single click vs double click

> [!TLDR]
> If single click selects, check `event.detail` and act instantly. If both clicks
> open something, you need a timer - and every single click gets 220 ms slower.

![Two timelines: Pattern A selects the row at 0 ms, Pattern B parks the click in a 220 ms timer before the drawer opens](images/06-row-click-ux/single-vs-double-click.png)

> [!STEPS]
> 1. **Pattern A: click selects, double-click opens.** A double click fires click, click, dblclick; skip clicks where `event.detail > 1` so the second click does not untoggle.
> 2. **Keyboard clicks report `detail === 0`,** so they pass the check.
> 3. **Pattern B: click opens drawer, double-click opens page.** The first click is parked in a timer; a double click clears it. Clean up on unmount.
> 4. **Always ship a visible alternative.** A link cell or an "Open" item in the row menu.

> [!NUANCE]
> - Double-click is undiscoverable and missing on touch.
> - The OS double-click window is often longer than your timer, so users still misfire.
> - Recommendation: Pattern A, or no double click at all.

## Keyboard, master-detail and styling

> [!TLDR]
> A `TableRow` with `onClick` is invisible to the keyboard. Add a real control in
> the first cell, make clickable rows focusable, and handle Enter and Space.

> [!NUANCE]
> - `tabIndex={0}` only when the row is clickable. Check `target === currentTarget`
>   in the keydown handler so Enter on the chevron does not also fire the row action.
> - Focus ring: `focus-visible` (mouse users never see it) and `ring-inset` (the scroll container clips an outer ring).
> - Master-detail: one `?sel=` param is the whole state. Compute the fallback (first row)
>   during render instead of writing it back in an effect - no flash of an empty pane,
>   and server and browser pick the same record.
> - The end state: one declarative `rowAction={{ single: "select", double: "navigate" }}`
>   prop. The table picks the mechanics, so nobody adds a 220 ms delay to a select-only table by accident.

| Style | Why |
| --- | --- |
| `hover:bg-muted/50` lighter than selected `bg-muted` | The active row stays distinct under a moving mouse |
| `border-b-0` on an expanded parent | Joins it to its sub-row |
| Urgency rail as inset `box-shadow` | A 4px `border-left` on one cell shifts layout |
| Drawer `sm:max-w-md` | The default `sm:max-w-sm` is tight for financial data |
| `select-none` on picker rows | The whole row is the choice |

> [!WIN]
> One guarded handler in the shared table, ids in the URL, real links for real
> navigation, and a single prop that states each table's intent.

```quiz
[
  {
    "q": "Users review each row's details and immediately move to the next row. Which row click fits?",
    "options": [
      "An expando showing child rows",
      "A side drawer with Previous and Next",
      "A full detail page per record",
      "A double-click to open a modal"
    ],
    "answer": 1,
    "expl": "The next step is 'look at the next row', which needs the list visible and a fast way to walk it. A page suits long, deep work."
  },
  {
    "q": "A user drags to select a number in a cell to copy it, and the page navigates away. Which guard is missing?",
    "options": [
      "The portal containment check",
      "A text-selection check",
      "The interactive-child selector",
      "A check for event.detail greater than one"
    ],
    "answer": 1,
    "expl": "The mouseup that ends a selection drag fires a click. Checking the current selection in the handler lets the row ignore it."
  },
  {
    "q": "Choosing 'Delete' in a row's dropdown menu also opens the row's drawer. The menu content is portalled. Why does the row see the click?",
    "options": [
      "Portals disable event propagation checks",
      "The dropdown trigger is not a real button",
      "The menu item lacks a role attribute",
      "React bubbles portal events through the component tree"
    ],
    "answer": 3,
    "expl": "React bubbles along the component tree, not the DOM. The row must check rowElement.contains(target), which is false for portal content."
  },
  {
    "q": "The guard casts event.target as HTMLElement and calls closest(). Clicks on icons inside buttons still open the row. Why?",
    "options": [
      "The icon is an SVGElement, not an HTMLElement",
      "closest() does not match data attributes",
      "Icons are rendered in a separate portal",
      "Buttons swallow clicks on their children"
    ],
    "answer": 0,
    "expl": "Lucide icons are SVG elements. An instanceof Element check handles both HTML and SVG targets correctly."
  },
  {
    "q": "A working order with no fills shows a chevron that expands to an empty panel. What fixes it?",
    "options": [
      "Hide the panel when the fills array is empty",
      "Use keepSingleOpen on the expanded state",
      "Return false from getRowCanExpand for that row",
      "Render the chevron only on hover"
    ],
    "answer": 2,
    "expl": "getRowCanExpand removes the chevron, the expansion and the clickable affordance together. Hiding an empty panel still lies about the row."
  },
  {
    "q": "A drawer's open row id is in component state. Which problems follow? Select all that apply.",
    "options": [
      "A reload closes the drawer",
      "A colleague cannot open the same record from a link",
      "The drawer re-renders on every keystroke",
      "Sorting the table closes the drawer"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "State lives only in memory, so it is neither reload-safe nor shareable. Re-rendering and sorting behaviour are unrelated to where the id lives."
  },
  {
    "q": "After moving the drawer id into search params, every row click jumps the list to the top. Which option is missing?",
    "options": [
      "replace: true",
      "relative: 'path'",
      "flushSync: true",
      "preventScrollReset: true"
    ],
    "answer": 3,
    "expl": "With scroll restoration, a navigation resets scroll unless told not to. replace only affects history entries."
  },
  {
    "q": "Opening ten drawers means the back button walks through all ten before leaving the page. What fixes it?",
    "options": [
      "preventScrollReset on each update",
      "Storing the id in sessionStorage",
      "replace: true when writing the param",
      "Clearing the param in a cleanup effect"
    ],
    "answer": 2,
    "expl": "Each setSearchParams push adds a history entry. Replacing keeps one entry, so back leaves the page."
  },
  {
    "q": "A row navigates via onClick={() => navigate(url)}. Which capabilities are lost compared with a real link in the first cell? Select all that apply.",
    "options": [
      "Cmd-click or middle-click to open a new tab",
      "Right-click 'Copy link address'",
      "Client-side routing without a page reload",
      "Prefetching data on navigation"
    ],
    "answer": [
      0,
      1
    ],
    "multi": true,
    "expl": "Only an anchor gives new-tab gestures, the link context menu and a link announcement. navigate() still routes client-side, and prefetching is separate."
  },
  {
    "q": "Single click selects a row and double click opens it. Double-clicking selects and then immediately deselects. Fix?",
    "options": [
      "Add a 220 ms timer before selecting",
      "Skip selecting when event.detail > 1",
      "Handle selection in onMouseDown instead",
      "Call preventDefault in the dblclick handler"
    ],
    "answer": 1,
    "expl": "A double click fires two click events first. Checking the click count keeps the first click instant and ignores the second."
  },
  {
    "q": "Why is 'single click opens drawer, double click opens page' costly?",
    "options": [
      "Each single click waits on a timer",
      "It requires two separate event listeners",
      "Browsers throttle dblclick on table rows",
      "It breaks the portal guard"
    ],
    "answer": 0,
    "expl": "Both actions open something, so the first click cannot act until the double-click window passes, delaying every single click."
  },
  {
    "q": "A keyboard user presses Enter on a focused chevron button and both the expand and the row's drawer fire. What is missing?",
    "options": [
      "A target === currentTarget check",
      "tabIndex={-1} on the chevron",
      "aria-expanded on the table row",
      "An onKeyUp handler instead of onKeyDown"
    ],
    "answer": 0,
    "expl": "The keydown bubbles from the chevron to the row. The row should act only when it is itself the focused target."
  },
  {
    "q": "The row focus ring is clipped at the table's left edge. What fixes it?",
    "options": [
      "Use focus instead of focus-visible",
      "Add overflow-visible to each cell",
      "Use an inset ring",
      "Increase the ring offset"
    ],
    "answer": 2,
    "expl": "The scroll container clips anything outside the row box. An inset ring draws inside it."
  },
  {
    "q": "A master-detail page writes the first row's id into ?sel= in an effect when the param is missing. What is the downside?",
    "options": [
      "It creates a duplicate history entry and nothing else",
      "The param is lost on the next sort",
      "Effects cannot call setSearchParams",
      "An empty pane flashes; SSR can differ"
    ],
    "answer": 3,
    "expl": "The effect runs after a render with no selection, so the pane flashes empty. Computing the fallback during render avoids the flash and keeps SSR consistent."
  },
  {
    "q": "A 4px red urgency marker as border-left on the first cell makes rejected rows' text shift. Better approach?",
    "options": [
      "Add a 4px transparent border to every row",
      "An inset box-shadow on the first cell",
      "A separate 4px column for the marker",
      "Negative margin on the first cell"
    ],
    "answer": 1,
    "expl": "A box-shadow occupies no layout space, so nothing moves. A transparent border on every row works but costs width everywhere."
  }
]
```
