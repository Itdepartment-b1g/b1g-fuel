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

This change prepares the models only. PO receipt posting does not yet update inventory. Material request dispatch still permits insufficient stock without a deduction; see [material requests](MATERIAL_REQUESTS.md). Reconcile historical stock before enabling strict stock checks. Opening balances and adjustments require their own source documents before implementation.
