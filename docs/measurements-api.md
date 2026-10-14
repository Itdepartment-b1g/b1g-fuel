# Measurement API

Company-owned measurement names and the units people can choose. All routes require an authenticated session and the corresponding `measurements.view`, `.add`, `.edit`, or `.delete` permission. Register the Measurements page and these permissions on the user's role. Super admins have access automatically. The management page is available at `/measurements`.

## Create

`POST /api/measurements`

```json
{
  "company_id": "30000000-0000-4000-8000-000000000001",
  "name": "Weight",
  "units": [
    { "key": "kg", "name": "Kilogram", "symbol": "kg" },
    { "key": "g", "name": "Gram", "symbol": "g" }
  ]
}
```

Omit `company_id` when a super admin creates a measurement shared with every company. A user with one company can omit it too; the server uses that company. Returns `201` with `{ "measurement": ... }`, including stable IDs, company, authenticated creator, timestamps, and units. Keys use lowercase letters, numbers, and underscores, starting with a letter. Definitions support up to 30 units. Names are unique per company ignoring case; shared measurements have their own name uniqueness. Unit symbols are unique within a measurement ignoring case.

## Read

- `GET /api/measurements?page=1&page_size=10&search=dimensions`
- `GET /api/measurements?company_id=<uuid>`
- `GET /api/measurements?id=<uuid>`
- `GET /api/measurements/options` (requires `measurements.add`; returns only companies where the user can create measurements)

Lists return `{ "measurements": [...], "total": 1, "page": 1, "page_size": 10 }`. Each measurement includes `company: { id, name }` or null when it is shared. Page sizes are 10, 20, 50, or 100. Sorting supports `id`, `name`, `created_at`, and `updated_at`, with `sort_order=asc|desc`; default is newest first. Shared measurements are visible to anyone who can view measurements.

## Update

`PATCH /api/measurements`

```json
{
  "id": "<measurement UUID>",
  "name": "Mass",
  "units": [{ "key": "kg", "name": "Kilogram", "symbol": "kg" }]
}
```

At least one change is required. Company and creator cannot be changed. Supplied units are upserted by key with stable IDs; omitted units are preserved. Keep keys semantically stable; creating a new key adds a new unit. Updates run in a transaction with a measurement row lock.

## Delete

`DELETE /api/measurements?id=<uuid>` removes the measurement and its units and returns `{ "id": "...", "message": "Measurement deleted." }`. This cannot be undone. Shared measurements can be deleted only by a super admin.

## Deployment and scope

Apply the checked-in migration using the project's normal `npm run db:deploy` workflow, then generate the Prisma client if needed. The migration is prepared separately from deployment. Unit conversion and variant measurement values are outside this initial backend. A variant will choose one allowed unit for a measurement, such as Weight in kilograms.
