# Material requests

Open **Material requests** and choose **Create request**. A source dialog appears before the request form. **Warehouse** continues to the form and requests materials from a linked supplying company's warehouse. **Other hub** asks another hub in your company, and **Other company** asks a hub at another company; both show a coming-soon notice. After Warehouse, create a draft for a hub, choose a linked supplier, and add products from that supplier's read-only catalog. Catalog search and pagination return IDs, product labels, brand, variant, product type, and base units. Products are not copied into the requesting company's catalog, and costs, purchase orders and unrelated supplier records remain private.

Create and Edit show selected materials in the shared TableView with **Brand**, **Variant**, **Unit of Measure**, and editable **Qty** columns, plus a Remove action. Those columns wrap inside the dialog so the dialog scrolls vertically only. The view dialog uses the same fitting layout for requested materials. The variant column reads as the variant name and product type, for example `Premium (Fuel)`. Brand, variant, and product type come from separate API fields, preserving names that contain slashes. Quantity limits and validation remain unchanged. Draft editing uses current brand, variant, and product type names; submitted `product_label` snapshots remain unchanged.

## Workflow

The list uses the shared SearchFilterBar for request-number/hub/supplier search, creation-date presets or a custom Manila date range, request status, and request-number/hub/supplier conditions. Values within one condition field match any choice; different fields must all match. Filter choices and counts include only requests the user can view. Filtering and sorting happen on the server before pagination. Changes to search, filters, sorting, or page size reset the list to page 1.

The table uses shared column menus for Default, Ascending, Descending, and Freeze/Unfreeze. Reviewed by, Total SKUs, and Total Qty support freezing only. Total SKUs counts the requested lines, and Total Qty sums their requested quantities. Units stay on each line in the expanded materials table. The table/card switch displays the same API page and actions in either view. Page sizes use the shared 10/20/50/100 choices.

`draft → submitted (Pending) → approved → partially dispatched / fully dispatched → partially received → received (Completed) / closed`, or `rejected` from review. `cancelled` remains available for drafts. The table shows one **Request Progress** badge for that status. Receiving progress stays in place when a later dispatch is posted. A request is Completed only when every requested quantity has been received.

The create form uses the signed-in user's current hub assignment and does not offer other hubs. A person assigned to more than one hub chooses only among those hubs. Someone with no hub assignment cannot create a request. The form offers **Save as draft** and **Submit request**. Drafts remain editable without a request number. Submit request creates and submits in one transaction, assigns a number, and makes the request available for supplier review. Submission requires requesting-side edit permission as well as add permission; failed submission leaves the form open without creating an extra draft.

The table and cards keep **View draft** or **View**, plus **Timeline**, in a vertical three-dot menu. Each menu item shows its icon. While a request is submitted and the current user can review it, **Approve** and **Reject** sit beside that menu, with a green check and a red cross. While the supplying warehouse can still dispatch, **Dispatch** sits beside that menu. While dispatched quantity is waiting at the requesting hub, **Receive** sits beside that menu. **Reviewed by** shows **Awaiting review** while submitted, then the approving or rejecting user's name after review. The preview and expanded row show the requested, dispatched, received, and remaining quantities, plus each posted dispatch and receipt. Activity history is also in the separate Timeline dialog. Clicking Approve or Reject in the preview opens a confirmation dialog with the effects of the action, a required acknowledgment checkbox, and an optional note. Failed requests keep the confirmation open for retry.

The requesting side can edit drafts, submit drafts, or cancel drafts only. Supplier reviewers can approve or reject submitted requests. Approval and rejection accept an optional note. Approval accepts all requested quantities and assigns a warehouse owned by the supplying company. Approved and later requests cannot be edited or cancelled.

The supplying warehouse dispatches available stock in one or more posted documents. Each dispatch receives `MRD-{INITIALS}-{YYYYMM}-{0000001}`, counted per supplying company, and deducts `stock_balance` at that warehouse through an append-only `stock_movement`. A line cannot exceed remaining requested quantity or warehouse stock. Dispatch is available from approved, partially dispatched, fully dispatched, and partially received requests while requested quantity remains. A later dispatch keeps Partially Received when any quantity has already been received.

The requesting hub confirms what arrived. Each receipt receives `MRR-{INITIALS}-{YYYYMM}-{0000001}`, counted per requesting company, and adds stock at the requesting hub. A receipt cannot exceed dispatched quantity that has not yet been received. Partial receipt sets Partially Received. The request becomes received, shown as Completed, when every requested quantity has been received. Closing a short receipt and hub-to-hub transfers remain future work. Purchase-order receiving does not post this stock.

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
- `material_request_item`: supplier product, base unit, decimal requested, approved, dispatched, and received quantities, and submitted display snapshots. `dispatched_qty` cannot pass `requested_qty`. `received_qty` cannot pass `dispatched_qty`.
- `material_request_event`: append-only API timeline recording action, old/new status, note, actor, timestamp, and the receipt when the event is a posted receipt.
- `material_request_dispatch` and `material_request_dispatch_item`: posted warehouse dispatches. Each line stores quantity, unit, and base quantity.
- `material_request_receiving`: a draft or posted receipt for one request, stored for the requesting company and received at that request's hub. A request has at most one draft receipt. The receipt number is assigned when the receipt posts.
- `material_request_receiving_item`: one received quantity for a request line, with the unit conversion snapshotted as `content_per_unit` and `base_qty`.
- `stock_balance`: on-hand quantity for one location and supplier product. Dispatch decreases the warehouse balance. Receipt increases the hub balance.
- `stock_movement`: append-only record of each dispatch out and receipt in, tied to the dispatch or receipt line and the user who posted it.
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
| POST | `/api/material-requests/dispatch` | Dispatch available warehouse stock for an approved request |
| POST | `/api/material-requests/receive` | Confirm receipt of dispatched quantity at the requesting hub |
| GET | `/api/material-requests/options` | Accessible hubs, suppliers and reviewer warehouses |
| GET | `/api/material-requests/catalog` | Paginated linked supplier products |

Swagger includes full request and response contracts under **Material requests**. Redux owns all requests and guards stale responses and duplicate mutations. Dialogs retain inputs on failure and use shared toast feedback.

Apply migrations with `npm run db:deploy`. Verify with `npm run test:material-requests`, `npm run typecheck`, and `npm run build`. Database tests require a configured localhost database. Workflow fixtures roll back; the concurrent numbering test creates an isolated temporary company and removes it in `finally`.
