# Material requests

Open **Material requests** to create a draft for a hub, choose a linked supplier, and add products from that supplier's read-only catalog. Catalog search and pagination return IDs, product labels, brand, variant, product type, and base units. Products are not copied into the requesting company's catalog, and costs, purchase orders and unrelated supplier records remain private.

Create and Edit show selected materials in the shared TableView with **Brand**, **Variant**, **Unit of Measure**, and editable **Qty** columns, plus a Remove action. Those columns wrap inside the dialog so the dialog scrolls vertically only. The view dialog uses the same fitting layout for requested materials. The variant column reads as the variant name and product type, for example `Premium (Fuel)`. Brand, variant, and product type come from separate API fields, preserving names that contain slashes. Quantity limits and validation remain unchanged. Draft editing uses current brand, variant, and product type names; submitted `product_label` snapshots remain unchanged.

## Workflow

The list uses the shared SearchFilterBar for request-number/hub/supplier search, creation-date presets or a custom Manila date range, request status, and request-number/hub/supplier conditions. Values within one condition field match any choice; different fields must all match. Filter choices and counts include only requests the user can view. Filtering and sorting happen on the server before pagination. Changes to search, filters, sorting, or page size reset the list to page 1.

The table uses shared column menus for Default, Ascending, Descending, and Freeze/Unfreeze. Reviewed by supports freezing only because it is derived from event history. The table/card switch displays the same API page and actions in either view. Page sizes use the shared 10/20/50/100 choices.

`draft → submitted → approved / rejected`

The create form offers **Save as draft** and **Submit request**. Drafts remain editable without a request number. Submit request creates and submits in one transaction, assigns a number, and makes the request available for supplier review. Submission requires requesting-side edit permission as well as add permission; failed submission leaves the form open without creating an extra draft.

The table shows **View draft** for drafts and **View** after submission, plus Approve and Reject for requests the current user can review. **Reviewed by** shows **Awaiting review** while submitted, then the approving or rejecting user's name after review. The preview shows MR details and the requested-items table; activity history is in the separate Timeline dialog. Clicking Approve or Reject in the preview opens a confirmation dialog with the effects of the action, a required acknowledgment checkbox, and an optional note. Failed requests keep the confirmation open for retry.

The requesting side can edit drafts, submit drafts, or cancel drafts only. Supplier reviewers can approve or reject submitted requests. Approval and rejection accept an optional note. Approval accepts all requested quantities and assigns a warehouse owned by the supplying company. Approved/rejected/cancelled requests cannot be edited or cancelled. Partial approval, dispatch, receiving, inventory movements and hub-to-hub transfers are future work.

Supplier users cannot see drafts, including drafts cancelled without submission. Deactivating a company supply link stops new drafts and submissions; already-submitted documents remain available for review. Historical requests do not disappear when a link becomes inactive.

## Ownership and permissions

`material_request` stores both company IDs, the requesting hub, the supply relationship and an optional supplying warehouse. The server derives the requesting company from the hub and validates the active directed relationship. Products must belong to the supplier. Approval automatically uses the reviewer's single assigned active warehouse in the supplying company, or that company's only eligible active warehouse. The name appears in the preview and confirmation. Missing or ambiguous warehouses block approval with a setup message; rejection remains available. A supplied warehouse ID must match the automatically resolved warehouse, preventing approval with an outdated preview.

Configure the **Material requests** page and permissions in roles/memberships. Existing roles are not automatically granted access. Super Admin already has access. `materialRequests.view`, `.add`, and `.edit` govern reads, draft creation, and workflow changes. No deletion endpoint is provided.

Company scope applies only to that company's side of a request. Own scope follows current location assignments, including hub access for requester staff. A supplier reviewer needs company scope to review submitted requests before a warehouse is assigned. Warehouse-own visibility applies after warehouse assignment. Supply linking itself remains Super Admin-only.

## Numbering

The requesting company's initials are generated automatically from its name: **B1G Fuel Distribution → BFD**. No Company code is required. Punctuation separates words; initials are uppercase and limited to 46 characters to fit the stored request number.

Drafts display **Draft** and do not consume a number. Submission allocates `MR-{INITIALS}-{YYYYMM}-{0000001}`, for example `MR-BFD-202610-0000001`, then `MR-BFD-202610-0000002`. The counter is per requesting company and Manila calendar month, resetting each month. Number uniqueness is scoped to the requesting company, so companies with matching initials can both submit requests. Existing numbers remain unchanged when a company is renamed. A database upsert increments the counter atomically; the request number, submitted status, product/unit snapshots and timeline event are committed in the same transaction. Row locks prevent concurrent actions from acting on an outdated request state. Submitted requests cannot be cancelled. Historical cancelled requests retain any previously assigned number.

## Models and history

- `material_request`: header, ownership, status, dates, creator and number.
- `material_request_item`: supplier product, base unit, decimal requested/approved quantities and submitted display snapshots.
- `material_request_event`: append-only API timeline recording action, old/new status, note, actor and timestamp.
- `material_request_counter`: one atomic counter per company/month.

Timeline events are generated by the server with each operation; there are no event update/delete endpoints. Request, item and event references restrict deleting historical source records. RLS is enabled without public policies, matching the backend-only access pattern. The initial version uses product base units; alternate unit conversions require an explicit conversion model later.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/material-requests` | Paginated accessible requests; supports search/status |
| GET | `/api/material-requests?id=UUID` | Details, timeline and allowed actions |
| POST | `/api/material-requests` | Create draft |
| PATCH | `/api/material-requests?id=UUID` | Replace draft contents; hub/supplier stay fixed |
| POST | `/api/material-requests/action` | Submit, approve, reject or cancel |
| GET | `/api/material-requests/options` | Accessible hubs, suppliers and reviewer warehouses |
| GET | `/api/material-requests/catalog` | Paginated linked supplier products |

Swagger includes full request and response contracts under **Material requests**. Redux owns all requests and guards stale responses and duplicate mutations. Dialogs retain inputs on failure and use shared toast feedback.

Apply migrations with `npm run db:deploy`. Verify with `npm run test:material-requests`, `npm run typecheck`, and `npm run build`. Database tests require a configured localhost database. Workflow fixtures roll back; the concurrent numbering test creates an isolated temporary company and removes it in `finally`.
