# Hubs

A hub is a company-owned `location` with `type = hub`. Its required `company_id` is ownership; `created_by` is immutable creation history. The authenticated actor supplies the creator value. Warehouse rows are excluded from all hub operations.

## API

All endpoints require a verified session and return private, non-cacheable responses. Errors use `{ error }`. Lists use the standard `page` / `page_size` and return `total`, `page`, and `page_size`.

| Method | Endpoint | Permission / behavior |
| --- | --- | --- |
| GET | `/api/hubs` | `hubs.view`; search name/address, company_id, is_active, sort_by, sort_order, JSON-encoded filters |
| GET | `/api/hubs/filter-options` | `hubs.view`; permitted hub names, companies, and status counts |
| GET | `/api/hubs?id=UUID` | `hubs.view`; one hub |
| GET | `/api/hubs/options` | `hubs.add`; permitted companies |
| POST | `/api/hubs` | `hubs.add`; name, optional address and company_id |
| PATCH | `/api/hubs` | `hubs.edit`; id plus name, address, and/or is_active |
| DELETE | `/api/hubs?id=UUID` | `hubs.delete`; deactivates, preserves records and assignments |
| GET | `/api/hubs/assignment-options?location_id=UUID` | Company-level `hubs.edit`; paginated eligible company members; optional search |
| GET | `/api/hubs/assignments?location_id=UUID` | Company-level `hubs.edit`; paginated assigned staff; optional name/email search |
| POST | `/api/hubs/assignments` | Company-level `hubs.edit`; location_id and user_company_id |
| DELETE | `/api/hubs/assignments?location_id=UUID&user_company_id=UUID` | Company-level `hubs.edit`; removes assignment |

Company-level assignment management also accepts unrestricted global grants or super-admin access. Own-scope edit permission never permits changing assignments. Missing or inaccessible hubs return 404, including warehouse IDs.

## Company and staff access

For a creator with exactly one permitted company, omitted company_id selects that company. Multiple permitted companies, super-admins, and unrestricted global creators must select one. Explicitly requesting an unauthorized company returns 403. Company and creator cannot be changed on update. Name is unique among all locations in that company, including warehouses.

Company-scope hub grants cover that company's hubs. For hubs only, `own` means a current staff assignment within the grant's company, rather than matching created_by. This permits staff turnover without changing company ownership or historical creators. Creating a hub does not automatically assign the creator.

The new `user_location` model links a company membership to a location. Composite foreign keys enforce that both belong to the same company, and a unique key prevents duplicate assignments. `assigned_by` and `assigned_at` capture assignment creation. Repeated POST requests preserve those original audit fields.

Staff can have several hubs, and a hub can have several staff members. Any existing company member can be selected; no role-name checks are hardcoded. Assigning a location does not create roles, permissions, pages, or company memberships. A staff member still needs the relevant page and action grants to access hubs.

Hub edits, deactivation, and assignment changes lock the same location row. Inactive hubs cannot receive new assignments; existing assignments remain available for review/removal and are retained on reactivation. Removing a company membership removes its location assignments. Deleting a location with assignments is restricted by the database.

## Delivery

Apply `20261018120000_hub_assignments` before running the API. The Hubs page and its four permissions are registered in the access catalog for role configuration. The sidebar shows Hubs when the user has the page and hubs.view permission. Existing roles are not automatically granted hub permissions.

## Page and client state

`/hubs` renders `components/hubs/list.tsx`. The list loads a single page through `lib/store/hubs-slice.ts` and passes those rows to table and card views. Search, creation-date filters, hub/company conditions, active status, server sorting, and pagination use the API.

Create and edit use separate dialogs. Company and creator are read-only after creation. Deactivate asks for confirmation; Edit hub can reactivate. Assignment management shows checkbox chips with staff names and emails, one Assign button for the selection, and a Currently assigned list below a divider. Choices and assigned staff are paginated; selections persist across choice pages. The client assigns selected members through sequential requests while holding one mutation lock. If a request fails, completed assignments are refreshed and the remaining selection stays available for retry. Unassigning requires confirmation. Inactive hubs retain their staff list but cannot receive new assignments. Success and request failures use toasts; failed forms stay open for retry.

Redux guards responses by request ID and location, suppresses simultaneous mutations, and invalidates pending reads after writes. Frontend API contracts live in `types/hubs.ts`, separate from server schema types. Assignment buttons require company-level hub edit permission, matching the API.

Eligible members and current assignments include the person's current roles from that company membership. Both lists show Name (Role) - Email, with roles in extra-small text. Multiple roles are separated by commas; a membership without roles shows No role.

Both staff lists support separate server-side name/email searches and page sizes of 10, 20, 50, or 100. A search or page-size change resets that list to page 1. Users are ordered by their account's `created_at` descending before pagination, with a unique record ID as a stable tie-breaker. Selections persist across searches and pages.

Run `npm run test:hubs`, `npm run db:validate`, `npm run typecheck`, `npm run lint`, and `npm run build`. The hub suite includes Redux, rendered-component, controller, and database coverage. Database tests run only against a configured localhost database, use a rollback transaction, and preserve existing records.

Inventory balances, material requests, transfers, and a historical assignment-event log are future modules. Removing an assignment deletes that assignment link; future stock documents must retain their original actor/location references.
