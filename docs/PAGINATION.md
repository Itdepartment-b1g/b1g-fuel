# Shared GET pagination

The frontend counterpart is `Pagination` in `src/components/common/pagination.tsx`. It consumes `PaginationMetadata` with `page`, `limit`, `total`, `total_pages` and navigation flags, plus parent callbacks. Use `paginationFromApi` to adapt the existing API format. See [responsive pagination](RESPONSIVE_PAGINATION.md) for desktop/mobile controls, array helpers and complete examples. Users explicitly retains 10/20/50/100 options, resets to page 1 on search/filter/limit changes, and clamps its page after totals shrink.

Import `parsePagination`, `paginationMetadata` and the `Pagination` type from `@/server/utils/pagination`.

Controllers parse `req.query` once and pass the result into their service/repository. The repository uses Prisma `skip` and `take`, counts records with the same filters, and attaches the shared metadata to its resource array:

```ts
// Controller
const pagination = parsePagination(req.query);
res.json(await resourceService.list_resource(pagination));

// Repository (inside list_resource).
return getDatabase().$transaction(async tx => {
  const records = await tx.resource.findMany({ where,
    skip: pagination.skip, take: pagination.take,
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });
  const total = await tx.resource.count({ where });
  return { records, ...paginationMetadata(total, pagination) };
}, { isolationLevel: "RepeatableRead" });
```

Replace `resource` with the generated Prisma model delegate and use the endpoint's array key. Import `getDatabase` from `@/server/utils/database`. Use the same transaction/snapshot for rows and count when consistency during concurrent writes matters, as the users, roles and companies repositories do. Apply authorization and ownership filters to both queries.

Query parameters: `page` defaults to 1 and is capped at 1,000,000; `page_size` defaults to 10 and accepts only 10, 20, 50 or 100. Import `DEFAULT_PAGE_SIZE` and `PAGE_SIZE_OPTIONS` from `@/lib/pagination` for client controls. Responses keep `{ total, page, page_size }`. Empty lists and pages past the last result return an empty array without changing the requested page.

Customize limits per endpoint using `parsePagination(req.query, { defaultPageSize: 10, maxPageSize: 50, maxPage: 10000 })`. The default must belong to the allowed options and not exceed the endpoint maximum. Invalid server configuration throws an ordinary error. Malformed, repeated, nested, nonpositive, unsupported or out-of-range query values throw `PaginationError`, which the Express error middleware returns as HTTP 400. Unsupported page sizes are rejected rather than silently clamped.
