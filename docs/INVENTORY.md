# Inventory models

`facility` is the shared physical warehouse or hub, distinguished by `facility_type` (`warehouse` or `hub`). Former `location` records retain their IDs. Stock, purchasing, receiving and staff assignments use `facility_id`; material request fields keep their specific names `requesting_hub_id` and `supplying_warehouse_id`. Assignment links and history are named `user_facility` and `user_facility_history`.

The application API uses `facility`, `facility_id`, `facilities` and `facility_count` in place of the former location fields. Company creation accepts `facility_name` and `facility_address`. Deploy the migration, backend and frontend together; existing API consumers must use the renamed fields. The PO/receiving quick-filter key is now `facility`.

`inventory` (formerly `stock_balance`) holds one on-hand balance per facility and product. Quantity is a nonnegative decimal in the product's base unit. Brand, variant, product type and unit come from the product; company ownership comes from the facility, allowing a hub to hold a supplying company's products.

`stock_movement` records a positive base-unit quantity, direction, type, source line, actor and timestamp. Each source line can produce at most one movement:

| Type | Direction | Source |
| --- | --- | --- |
| `po_receive_in` | `in` | `po_receiving_item_id` → `receiving_item` |
| `dispatch_out` | `out` | `material_request_dispatch_item_id` |
| `receive_in` | `in` | `material_request_receiving_item_id` |

Database constraints require exactly one source matching the type and direction, and unique source links prevent duplicate movements. A database trigger rejects movement updates and deletions. Source foreign keys restrict deleting referenced document lines. Inventory and movement writes belong in the same posting transaction.

Migration `20261025120000_inventory_and_po_stock_movements` renames the balance table in place, preserving its data, nonnegative check and RLS. It fails rather than deleting historical duplicate source movements if any exist.

## Read API

All routes require an authenticated session and `inventory.view`. Register this page/permission on the appropriate roles or memberships; existing roles are not automatically granted access. Super Admin retains access. The Inventory navigation entry opens `/inventory`.

| Endpoint | Result |
| --- | --- |
| `GET /api/inventory` | `{ inventories, total, page, page_size }` |
| `GET /api/inventory?id=UUID` | `{ inventory }` |
| `GET /api/inventory/movements?inventory_id=UUID` | `{ movements, total, page, page_size }` |
| `GET /api/inventory/filter-options` | Accessible field choices, stock statuses and facility types with counts |

Balance responses include company, facility, product, brand, variant, product type, base unit, decimal quantity string and updated timestamp. Movement responses include direction, type, decimal quantity string, source line ID, actor and timestamp. They do not expose full source documents; those endpoints retain their own permissions.

Reads, counts and filter choices follow facility ownership, even when the product belongs to a supplying company. Company scope uses the grant company; own scope additionally requires a current facility assignment. All scope requires an explicit unbound global grant. Inaccessible balances and their histories return 404. Inactive facilities and existing zero balances remain readable; reads never create missing balance rows.

The list supports `search`, `page`, `page_size`, `sort_by`, `sort_order`, and JSON `filters` using the shared QuickFilterState. Conditions use UUID values for company, facility, brand, variant and product_type. Status is all/positive/zero. Additional facility_type is all/warehouse/hub. Date filters apply to updated_at in Manila time. Default sorting is updated_at descending, then id; movement sorting defaults to created_at descending, then id. See Swagger for allowed sort fields and response schemas.

## Stock posting

PO receipt posting adds each saved line's `base_qty` to warehouse inventory with one `po_receive_in` movement. Draft receipts have no effect. Receipt and PO row locks protect status/quantity checks against concurrent posting, editing and deletion. Receipt status, PO totals, stock and movements commit in one transaction. Repeated posting returns a conflict without changing stock.

Material request dispatch deducts each line's base quantity and records `dispatch_out`. Insufficient or missing warehouse stock rejects the entire dispatch with 409, including document creation, prior line deductions, progress, numbering and movements. Material request receipt adds base quantities to hub inventory with `receive_in`. Stock operations live in the inventory repository and use the caller's posting transaction.

Historical records are intentionally unchanged. Earlier PO receipts were posted without inventory movements, and earlier dispatches could skip deductions. These balances still require reconciliation against verified stock counts; do not replay old receipts alone. Strict stock checks apply to new dispatches. Opening balances and adjustments require their own source documents before implementation.

## Brand accordion and movement history

The expanded variant and history tables include a freezable Unit of Measure column showing the full unit name and symbol, such as `Litre (L)`. The brand overview omits this column. Mobile summaries, history summaries, details and Excel exports use the same name/symbol presentation where units are shown. Different base-unit IDs remain separate in brand totals; labels do not change quantity calculations.

Both desktop screens reuse `common/table/table-view` and its `TableMenu`; search/date/quick filters reuse `common/filter/search-filter-bar`. Brand columns support server sorting by brand, SKU count, stock and movement. Stock/movement sorts group matching base-unit sets and compare their decimal quantities separately. Expanded variants use the shared client sort over the brand's complete filtered variant rows. History supports server sorting by date, quantity magnitude, direction and balance after, with unavailable balances last. Changing a server sort resets pagination; exports retain the history sort. Data columns expose freezing through the shared menu. Brand aggregate sorting is performed in memory over matching balances; move to database aggregation if these volumes outgrow memory.

`/inventory` renders the inventory list and shared table with multiple expanded brand rows. The API `GET /api/inventory/brands` sorts complete filtered brand aggregates before pagination, so a table-menu sort applies to the full result set. Every expanded row identifies one product and facility. SKUs count unique product IDs across the selected facilities. Raw product IDs remain internal for navigation and SKU counts; they are omitted from screen labels and exports. The search prompt uses brand and variant names. Totals remain separate for each base-unit ID. Date filters select movement transactions; they never remove current stock merely because its balance was last updated outside the date range.

`/inventory/[inventoryId]/history` uses `GET /api/inventory/history?inventory_id=UUID`. It shows Stock In, Stock Out, Net Movement, Current Stock, beginning/ending balances, references, transaction types, signed quantities, balances after, actors and remarks. A details dialog shows the complete movement audit fields. Authorized source pages are linked through a reference search; those pages retain their own access checks. Search, direction and transaction-type filters apply to table rows and export; period totals include all transaction types in the selected dates so inflow/outflow remain comparable. Both pages use shared search/filter/pagination components, Redux request IDs and abort handling.

Migration `20261026010000_stock_movement_balances` adds nullable balance snapshots and an insertion sequence to the existing immutable ledger. New postings record exact before/after quantities under the inventory lock. The sequence breaks equal-time ties without depending on random UUID order. Existing records and quantities are preserved; historical balances without snapshots display Unavailable. A period boundary without an earlier known snapshot also remains unavailable. No past balance is inferred solely from current stock. Adjustment and general-transfer document types are not implemented; the history shows supported posted receipt and material request transactions, including their remarks. Material request transfers have a warehouse outflow and hub inflow at their respective facilities.

`GET /api/inventory/export?inventory_id=UUID` exports every matching movement, not just the visible page, as an Excel-compatible XML spreadsheet (`stock-movements.xml`). All cells are text to preserve precision and prevent spreadsheet formulas from user-provided notes. It uses the history filters and access rules. Export is built in memory; stream it if record volumes exceed available memory.

Run `npm run test:inventory` and `npm run test:material-requests`. Inventory backend tests replay migrations in an isolated localhost schema and exercise posting, concurrency, rollback, brand pagination, unit separation, period calculations, history, exports and access. UI tests cover rendered tables, quantities, history navigation and Redux stale reads. Temporary schemas are removed afterward; database tests skip non-local connections. No direct stock editing API is included.
