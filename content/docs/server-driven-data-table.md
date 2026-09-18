---
title: Server-driven tables - SSR, BFF filters, reusable columns
summary: Move a table to the server behind a small BFF - a route triple, a pure compute pipeline, a per-user cache and one zod contract on both ends.
date: 2026-09-17
part: 2
series: Data Tables in React
tags: [bff, ssr, react-router, security]
minutes: 18
---

## The big picture

> [!TERMS]
> - **Server-driven table** - a table where the server does the filtering, sorting and paging, and the browser only shows one page.
> - **API** - the real backend service that owns the data.
> - **BFF (backend for frontend)** - a small server that sits between the browser and the real API, shaped around what one screen needs.
> - **Route / loader** - in React Router, a URL your app answers; the loader is the function that runs on the server for that URL.
> - **Cache** - a place to keep a recent answer so you do not have to ask the API again.
> - **Scope / entitlements** - which rows a particular user is allowed to see.
> - **Schema (zod)** - a written-down shape for data, checked at runtime, so bad data fails loudly.
> - **SSR (server-side rendering)** - building the first HTML on the server so the page arrives with content already in it.
> - **Hydration** - React in the browser attaching itself to that server HTML. Both sides must produce identical HTML.

> [!TLDR]
> When the data is too big, or too private, to send to the browser, the table moves to the server.
> Three small routes - the list, the filter options and the CSV export - all run the same logic on the same cached data.

In part 1, all 240 rows lived in the browser.
Now imagine tens of thousands of trade orders.
And imagine a rule: a trader on the FX desk must **never** receive a Rates order - not even hidden in data they never look at.

Filtering in the browser cannot keep that promise.
If the browser hides a row, the browser already has the row.
So the filtering has to happen before the data leaves the server.

| Why move to the server | What goes wrong in the browser |
| --- | --- |
| Size | You cannot ship 50,000 rows on every visit |
| Privacy | "Hidden" rows have already been downloaded |
| Consistency | The table, the dropdowns and the export can each end up slightly different |

![Three route files (list, filter options, CSV) each pointing down into one shared bff folder holding the per-user cache, the pure compute module and the zod schema, with the cache alone calling the upstream Trading API](images/02-ssr-bff-data-table/route-triple-one-pipeline.png)

> [!ANALOGY]
> The real API is a warehouse.
> The BFF is the shop counter in front of it: it checks who you are, fetches only what you are allowed to buy, and hands it over neatly packed for this one screen.

Here the BFF is not a separate service.
It is a few extra routes inside the same React Router app, sharing the same login cookie and the same TypeScript types.
Files ending in `.server.ts` never get sent to the browser, so secrets stay on the server.

> [!NUANCE]
> Not every table needs this.
> A small table on a detail page with nothing to compute is fine loading its rows directly and doing the work in the browser, like part 1.

## One request, six steps in a fixed order

> [!TLDR]
> Every list request does the same six things, always in the same order: check permission, read the query, get the data, compute the page, check its shape, send it back.

![The list loader as six numbered steps inside a server box: permission check, per-user cache, upstream fetch on a miss, pure compute, zod parse, and a private no-store response back to the browser](images/02-ssr-bff-data-table/bff-loader-pipeline.png)

```tsx
export const loader = async ({ request }: Route.LoaderArgs) => {
  const caller = await requirePermission(request, "orders:read"); // 1. who are you?
  const parsed = parseOrdersParams(new URL(request.url).searchParams); // 2. what do you want?

  if (!parsed.success) return data({ error: "invalid_params" }, { status: 400, headers: NO_STORE });

  const baseline = await getOrdersBaseline(caller); // 3. get the data (cached)
  const page = computeOrders(baseline, parsed.data, caller.desks); // 4. work out the page
  return data(ordersResponseSchema.parse(page), { headers: NO_STORE }); // 5. check shape, 6. send
};
```

Permission comes first so an unauthorised request costs nothing.
The permission check returns a `Caller`: the user's id, their access token for the real API, and the desks they may see.

> [!NUANCE]
> - There is no `?desk=FX` in the URL anywhere. **The user's allowed desks come from their login token, never from the browser**, because the browser can be edited.
> - When the user is not logged in, a BFF route must answer 401 (not logged in) or 403 (not allowed).
>   If it redirects to the login page instead, `fetch` quietly follows the redirect, receives an HTML page, and then fails to read it as JSON with a confusing error.

> [!INTERVIEW]
> - *Why not accept the desk from the client?* Anything that decides what a user may see has to come from something they cannot edit: their token.

## The pure compute step

> [!TLDR]
> All the table logic lives in one file, `compute.ts`, that only transforms data.
> It never fetches, never reads the clock and never looks at the request, which makes it trivial to test.

A **pure function** gives the same output for the same input, every time, and touches nothing else.
That is what makes it easy to test: hand it rows, check what comes out.

> [!STEPS]
> 1. **Scope.** Keep only rows from the user's desks - even if the API already did.
> 2. **Filter and search.** Apply the tab, the dropdown filters, then the search box.
> 3. **Sort, with a tie-breaker.** When two rows are equal, fall back to the order id, so rows never swap places between pages.
> 4. **Page, with a clamp.** If someone bookmarked page 40 and the list shrank, show the last page instead of nothing.

> [!NUANCE]
> - Re-applying the desk scope looks like duplicate work. Keep it.
>   An API document saying "we support this filter" is not proof the API actually applies it.
>   Re-checking costs a little bandwidth; skipping it can show a trader someone else's orders.
> - Write that rule as the very first unit test, so deleting the scope step fails the build.

## The per-user cache

> [!TLDR]
> Keep each user's recent data for about 30 seconds, keyed by their user id.
> The list, the dropdown options and the export then share one trip to the API.

```ts
export const getOrdersBaseline = (caller: Caller) => {
  const key = `${caller.userId}|${[...caller.desks].sort().join(",")}`;
  const hit = cache.get(key);

  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = fetchOrdersBaseline(caller);
  promise.catch(() => cache.delete(key)); // a failed fetch removes itself, so the next try retries
  cache.set(key, { promise, expiresAt: Date.now() + TTL_MS });

  return promise;
};
```

Notice we store the **promise** (the "answer is coming" object), not the finished data.
If three requests arrive a few milliseconds apart, the second and third simply wait on the first one's trip instead of starting their own.

> [!NUANCE]
> - On the server, one `Map` is shared by **every user**. A key without the user id in it hands one trader's orders to the next.
> - The trip to the API uses the user's own token, and it has a ceiling (say 5,000 rows). A loop with no ceiling against someone else's API is an outage waiting for a busy day.
> - Do not count "total orders" from your own capped fetch. A capped fetch once reported a neat 5,000 that looked real. Ask the API for the true total, and show a "this list was cut short" warning.

> [!GOTCHA]
> There is a second cache you never wrote: the browser's own.
> If the BFF answers with `Cache-Control: private, max-age=10`, the browser may replay that answer by URL alone for ten seconds.
> So after one person logs out, the next person to log in on that same laptop can briefly see the previous person's table.
> Send `private, no-store` from every BFF route, and add a test that reads each route file and fails if `max-age` appears.

## One shape, checked on both ends

> [!TLDR]
> Describe the response once with a zod schema.
> The server checks its answer before sending it, and the browser checks it again on arrival.

> [!NUANCE]
> - The server-side check catches bugs in `compute.ts` where the server logs are.
> - The browser-side check catches **version skew**: a newly deployed server talking to an older page still open in someone's tab.
>   It fails at the door instead of showing `undefined` in a cell.
> - The URL's query parameters get a schema too, with every default written in, so an empty URL means "the default view".
> - An unknown tab is an error (400), because falling back would show the wrong rows under the right heading.
>   A junk filter value just means "no filter", which the user can see.
> - One function builds query strings for the list, the export link and the page URL, so they can never disagree.

## The browser side: "manual mode" and the URL

> [!TLDR]
> The browser shows rows it did not sort, filter or page itself, so you tell TanStack "the server already did this".
> Everything the user chose lives in the URL, so a view can be bookmarked or pasted to a colleague.

> [!STEPS]
> 1. **Fetch with React Query**, a library that fetches, caches and refetches data for you. Keep the old rows visible while the next page loads.
> 2. **Throw on errors.** Never turn a failed request into an empty list - an empty table says "no orders", which hides the outage.
> 3. **Read sort and page from the URL.** Any change that is not a page change goes back to page 1.
> 4. **Debounce the search box into the URL**, so every keystroke does not become a new request.
> 5. **Turn on `manualSorting`, `manualFiltering` and `manualPagination`.** Without them TanStack re-sorts the one page it holds as if it were everything.

> [!NUANCE]
> - Only allow sorts the server understands, by checking the column id against the server's list.
> - Use a constant empty array for "no rows yet". `?? []` makes a new array every render, and TanStack treats that as new data.

![The Trade orders blotter on the Working tab: tabs, search, three filter pickers, ten rows and a footer reading 1-10 of 198, Page 1 of 20](images/02-ssr-bff-data-table/working-tab-default.png)

## Dropdown options, and reusable columns

> [!TLDR]
> The filter dropdowns get their options from a separate route that looks at **all** of the user's data, not the filtered page.
> Columns are small functions you mix and match per tab.

![Side by side: deriving Symbol options from the filtered rows leaves a picker with only NVDA in it, while a second route that ignores the filters keeps every symbol available with NVDA checked](images/02-ssr-bff-data-table/filter-options-baseline.png)

Look at the left side of that picture.
If the dropdown's options came from the filtered rows, picking "NVDA" would leave only "NVDA" in the list.
You could never pick a second symbol.

> [!NUANCE]
> - Options load only when a dropdown is first opened, then stay cached for the visit.
> - Sort options "naturally" so `ZNZ6` comes before `ZNZ26`.
> - Keep column labels and widths in a plain config file, so the CSV export can reuse the same labels.
> - JavaScript's `{ ...a, meta: {...} }` replaces `meta` completely rather than merging it. Spread the old meta back in, or labels vanish.
> - Build the columns inside `useMemo` keyed by the tab, so switching unrelated state does not rebuild them.

## First paint, hydration and CSV

> [!TLDR]
> You can pre-fill the first page on the server, or show placeholders and fetch after load.
> Either way, every cell must print exactly the same text on the server and in the browser.

| Choice | Good | Cost |
| --- | --- | --- |
| Pre-fill on the server | Rows are in the very first HTML | Clicking the menu link waits until the data is ready |
| Fetch after load | The page opens instantly | The first view is grey placeholder rows |

> [!NUANCE]
> - Pin the time zone, the 12/24-hour clock and the locale in your formatters.
>   Otherwise the server formats "14:31" in its zone and the browser in the user's, and React complains the HTML does not match.
> - Never compute "2 hours ago" from the current time while drawing. The server sends an `asOf` time instead.
> - Create React Query's client inside the component, never as a shared module variable, or users share a cache.
> - The CSV route runs the same pipeline without paging. With selected ids it exports exactly those, still limited to the user's desks.
> - While the next page loads, dim the old rows and mark the table busy for screen readers.

> [!WIN]
> One pipeline, three routes, no drift: the table, the dropdowns and the export always agree, and no request can widen what its user is allowed to see.

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
