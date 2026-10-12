# Server list sorting

Users, Companies and Roles use `src/server/lib/sorting.ts` to sort database results before pagination. The default is **latest created first**: `created_at` descending, followed by `id` ascending when creation timestamps are equal.

## Default order

Each repository configures:

```ts
default: { field: "created_at", direction: "desc" },
tieBreaker: { field: "id", order: { id: "asc" } },
```

When no sorting parameters are supplied, this produces:

```ts
orderBy: [{ created_at: "desc" }, { id: "asc" }]
```

Newly created records appear first. Updating a record does not move it to the top of the default list, because the default uses its creation date. The ID tie-breaker gives equal values a deterministic order across pages; records can still move between pages when data changes between requests.

## API parameters

| Parameter | Accepted values | Behavior when omitted |
| --- | --- | --- |
| `sort_by` | An allowed field for the resource | Uses `created_at` |
| `sort_order` | `asc`, `desc` | Uses `desc` for `created_at`, otherwise `asc` |

| Resource | Allowed fields |
| --- | --- |
| Users | `id`, `name`, `email`, `created_at`, `updated_at` |
| Companies | `id`, `name`, `created_at`, `updated_at` |
| Roles | `id`, `name`, `slug`, `scope`, `is_default_role`, `created_at`, `updated_at` |

Allowed fields are exported as `USER_SORT_FIELDS`, `COMPANY_SORT_FIELDS` and `ROLE_SORT_FIELDS` from the corresponding server schema modules. Swagger uses the same lists.

```text
GET /api/users
GET /api/users?sort_by=name&sort_order=asc&page=1&page_size=20
GET /api/companies?sort_by=updated_at&sort_order=desc
GET /api/roles?scope=company&sort_by=name&sort_order=asc
```

The first example uses newest-first ordering. `?sort_order=asc` alone lists the oldest creation dates first. `?sort_by=name` alone uses ascending names. Unknown fields, empty values, repeated or nested parameters, and directions other than `asc` or `desc` return HTTP 400 with `Invalid sorting parameters.`

Sorting does not change search filters or total counts. It orders the full set of matching records before `skip` and `take`; sorting only the current page would give incorrect results across pages.

## Controller and service

The controller validates query values with `parse_sort` and passes the selection through the service:

```ts
const sorting = parse_sort(req.query, USER_SORT_FIELDS);
const result = await userService.list_user(pagination, search, filters, sorting);
```

`parse_sort` returns `undefined` when both parameters are absent, letting the repository use its configured default. Controllers translate `SortingError` into HTTP 400. Services pass the selection to their repository without constructing database ordering.

## Repository configuration

Import `build_sort` and the `Sorting` type from `@/server/lib/sorting`. Map supported fields to typed Prisma clauses and pass the resulting array to `findMany`:

```ts
const orderBy = build_sort<Prisma.companyOrderByWithRelationInput>(sorting, {
  fields: {
    id: (direction) => ({ id: direction }),
    name: (direction) => ({ name: direction }),
    created_at: (direction) => ({ created_at: direction }),
    updated_at: (direction) => ({ updated_at: direction }),
  },
  default: { field: "created_at", direction: "desc" },
  tieBreaker: { field: "id", order: { id: "asc" } },
});

const companies = await tx.company.findMany({
  where,
  orderBy,
  skip: pagination.skip,
  take: pagination.take,
});
const total = await tx.company.count({ where });
```

`build_sort` rejects unconfigured fields and invalid directions, including direct repository calls. It appends the ID tie-breaker unless ID itself is selected, so `sort_by=id&sort_order=desc` produces only `[{ id: "desc" }]`.

For another resource, define its allowed field list in the schema, validate it in the controller, pass sorting through the service, and provide matching typed callbacks in the repository. Keep the default field and unique tie-breaker explicit in the configuration.

## Client integration and verification

Users, Companies and Roles table headers now expose Default, Ascending and Descending through the [reusable data table](DATA_TABLE.md). Their parent list screens send `sort_by` and `sort_order`, reset the page to 1 when sorting changes, and request a new server page. Default omits both parameters and restores newest-first ordering.

`tests/sorting.test.ts` covers validation, defaults, tie-breakers, repository ordering and controller-to-repository forwarding. Database scenarios verify ascending and descending results before slicing, equal-name ordering by ID, and unchanged totals. See [pagination](PAGINATION.md) for page-size and offset behavior.
