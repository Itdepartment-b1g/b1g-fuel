# Measurement API

Company-owned definitions for dynamic numeric inputs. All routes require an authenticated session and the corresponding `measurements.view`, `.add`, `.edit`, or `.delete` permission. Register the Measurements page and these permissions on the user's role. Super admins have access automatically. The management page is available at `/measurements`.

## Create

`POST /api/measurements`

```json
{
  "company_id": "30000000-0000-4000-8000-000000000001",
  "name": "Dimensions",
  "fields": [
    { "key": "length", "label": "Length" },
    { "key": "width", "label": "Width" },
    { "key": "height", "label": "Height" }
  ],
  "units": [
    { "key": "cm", "name": "Centimeter", "symbol": "cm" },
    { "key": "m", "name": "Meter", "symbol": "m" }
  ]
}
```

Returns `201` with `{ "measurement": ... }`, including stable IDs, company, authenticated creator, timestamps, fields, and units. Fields are numeric; `required` and `is_active` default to true. Units default to active. `position` defaults to the entry's zero-based position. Keys use lowercase letters, numbers, and underscores, starting with a letter. Definitions support up to 30 fields and 30 units, including inactive entries. At least one field and unit must be active. Names are unique per company ignoring case; unit symbols are unique within a measurement ignoring case.

## Read

- `GET /api/measurements?page=1&page_size=10&search=dimensions`
- `GET /api/measurements?company_id=<uuid>&is_active=true`
- `GET /api/measurements?id=<uuid>`
- `GET /api/measurements/options` (requires `measurements.add`; returns only companies where the user can create measurements)

Lists return `{ "measurements": [...], "total": 1, "page": 1, "page_size": 10 }`. Each measurement includes `company: { id, name }`. Page sizes are 10, 20, 50, or 100. Sorting supports `id`, `name`, `created_at`, and `updated_at`, with `sort_order=asc|desc`; default is newest first. Archived records are included unless filtered. Child entries include inactive definitions so management can restore them; variant forms should select active measurements and display active fields and units only.

## Update

`PATCH /api/measurements`

```json
{
  "id": "<measurement UUID>",
  "name": "Package dimensions",
  "fields": [{ "key": "length", "label": "Length", "required": true }]
}
```

At least one change is required. Company and creator cannot be changed. Supplied child entries are upserted by key with stable IDs; omitted children are preserved. Each supplied entry is a full definition: omitted booleans take their defaults and omitted position uses its position in the submitted array. Send `is_active: false` on a child to deactivate it. Reuse its original key to restore it. Keep keys semantically stable; creating a new key adds a new definition. Updates run in a transaction with a measurement row lock.

## Archive

`DELETE /api/measurements?id=<uuid>` archives the definition and returns `{ "id": "...", "message": "Measurement archived." }`. It does not delete fields or units. Restore with `PATCH` containing `{ "id": "...", "is_active": true }`.

## Deployment and scope

Apply the checked-in migration using the project's normal `npm run db:deploy` workflow, then generate the Prisma client if needed. The migration is prepared separately from deployment. Unit conversion and variant measurement values are outside this initial backend. A variant will choose one allowed unit for all fields in a selected measurement, such as Length/Width/Height in centimeters.
