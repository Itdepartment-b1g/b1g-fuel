# Responsive pagination

Component: `src/components/common/pagination.tsx`. Shared types and UI helper module: `src/lib/pagination.ts`. API query validation and database offsets: `src/server/lib/pagination.ts`.

## Metadata and helper

```ts
type PaginationMetadata = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
};

const result = paginateItems(items, requestedPage, limit);
// result.items contains only this page; the remaining fields are metadata.
```

`paginateItems` defaults to limit 10, validates a positive integer limit, computes `Math.ceil(total / limit)`, clamps the page and returns a slice without mutating the input. Empty arrays return `items: []`, page 1, zero total pages and false navigation flags. Fractional requested pages are truncated; NaN defaults to 1. Filter/sort the full dataset first.

`createPaginationMetadata(total, page, limit)` provides the same metadata without slicing. `paginationFromApi({ page, page_size, total })` adapts the current Users/Roles API format. Already-paginated server rows must not be sliced again. APIs returning the new metadata directly can pass it straight to the UI.

## Component contract

```tsx
<Pagination
  metadata={result}
  onPrev={() => setPage(result.page - 1)}
  onNext={() => setPage(result.page + 1)}
  onPage={setPage}
  onLimitChange={limit => { setLimit(limit); setPage(1); }}
  disabled={loading}
  className="your-wrapper-class"
/>
```

The parent owns page/limit. `onPrev` and `onNext` are required; `onPage` and `onLimitChange` are optional. With `onPage`, numbers can jump directly. Without it, only adjacent numbers navigate through Previous/Next; nonadjacent numbers are disabled. Current-page clicks, invalid bounds and loading clicks are ignored. The selector appears only with `onLimitChange` and defaults to 5/10/20/50; override with `limitOptions`.

At `sm` (640px) and above, show the optional Rows per page select on the left and Previous / Page X of Y / Next on the right. Numbered buttons are hidden. Below `sm`, hide those desktop controls and show chevrons with numbered buttons in a nav labeled Pagination. The current number has `aria-current="page"`. Native buttons/selects have accessible labels; decorative icons and noninteractive ellipses are hidden from assistive technology.

## Mobile number rules

| Situation | Numbers |
| --- | --- |
| Empty result | `1` with navigation disabled |
| At most 5 pages | Every page |
| Current is within the first 3 | `1, 2, 3, …, last` |
| Current is within the last 3 | `1, …, last-2, last-1, last` |
| Otherwise | `1, …, current-1, current, current+1, …, last` |

`mobilePageNumbers` implements these exact rules, including noninteractive ellipsis tokens. `pageNavigation` implements the safe jump/adjacent-callback decisions separately from presentation.

## Working integrations

**Server-backed Users:** `src/components/users/list.tsx` uses backend-filtered records, adapts total/page/limit metadata, and renders the new controls. Search, Quick Filter and limit changes reset the page to 1. A completed response with a smaller total clamps parent-owned page state and refetches that valid page. Canceled/stale requests cannot change it. Users explicitly passes its existing API options, 10/20/50/100; the reusable component's defaults remain 5/10/20/50.

**Client-side Users:** `src/components/users/table-view/paginated-users-table.tsx` exports `PaginatedUsersTable`. Supply a complete `UserSummary[]` dataset:

```tsx
<PaginatedUsersTable users={allUsers} />
```

It provides parent-controlled search, header sorting with a newest-first default, page and limit; filters/sorts before calling `paginateItems`; reuses the existing Users table; and normalizes page state when supplied records shrink. Its guarded local page update stabilizes state before rendering. It uses the generic 5/10/20/50 options. Do not pass one server page as if it were the full dataset.

Existing GET query conventions and response fields remain compatible. See [server pagination](PAGINATION.md) and [Quick Filter](QUICK_FILTER.md).
