---
title: Server-driven tables - SSR, BFF filters, reusable columns
summary: Move a table to the server behind a small BFF - a route triple, a pure compute pipeline, a per-user cache and one zod contract on both ends.
date: 2026-09-17
part: 2
tags: [bff, ssr, react-router, security]
minutes: 18
---

## The big picture

> [!TLDR]
> When data is too big or too sensitive to ship whole, the table moves behind a
> BFF: three routes (list, filter options, CSV) that all read one per-user cache
> and run one pure pipeline.

The Trade orders blotter holds tens of thousands of orders, and an FX trader must
never receive a Rates order, even in JSON they never look at.

| Reason to move server-side | What breaks on the client |
| --- | --- |
| Size | You cannot ship 50,000 rows on every visit |
| Entitlements | Client-side filtering means the browser already holds the hidden rows |
| Consistency | List, dropdowns and CSV drift unless one pipeline produces all three |

![Three route files (list, filter options, CSV) each pointing down into one shared bff folder holding the per-user cache, the pure compute module and the zod schema, with the cache alone calling the upstream Trading API](images/02-ssr-bff-data-table/route-triple-one-pipeline.png)

A BFF ("backend for frontend") here is not a separate service. It is React Router
v7 resource routes - a `loader` and no component - in the same app, sharing the
session cookie and the types. `.server.ts` files never reach the client bundle.

> [!NUANCE]
> Not every table deserves a BFF. A small table on a detail page with nothing to
> compute gains only a layer: load the rows in the page loader and let TanStack
> work client-side, as in part 1.

## The list route: the order is the design

> [!TLDR]
> Permission, params, cache, compute, schema, response. In that order, every time.

![The list loader as six numbered steps inside a server box: permission check, per-user cache, upstream fetch on a miss, pure compute, zod parse, and a private no-store response back to the browser](images/02-ssr-bff-data-table/bff-loader-pipeline.png)

```tsx
export const loader = async ({ request }: Route.LoaderArgs) => {
  const caller = await requirePermission(request, "orders:read"); // 1
  const parsed = parseOrdersParams(new URL(request.url).searchParams); // 2

  if (!parsed.success) return data({ error: "invalid_params" }, { status: 400, headers: NO_STORE });

  const baseline = await getOrdersBaseline(caller); // 3
  const payload = ordersResponseSchema.parse(       // 5
    computeOrders(baseline, parsed.data, caller.desks)); // 4

  return data(payload, { headers: NO_STORE });      // 6
};
```

> [!NUANCE]
> - Permission first, so an unauthorized request costs nothing.
> - The guard returns a `Caller`: user id, upstream token, and the desks that
>   token may see. There is no `desk` query parameter anywhere. **Scope comes
>   from the token, never the client.**
> - A BFF guard must return 401/403, not a 302 to the login page. `fetch` follows
>   the redirect, `res.ok` passes on the HTML shell, and `res.json()` throws a
>   parse error that tells you nothing. Page routes redirect; BFF routes do not.

> [!INTERVIEW]
> - *Why not accept `?desk=FX` from the client?* Because the client can change it.
>   Anything that narrows what a user may see comes from their token.

## The pure compute pipeline

> [!TLDR]
> `compute.ts` has no `fetch`, no `Date.now()` and no request object. Scope,
> filter, search, sort, paginate - all pure, all unit-testable.

> [!STEPS]
> 1. **Scope.** Keep only rows from the caller's desks, even if upstream already did.
> 2. **Filter and search.** Tab statuses, facets, then the search box.
> 3. **Sort with a tie-breaker.** Ties fall back to `id`, so equal values never shuffle between pages.
> 4. **Paginate with a clamp.** A bookmarked `?page=40` on a list that shrank lands on the last page.

> [!NUANCE]
> - `applyScope` looks redundant. It stays. Pushing a filter to the upstream API is
>   an optimization, never the authority: a spec saying the backend supports a
>   parameter is not proof it implements it. Re-applying costs bandwidth; skipping
>   it can show a trader the wrong rows.
> - The first unit test is the entitlement rule as code. Delete `applyScope` and the build fails.

## The per-user cache

> [!TLDR]
> Cache the **promise**, keyed by `userId` plus scope, for about 30 seconds. List,
> filter options and CSV then share one upstream walk.

```ts
const cache = new Map<string, { promise: Promise<OrdersBaseline>; expiresAt: number }>();

export const getOrdersBaseline = (caller: Caller) => {
  const key = `${caller.userId}|${[...caller.desks].sort().join(",")}`;
  const hit = cache.get(key);

  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = fetchOrdersBaseline(caller);
  promise.catch(() => cache.delete(key)); // a failed walk evicts itself
  cache.set(key, { promise, expiresAt: Date.now() + TTL_MS });

  return promise;
};
```

> [!NUANCE]
> - Storing the promise, not the value, means two routes arriving milliseconds
>   apart share one upstream call.
> - A module-level `Map` is shared by **every request** on the server. A key
>   without the user in it leaks one trader's orders to another.
> - The upstream walk uses the caller's own token and has a ceiling (say 5,000
>   rows). An unbounded loop against someone else's API is an outage on a busy day.
> - Totals must not come from your own truncated fetch. A capped walk once reported
>   a flat 5,000 that looked real. Read the count separately and surface a `truncated` flag.

> [!GOTCHA]
> There is a second cache you did not write: the browser's. A BFF that sends
> `Cache-Control: private, max-age=10` lets the browser replay the response by
> URL alone - so after one user logs out, the next person to log in on that
> machine sees the previous user's table JSON. Send `private, no-store` from every
> BFF route, and add a test that reads each route file and fails on `max-age`.

## One zod contract on both ends

> [!TLDR]
> The schema file has no `.server` suffix. The BFF parses before responding, and
> the client parses the same schema on arrival.

> [!NUANCE]
> - Server-side parse: a bug in `compute.ts` fails where the logs are.
> - Client-side parse: deploy skew (server and client on different versions) fails
>   at the boundary, not as `undefined` inside a cell.
> - Params get a schema too, with every default in it, so `parse({})` is the default view.
> - An unknown tab is a 400, not a silent fallback showing the wrong rows under the
>   right heading. A junk filter value (`?side=banana`) just means no filter.
> - One serializer, `buildOrdersSearchParams`, builds the list query, the CSV link
>   and the page URL. Multi-values use repeated keys, so no delimiter collides with data.

## The client: manual mode and URL state

> [!TLDR]
> The table displays rows it did not sort, filter or page. Tell TanStack with the
> three `manual*` flags, and keep the view state in the URL.

> [!STEPS]
> 1. **Fetch with React Query.** `placeholderData` keeps old rows while the next page loads; `signal` cancels stale requests.
> 2. **Throw on errors.** Never swallow a fetch error into an empty list - an empty table reads as "no data" and hides the outage.
> 3. **Derive sorting and pagination from the URL.** Any patch without a `page` lands on page 1.
> 4. **Debounce search into the URL.** The input owns a draft and commits 350ms after the last keystroke.
> 5. **Set `manualSorting`, `manualFiltering`, `manualPagination`.** Otherwise TanStack sorts one page as if it were the whole dataset.

> [!NUANCE]
> - Validate the header's column id against the server's sort-field enum, so the
>   table cannot request a sort the BFF does not know.
> - `NO_ROWS` is a module constant; `?? []` hands the table a new array every render.
> - Pass `initialData` only when the SSR seed matches the current view, or every
>   query key starts with page one's rows.

![The Trade orders blotter on the Working tab: tabs, search, three filter pickers, ten rows and a footer reading 1-10 of 198, Page 1 of 20](images/02-ssr-bff-data-table/working-tab-default.png)

## Filter options and reusable columns

> [!TLDR]
> Options come from a second route that reads the **unfiltered** baseline. Columns
> are small factories composed per tab inside one `useMemo`.

![Side by side: deriving Symbol options from the filtered rows leaves a picker with only NVDA in it, while a second route that ignores the filters keeps every symbol available with NVDA checked](images/02-ssr-bff-data-table/filter-options-baseline.png)

> [!NUANCE]
> - Deriving options from a filtered fetch collapses the dropdown to the value you
>   already picked, with no way to change your mind. The client only holds one page anyway.
> - Options load lazily: `enabled: open` fetches nothing until the popover opens,
>   and `staleTime: Infinity` fetches once per visit.
> - Sort options with `numeric: true` so `ZNZ6` lands before `ZNZ26`.
> - Column sizing and labels live in a React-free config, so the CSV route imports the same labels.
> - Object spread is shallow: a factory that writes `meta: { numeric: true }`
>   silently drops the label from the spread config. Re-spread: `meta: { ...colMeta(id), numeric: true }`.
> - `useMemo(..., [tab])` is not a micro-optimization. A new `columns` array
>   remounts every cell.

## SSR seeding, hydration and CSV

> [!TLDR]
> Seed the first page from the page loader only where people land cold on a list.
> Either way the table renders on the server, so every cell must format identically in Node and the browser.

| Choice | Upside | Cost |
| --- | --- | --- |
| Seeding loader | Rows in the server HTML | Navigation blocks until the upstream walk finishes |
| Thin loader | Navigates instantly | First paint is skeleton rows |

> [!NUANCE]
> - The loader imports the same functions; it never calls its own BFF over HTTP.
> - Export `shouldRevalidate`, or every sort click re-runs the page loader too.
> - Create the `QueryClient` inside `useState`, never as a module singleton shared by every user.
> - Hydration-safe cells: pin the time zone (`timeZone: "UTC"`), the clock
>   (`hour12: false`) and the locale. Never compute "2h ago" from `Date.now()` in
>   render; the BFF sends `asOf`.
> - CSV reuses the pipeline minus `paginate`. An export never has more rows than the
>   view. With `?ids=` it exports exactly the selection, still scoped.
> - Two loading states: first load (skeletons at real column widths) and refetch
>   (old rows dimmed, `aria-busy`).

> [!WIN]
> One pipeline, three routes, zero drift: the list, the filter dropdowns and the
> export always agree, and no request can widen its own scope.

![Mid-refetch after clicking next page: page 1's rows are still on screen at 60% opacity while the footer already reads 11-20 of 198, Page 2 of 20](images/02-ssr-bff-data-table/page-2-refetching.png)

```quiz
[
  {
    "q": "A BFF list route reads ?desk=FX from the query string to narrow rows. What is wrong with that?",
    "options": [
      "Query strings are too long for multi-desk scopes",
      "The cache key no longer matches the user id",
      "Desk filtering belongs in the upstream API only",
      "A client can widen its own scope by editing it"
    ],
    "answer": 3,
    "expl": "Anything that limits what a user may see must come from their token. A URL parameter is user-controlled, so it can request another desk's rows."
  },
  {
    "q": "The upstream API spec says it supports a status filter. Should compute.ts still apply that filter itself?",
    "options": [
      "Yes, a documented parameter may be silently ignored",
      "No, duplicating filters wastes server CPU time",
      "No, the upstream result is already authoritative",
      "Only when the response cannot be cached"
    ],
    "answer": 0,
    "expl": "Pushdown is an optimization, not the authority. If the backend ignores the parameter, re-applying it costs bandwidth; skipping it shows wrong rows."
  },
  {
    "q": "After a user logs out and a colleague logs in on the same laptop, the colleague briefly sees the first user's orders. The BFF cache is keyed by userId. Most likely cause?",
    "options": [
      "The server Map kept the previous user's entry",
      "React Query kept the old data in memory across logins",
      "The response set private, max-age and the browser replayed it",
      "The session cookie was not rotated on login"
    ],
    "answer": 2,
    "expl": "The browser HTTP cache is keyed by URL alone, and private only stops shared proxies. A max-age lets the browser serve the old JSON. The server cache was already per user."
  },
  {
    "q": "Why does the per-user cache store a Promise rather than the resolved rows?",
    "options": [
      "Promises serialize more compactly in memory",
      "It lets the cache survive a server restart",
      "Resolved values cannot be evicted by TTL",
      "Concurrent routes share one in-flight upstream call"
    ],
    "answer": 3,
    "expl": "The list, filter-options and CSV routes often arrive milliseconds apart. Caching the promise lets them join the same walk instead of starting three."
  },
  {
    "q": "The dashboard shows exactly 5,000 orders every day. The page walk caps at 5,000 rows. What should the BFF do?",
    "options": [
      "Raise the cap until the number stops being round",
      "Paginate the upstream walk lazily per request",
      "Read the total separately and flag truncation",
      "Hide the count whenever it equals the cap"
    ],
    "answer": 2,
    "expl": "A count from your own capped fetch looks like a real number. A separate count endpoint plus a truncated flag tells the user the filter covers only part of the data."
  },
  {
    "q": "A BFF route's permission guard redirects unauthenticated requests to /login. What does the client see?",
    "options": [
      "A clean 401 it can handle and redirect on",
      "A JSON parse error from the HTML login page",
      "A CORS error blocking the redirected response",
      "An empty array because the body is blank"
    ],
    "answer": 1,
    "expl": "fetch follows the 302, gets the HTML shell with status 200, and res.json() throws an unhelpful parse error. BFF routes should return 401 or 403."
  },
  {
    "q": "Which belong in compute.ts for a server-driven table? Select all that apply.",
    "options": [
      "A tie-breaker on id when sort values are equal",
      "A call to Date.now() to compute order age",
      "Re-applying the caller's desk scope to the rows",
      "Reading the user id from the request cookie"
    ],
    "answer": [
      0,
      2
    ],
    "multi": true,
    "expl": "compute.ts is pure: no clock, no request, no IO. A stable tie-breaker and the scope re-check are pure data transforms; time and cookies belong to the route."
  },
  {
    "q": "The Symbol filter dropdown only ever lists the symbol already selected. How are its options being produced?",
    "options": [
      "From the rows after the current filters were applied",
      "From a cached copy of the first visible page",
      "From a stale React Query entry with staleTime Infinity",
      "From a column filter with filterFn set to equals"
    ],
    "answer": 0,
    "expl": "Options derived from filtered rows collapse to what is already picked. A separate route reads the unfiltered baseline so every value stays selectable."
  },
  {
    "q": "A server-driven table sorts correctly on page 1 but pages 2 and 3 look sorted only within themselves. What was missed?",
    "options": [
      "manualSorting was not set on the table",
      "The sort column lacked a sortingFn",
      "The BFF clamps the page parameter",
      "getSortedRowModel was listed after pagination"
    ],
    "answer": 0,
    "expl": "Without manualSorting TanStack re-sorts the one page it holds. The flags tell it the rows arrived already processed."
  },
  {
    "q": "A column factory writes { ...colConfig('qty'), meta: { numeric: true } } and the CSV header for Qty is now blank. Why?",
    "options": [
      "CSV routes cannot import from React column files",
      "numeric columns are excluded from CSV labels",
      "Spread is shallow, so the new meta replaced the label",
      "colConfig must be called inside a useMemo"
    ],
    "answer": 2,
    "expl": "The meta key overwrites the spread meta entirely, dropping its label. Re-spread it: meta: { ...colMeta(id), numeric: true }."
  },
  {
    "q": "Every row's timestamp triggers a hydration mismatch warning, but only for users outside London. What is missing from the formatter?",
    "options": [
      "A pinned locale such as en-GB",
      "An hour12 setting for the clock",
      "A suppressHydrationWarning prop",
      "A pinned timeZone such as UTC"
    ],
    "answer": 3,
    "expl": "Without a timeZone the server formats in its zone and the browser in the user's. The mismatch tracks location, which is the tell."
  },
  {
    "q": "Which are true of seeding the first page from the page loader? Select all that apply.",
    "options": [
      "Navigation waits until the upstream data is ready",
      "The loader should call its own BFF route over HTTP",
      "Without shouldRevalidate, sort clicks re-run the loader",
      "The QueryClient can be a shared module singleton"
    ],
    "answer": [
      0,
      2
    ],
    "multi": true,
    "expl": "A seeding loader blocks navigation, and URL-driven view state re-runs loaders unless you opt out. The loader imports functions directly, and a module QueryClient would be shared across users."
  },
  {
    "q": "A user selects 3 rows and clicks Export. The CSV has 3 rows even though filters would match 40. Is that right?",
    "options": [
      "No, exports should always follow the active filters",
      "Yes, an explicit selection is what they asked for",
      "No, selection should be intersected with filters",
      "Yes, but only if all 3 are on the current page"
    ],
    "answer": 1,
    "expl": "With ids, the export is exactly the selection and filters are ignored. Scope still applies, so an id from another desk exports nothing."
  },
  {
    "q": "The BFF fetch throws on a 500 but the hook catches it and returns []. What does the user experience?",
    "options": [
      "A retry prompt with the error message",
      "A spinner that never resolves",
      "An empty table that looks like no data",
      "The previous page's rows kept on screen"
    ],
    "answer": 2,
    "expl": "Swallowing an error into an empty list reads as 'nothing matches' and hides the outage. Throw, expose isError and render an error state with retry."
  },
  {
    "q": "Why should an unknown ?tab=banana return 400 while ?side=banana is treated as no filter?",
    "options": [
      "A fallback shows wrong rows, right heading",
      "Tabs are cached separately from filters",
      "Filter values are validated on the client only",
      "Tabs are part of the permission check"
    ],
    "answer": 0,
    "expl": "Falling back to a default tab would show, say, all orders under a 'Filled' heading. A junk filter value is visible in the chips row and harms nothing."
  }
]
```
