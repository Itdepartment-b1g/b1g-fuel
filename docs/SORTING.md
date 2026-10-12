# Server list sorting

Import `build_sort`, `parse_sort` and `Sorting` from `@/server/lib/sorting`. Controllers validate `sort_by` and `sort_order` against the allowed fields in each resource schema, then pass the selection through the service to its repository list function.

- Users: id, name, email, created_at, updated_at.
- Companies: id, name, created_at, updated_at.
- Roles: id, name, slug, scope, is_default_role, created_at, updated_at.

Example: `GET /api/users?sort_by=name&sort_order=asc&page=1&page_size=20`.

Omitting both parameters preserves created_at descending, then id ascending. Selecting a field without a direction defaults to ascending, except created_at defaults to descending. Providing only a direction applies it to created_at. Unknown fields, repeated or nested parameters, and directions other than asc/desc return HTTP 400.

Repositories map allowed fields to typed Prisma orderBy clauses with build_sort. Ordering runs in the database before skip/take, and id ascending breaks equal values unless id itself is selected. Search filters and total counts remain independent of ordering. The existing pagination component does not supply sort controls yet.
