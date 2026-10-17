# Roles UI, API and Redux

Server record and write types live in `src/server/schema/roles_schema.ts`. Frontend components and Redux use `src/types/roles.ts`. These are separate contracts; neither file imports the other.

All roles endpoints require a verified Supabase session, an existing database profile and the global `super_admin` role. Responses are private/no-store. Mutations require the exact application Origin and are rate limited.

## Management screen

Open `/roles` as a super-admin. The screen provides table/card views, name/slug search, scope filtering, refresh, and responsive pagination with 10/20/50/100 rows per page. Search, scope and page-size changes reset to page 1; shrinking results clamp the page to a valid value.

Create and edit dialogs use the Redux operations below. The form loads registered page and permission options. Editing fetches the current role, keeps slug/scope fixed, and preserves unchanged mappings. System roles cannot be edited or deleted; assigned roles cannot be deleted. The server independently enforces these rules. Delete requires confirmation, and failed mutations keep the dialog open with an error. Pending mutations disable controls and prevent accidental dismissal.

Components live directly in `src/components/roles`: `list.tsx`, `table.tsx`, `form.tsx`, and `dialog.tsx`. Shared list controls and deletion confirmation live in the existing `src/components/common` folder.

| Method | URL | Behavior |
| --- | --- | --- |
| GET | `/api/roles` | Paginated list; name/slug search and optional scope filter |
| GET | `/api/roles?id=UUID` | One role as `{ role }` |
| GET | `/api/roles/options` | Registered scope, page and permission choices |
| POST | `/api/roles` | Create a custom role; returns `{ role }` with 201 |
| PATCH | `/api/roles` | Update editable fields using body `{ id, ...changes }` |
| DELETE | `/api/roles?id=UUID` | Delete an unassigned custom role; returns `{ id, message }` |

List uses shared pagination: default 10 rows, allowed page sizes 10/20/50/100, `page` starting at 1. `search` is at most 100 characters. `scope` is `company` or `global`. With `id`, list filters are ignored. The list response is `{ roles, total, page, page_size }`.

Each role contains the model's scalar fields, ISO date strings, `pages` and `permissions` as key arrays, and `assignment_count` covering global and company-role assignments.

Super Admin attaches pages to company roles here. A role that includes the Users page is the warehouse supervisor role. The staff role must not include that page. A supervisor then checks dashboards for one staff member on the Users page, as described in [Company supervisors and staff](COMPANY_STAFF.md). This screen still edits the shared role only.

## Creation

```json
{
  "name": "Branch Manager",
  "slug": "branch_manager",
  "scope": "company",
  "is_default_role": false,
  "pages": ["users"],
  "permissions": ["users.view"]
}
```

Only `name` is required. It is trimmed and limited to 100 characters. Omitted slug is derived from the name; explicit slugs are trimmed/lowercased and must use letters, numbers, underscores or hyphens, start with a letter and fit within 100 characters. Names that cannot produce a valid slug need an explicit one. Scope defaults to company; default-role status defaults to false; mapping arrays default to empty.

Clients cannot set `is_system`, timestamps, IDs or assignment counts. `super_admin` is reserved for the application seed. Register page keys in `src/lib/auth/catalog.ts` and permission choices in `src/lib/auth/permissions.ts`. The current permission catalog contains the registered view permissions. Unknown or duplicate mapping keys are rejected; each array allows at most 200 entries. The form uses these catalogs through the options endpoint.

## Update and deletion rules

- Editable fields: `name`, `is_default_role`, `pages`, `permissions`. PATCH requires an ID and at least one editable field.
- Slug and scope stay fixed after creation to preserve stable role identity and assignment scope.
- Omitted mappings remain unchanged. Empty arrays clear mappings. Updates save the role and mapping replacements in one transaction.
- System roles and the reserved super-admin role cannot be edited or deleted.
- Only company roles can be defaults. The existing SQL CHECK and partial unique index permit at most one default. Clear the previous default first; this API does not silently replace it.
- Assigned roles cannot be deleted because assignment foreign keys restrict deletion. Delete returns 409 until assignments are removed through a separate workflow.
- Unassigned-role deletion cascades to its page and permission mappings.

400 indicates invalid input; 401 missing authentication; 403 insufficient access or a protected system role; 404 a missing role; 409 a conflicting slug/default or assigned-role deletion; 429 excessive mutations. Unexpected errors return the existing generic 500 response.

These endpoints manage definitions, not user assignments. A default flag does not automatically assign the role to a new membership. Stored pages and permissions do not enable company-scoped authorization; administrative APIs and management pages still require global super-admin access. Company grant resolution and action enforcement remain separate work.

## Redux

`src/lib/store/roles-slice.ts` is registered as `state.roles`. Exports:

- `listRole(query)` and `editRole(id)`
- `getRoleOption()`
- `createRole(input)`, `updateRole(input)`, `deleteRole(id)`
- `selectRole`, `resetRoles()`, `clearRoleMutation()`

All requests send cookies. Thunks support `.unwrap()` and retain HTTP status/message on rejection. Reads support `.abort()` and ignore older results. The slice serializes mutations, invalidates in-flight list/detail responses after mutation, and ignores late responses after reset. Successful mutation updates the selected matching role or clears a deleted selection; refetch the current list to preserve filtering and pagination.

```ts
const { role } = await dispatch(createRole({ name: "Branch Manager" })).unwrap();
await dispatch(listRole({ page: 1, page_size: 10 })).unwrap();
```

No schema migration is needed. Apply existing migrations so the custom default-role constraints and foreign keys are present; Generating migration files alone does not apply them. Swagger exposes the endpoints and request/response schemas under Roles.

The Roles controller and service expose `create_role`, `update_role`, `delete_role`, `list_by_id_role`, and `list_role`. Request validation and HTTP error handling are inline in these controller operations. The `/options` route returns static scope, page and permission choices directly. Role protections and update/delete transactions remain in the service.
