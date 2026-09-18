---
title: Row click UX - expando, drawer or detail page
summary: What should clicking a table row do? A decision framework, the three guards every clickable row needs, and URL-driven drawers.
date: 2026-09-17
part: 6
series: Data Tables in React
tags: [ux, accessibility, react-router]
minutes: 15
---

## The big picture

> [!TERMS]
> - **Row click** - what happens when someone clicks anywhere on a row.
> - **Expando** - a row that opens in place to show extra rows underneath it.
> - **Side drawer (Sheet)** - a panel that slides in from the side, over the list.
> - **Detail page** - a separate page, with its own URL, for one record.
> - **Master-detail** - a list on one side and the selected record always open on the other, like an email inbox.
> - **Portal** - a component whose HTML is placed somewhere else in the page, such as a dropdown menu.
> - **Search param** - the `?key=value` part of a URL.
> - **Focus ring** - the outline that shows which element the keyboard is on.

> [!TLDR]
> A pointer cursor is a promise that clicking does something useful.
> A row click can mean four different things, and people only learn one per table - so choose by what the user wants to do **next**.

![Flow from a row click through two questions, keep the list in view and how deep is the work, to expando, side drawer, master-detail or a detail page](images/06-row-click-ux/row-click-decision.png)

| Option | Use it when the user wants to... | Their next step |
| --- | --- | --- |
| Expando | Peek at a few child rows | Keep scanning the list |
| Side drawer | Check or lightly edit one record | Look at the next row |
| Detail page | Do deep work across several sections | Stay here for ten minutes |
| Master-detail | Work through the list like a to-do queue | Go through records one after another |

> [!NUANCE]
> - Write the choice down as a TypeScript type with one option per table. A type forces you to pick one.
> - Only show a pointer cursor when a click actually does something.

## One click handler, with three guards

> [!TLDR]
> The shared table owns the click handler, and it ignores three kinds of click: one that ends a text selection, one on a button or link inside the row, and one inside a menu the row opened.

![Three guards in order, portal check, interactive child, ended a text selection, each of which stops the click before the row action fires](images/06-row-click-ux/row-click-guards.png)

```ts
const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
  const target = event.target;

  if (!(target instanceof Element)) return;
  if (!event.currentTarget.contains(target)) return;            // clicked inside a menu (portal)
  if (hitInteractiveChild(target, event.currentTarget)) return; // clicked a button, link or checkbox
  if (endedTextSelection()) return;                             // the user was copying a number

  onRowClick?.(row);
};
```

> [!NUANCE]
> - Dragging to select a number and letting go counts as a click. Without the text-selection guard, copying a number navigates away.
> - A dropdown menu's items live elsewhere in the page (a portal), but React still passes their clicks up to the row. The check "is the click actually inside this row?" catches that.
> - Check `instanceof Element`, not `HTMLElement`: an icon inside a button is an SVG element.

> [!GOTCHA]
> If the shared table does not guard clicks on buttons inside the row, every cell with a button has to stop the click itself.
> Forget it once and ticking a checkbox also opens the drawer.
> Put the guard in the shared table, then delete every hand-written click-stopper from your cells.

## Expando: peek at child rows

> [!TLDR]
> Let TanStack track which rows are open, allow only one open at a time, and let only rows that actually have children show an arrow.

> [!STEPS]
> 1. **Decide which rows can open** with `getRowCanExpand`. A working order with no fills shows no arrow and does not look clickable.
> 2. **Keep one open at a time.** Opening a row closes the previous one.
> 3. **Give the arrow a real `Button`.** That is what keyboard and screen-reader users use; clicking the row is a bigger target on top.
> 4. **Draw the children as a second row** whose single cell spans every visible column.

> [!NUANCE]
> - The click guard recognises the arrow button, so clicking it does not open and close in one go.
> - `aria-expanded` (which tells screen readers "open" or "closed") goes on the arrow button, not the row.

![Orders blotter with ORD-118001 expanded, showing the nested fills table on a muted background and the rotated chevron; the working order below it has no chevron](images/06-row-click-ux/expando-open.png)

## Side drawer: keep the open row in the URL

> [!TLDR]
> Whatever a click opens, put its id in the URL.
> Then refreshing keeps it open and a colleague can open the same record from a link.

```ts
const open = (id: string) =>
  setSearchParams(
    (prev) => { const next = new URLSearchParams(prev); next.set("position", id); return next; },
    { replace: true, preventScrollReset: true },
  );
```

> [!NUANCE]
> - Copy the existing params first, so the filters and sort survive.
> - `replace: true` stops each opened drawer adding a Back-button step.
> - `preventScrollReset: true` stops the list jumping to the top on every click.
> - A drawer that remembers its row in component state closes on refresh and cannot be shared.
> - Keep drawing the last record while the drawer slides shut, or it slides out empty.

> [!INTERVIEW]
> - *Why add Previous and Next buttons to the drawer?* The drawer covers the list, so without them walking the list means close, click, close, click.

![After pressing Next the drawer shows POS-00004, the highlight has moved to that row, and the location caption reads ?position=POS-00004](images/06-row-click-ux/drawer-url-param.png)

## Detail page: a real link first

> [!TLDR]
> If a row goes to another page, its first cell still needs a real link.
> Clicking anywhere on the row is a convenience on top.

> [!NUANCE]
> - A real link lets people cmd-click or middle-click to open a new tab, right-click to copy the address, and hear "link" on a screen reader. A click handler that navigates gives none of that.
> - Clicking the link does not also trigger the row, because the guard ignores links.
> - Back returns to the exact same list only because the filters and page live in the URL (part 2).

![Order detail page for a rejected order: a back link to Orders, the status badge, a rejection alert, the order facts card and an empty fills card](images/06-row-click-ux/detail-page.png)

## Single click and double click

> [!TLDR]
> If one click selects and a double click opens, you can act instantly.
> If both open something, every single click has to wait to see whether a second is coming.

![Two timelines: Pattern A selects the row at 0 ms, Pattern B parks the click in a 220 ms timer before the drawer opens](images/06-row-click-ux/single-vs-double-click.png)

> [!STEPS]
> 1. **Click selects, double click opens.** A double click sends two clicks first; ignore the second one (`event.detail > 1`) so it does not un-select.
> 2. **Click opens a drawer, double click opens a page.** Now the first click must wait about 220ms for a possible second one.
> 3. **Always offer a visible way too**, like a link or an "Open" menu item.

> [!NUANCE]
> - Double click is hard to discover and does not exist on touch screens.
> - Prefer the first pattern, or no double click at all.

## Keyboard, master-detail and styling

> [!TLDR]
> A clickable row is invisible to the keyboard unless you make it focusable and handle Enter and Space.

> [!NUANCE]
> - Put `tabIndex={0}` only on rows that do something. In the keyboard handler, only act if the row itself is focused, so Enter on the arrow does not also open the row.
> - Show the focus ring only for keyboard users (`focus-visible`), and draw it inside the row, or the table's scroll box cuts it off.
> - Master-detail: one `?sel=` param in the URL is the whole state. If it is missing, choose the first row while drawing, rather than writing it into the URL afterwards, which causes a flash of an empty panel.
> - The end goal is one prop per table, like `rowAction={{ single: "select", double: "navigate" }}`, so the table handles the mechanics and nobody reinvents them.

| Style | Why |
| --- | --- |
| Hover lighter than selected | The open row stays obvious while the mouse moves |
| No line between a row and its children | They read as one unit |
| A red edge drawn as a shadow, not a border | A border would push the row's content sideways |
| A wider drawer | The default is cramped for financial data |

> [!WIN]
> One guarded click handler in the shared table, the open record in the URL, real links for real navigation, and one clear setting per table.

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
