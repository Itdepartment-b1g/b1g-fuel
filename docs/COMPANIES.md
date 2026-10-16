# Companies UI, API and Redux

Open `/companies` as a global super-admin. The screen supports table/card views, name search, refresh, responsive pagination, and create/edit/delete dialogs. Default page size is 10; choices are 10/20/50/100. Search and page-size changes reset to page 1. When results shrink, the screen requests a valid page.

Components live directly in `src/components/companies`: `list.tsx`, `table.tsx`, `form.tsx`, and `dialog.tsx`. They reuse the shared pagination and deletion confirmation in `src/components/common`. Edits fetch fresh company details. Errors keep forms open, and pending mutations block repeated submission and dismissal.

Server record and write types live in `src/server/schema/companies_schema.ts`. Frontend components and Redux use `src/types/companies.ts`. These are separate contracts; neither file imports the other.

## API

All endpoints require an authenticated, provisioned user with the global `super_admin` role. Responses are private/no-store. Mutations require the configured application Origin.

| Method | URL | Behavior |
| --- | --- | --- |
| GET | `/api/companies` | List with `page`, `page_size` and optional name `search` |
| GET | `/api/companies?id=UUID` | Read one company as `{ company }` |
| POST | `/api/companies` | Create using `{ "name": "B1G Branch" }` plus optional `location_name` / `location_address`; returns `{ company, location }` with 201 |
| PATCH | `/api/companies` | Rename using `{ "id": "UUID", "name": "Updated Branch" }` |
| DELETE | `/api/companies?id=UUID` | Delete an empty company; returns `{ id, message }` |

Names are trimmed, required, and limited to 160 characters. IDs must be UUIDs. Unknown body fields are rejected. Names are not unique in the current schema. List search is case-insensitive and limited to 160 characters. Pagination uses the shared backend helper with page sizes 10/20/50/100.

Optional create fields: `location_name` creates a default `warehouse` location under the new company in the same transaction; `location_address` is stored only when a warehouse name is set. Company-only create (no location) remains valid. Edit does not change locations.

The list response is `{ companies, total, page, page_size }`. Each company includes `id`, `name`, ISO `created_at`/`updated_at` strings, `member_count`, and `location_count`.

Deletion returns 409 if the company has memberships. Remove or reassign those memberships through a separate workflow first. The UI disables deletion for companies with members; the service checks again inside a transaction. Locations cascade when a company is deleted. Renaming preserves memberships.

Validation and HTTP errors live in `companies_controller.ts`; business conditions live in `companies_service.ts`; Prisma queries and transaction-bound operations live in `companies_repository.ts`. Location table migration: `prisma/migrations/20261016080000_location`. Swagger documents Companies under `/docs`. See [Warehouse inventory](WAREHOUSE_INVENTORY.md).

## Redux

`src/lib/store/companies-slice.ts` is registered as `state.companies` and exports:

- `listCompany(query)`, `editCompany(id)`
- `createCompany(input)`, `updateCompany(input)`, `deleteCompany(id)`
- `selectCompany`, `resetCompanies()`, `clearCompanyMutation()`

Requests include session cookies. Thunks support `.unwrap()`; reads support `.abort()`. The slice tracks list/detail/mutation state separately, ignores stale reads, serializes mutations, and invalidates pending reads after a successful write. Components refetch the current list after mutations.

```ts
const { company, location } = await dispatch(
  createCompany({
    name: "B1G Branch",
    location_name: "Central Warehouse",
    location_address: "Optional address",
  }),
).unwrap();
await dispatch(listCompany({ page: 1, page_size: 10 })).unwrap();
```

The Companies repository exports named async functions: `list_company`, `list_by_id_company`, `create_company`, `update_company`, and `delete_company`. The service opens update/delete transactions and passes the transaction to repository calls; the ID lookup locks the company before reading membership counts. Search remains inside `list_company`.

The Companies service exports named async functions: `create_company`, `list_company`, `list_by_id_company`, `update_company`, and `delete_company`. It has no service factory or exported service object. Update/delete transactions and membership checks remain in these functions.
