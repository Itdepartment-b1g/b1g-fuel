# Shared GET pagination

Import `parsePagination`, `paginationMetadata` and the `Pagination` type from `@/server/utils/pagination`.

Controllers parse `req.query` once and pass the result into their repository. The repository uses `skip` and `take` for Prisma, counts records with the same filters, and attaches the shared metadata to its resource array:

```ts
// Controller
const pagination = parsePagination(req.query);
res.json(await repository.list(pagination));

// Repository (inside list)
const records = await prisma.resource.findMany({
  where,
  skip: pagination.skip,
  take: pagination.take,
  orderBy: [{ created_at: "desc" }, { id: "asc" }],
});
const total = await prisma.resource.count({ where });
return { records, ...paginationMetadata(total, pagination) };
```

Replace `resource` with the actual model and `records` with the endpoint's array key. Use the same transaction/snapshot for rows and count when consistency during concurrent writes matters, as the users repository does. Apply authorization and ownership filters to both queries.

Query parameters: `page` defaults to 1 and is capped at 1,000,000; `page_size` defaults to 10 and accepts only 10, 20, 50 or 100. Import `DEFAULT_PAGE_SIZE` and `PAGE_SIZE_OPTIONS` from `@/lib/pagination` for client controls. Responses keep `{ total, page, page_size }`. Empty lists and pages past the last result return an empty array without changing the requested page.

Customize limits per endpoint using `parsePagination(req.query, { defaultPageSize: 10, maxPageSize: 50, maxPage: 10000 })`. The default must belong to the allowed options and not exceed the endpoint maximum. Invalid server configuration throws an ordinary error. Malformed, repeated, nested, nonpositive, unsupported or out-of-range query values throw `PaginationError`, which the Express error middleware returns as HTTP 400. Unsupported page sizes are rejected rather than silently clamped.
