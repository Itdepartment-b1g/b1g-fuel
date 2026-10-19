# Company supply relationships

`company_supply_relationship` is a directed authorization from one requesting company to one supplying company. Companies A, C, and D can each have an active relationship with Company B, the central warehouse company. A requester can also have several suppliers. A link does not automatically authorize the reverse direction.

## Model

| Field | Meaning |
| --- | --- |
| id | Relationship UUID |
| requesting_company_id | Company whose hubs request materials |
| supplying_company_id | Company whose warehouse supplies materials |
| is_active | Whether this relationship allows new requests; defaults to true |
| created_by | Super Admin who originally configured the link; audit UUID |
| created_at / updated_at | Creation and last-update timestamps |

Company relations are named `supply_relationships_as_requester` and `supply_relationships_as_supplier`. A unique pair prevents duplicate links, including inactive duplicates. Reactivate the existing link when supply resumes. A database CHECK prevents self-links on both insert and update. Foreign keys require both companies to exist and restrict deleting a referenced company. Indexes support requester-pair lookup, active relationships for a supplier, and creator lookup.

Company memberships and location ownership remain independent. Establishing a relationship does not assign users to another company or expose that company's records. This model does not itself move inventory or match products across company catalogs.

## Implementation boundary

The Prisma model, migration, Express API, Redux state, Swagger documentation, and Companies dialog are implemented. In Companies, open a company's actions menu and choose **Supply links**. **Suppliers** links that company to suppliers; **Requesting companies** links requesters to that company. Both the company picker and existing links support search and pagination. Existing links show their status, creator, and creation date, with activation/deactivation controls.

All setup endpoints require the global Super Admin role, enforced by route middleware and service guards. Company permissions alone do not grant access. The server captures `created_by` from the session and preserves the company pair and creator on status changes. Inactive links remain excluded from the picker; reactivate the existing link instead. There is no deletion endpoint.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/company-supply-relationships` | Paginated links filtered by company, direction, search, and status |
| GET | `/api/company-supply-relationships/options` | Paginated eligible counterpart companies |
| POST | `/api/company-supply-relationships` | Create a requester/supplier pair |
| PATCH | `/api/company-supply-relationships` | Activate or deactivate an existing link |

Reads require `company_id`; `direction=requesting` returns that company's suppliers, while `direction=supplying` returns its requesters. POST accepts only `requesting_company_id` and `supplying_company_id`. PATCH accepts only `id` and boolean `is_active`. Detailed schemas are available in Swagger under Company supply.

Future material requests must verify an active relationship when submitted and validate the hub against the requesting company and the warehouse against the supplying company. Deactivation should stop new requests while preserving existing documents. Request models and product matching are not part of this migration.

Row-level security is enabled without public policies, following the existing backend-only access pattern. API authorization remains necessary because the backend database connection can bypass RLS.

## Apply and verify

Apply `20261019000000_company_supply_relationship` using `npm run db:deploy`. Run `npm run test:company-supply`, `npm run db:validate`, and `npm run typecheck`. The database test runs only against a configured localhost database and rolls back all fixtures.
