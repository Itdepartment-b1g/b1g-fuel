# Project features

Product basis for B1G Fuel, aligned with the **B1G Fuel System** feature list (Super Admin, core roles, and system modules). Implementation detail for warehouse purchasing, receiving, locations, and turnover lives in [Warehouse inventory](WAREHOUSE_INVENTORY.md).

PayMongo for client checkout is **TBD**; until a gateway is final, use manual payment recording and proof where the design needs it (see warehouse supplier payments and client payment sections below).

## Status legend

| Status | Meaning |
| --- | --- |
| Done | Implemented in the app |
| Next | Agreed next build slice |
| Planned | Designed or listed; build after foundations |
| Later | Needed for full product; after core stock / orders work |
| TBD | Direction only; final design not locked |

## Naming note

| Term in this product | Meaning |
| --- | --- |
| Supplier purchase order | Warehouse buys from a supplier → then goods receive into warehouse stock |
| Client purchase order / order | Client (or agent/sales) buys from B1G → PayMongo / payment flow later |
| Location | Warehouse or hub site under a company |
| Role | RBAC permissions; not a physical site |

---

## Super Admin (IT only)

| Feature | Status | Notes |
| --- | --- | --- |
| Create and manage companies | Done | Companies module |
| Create and manage warehouses | Next | Locations module, `type = warehouse`; see inventory doc |
| Assign company to users | Done | User ↔ company membership |
| Create and manage users | Done | Users module |
| Manage company users | Done | Memberships and company roles |
| Create and manage roles | Done | Roles module |
| Manage permissions | Done | Role pages and permission keys |
| Assign roles to users | Done | Global and company role assignment |
| Manage dashboard and module access | Done | Page catalog + sidebar grants |
| View system-wide activities and audit logs | Later | Audit module not built yet |

---

## Platform already in place

| Feature | Status | Notes |
| --- | --- | --- |
| Login (password + Google) | Done | Supabase Auth; provisioned profiles only |
| Session cookies and `/api` proxy | Done | Next.js + Express |
| Measurements and units | Done | Names/symbols; conversion factor not on unit |
| Brands and variants | Done | Shared or company-owned |
| Suppliers | Done | Shared or company-owned; created-by on list |

---

## Core feature roles (capability map)

Capabilities below are the product target. They are granted through roles/permissions when those modules exist. Status is for the **capability**, not a separate role row in the database yet.

### Sales Manager

| Capability | Status |
| --- | --- |
| Create and manage hubs | Later (locations `type = hub`) |
| Create and manage agents | Later (CRM / user assignment) |
| Assign agents to hubs | Later |
| Manage multiple assigned hubs | Later |
| Manage hub inventory | Later |
| Create and manage client accounts | Later (CRM) |
| Create orders when applicable | Later |
| Create orders on behalf of clients | Later |
| Create walk-in orders | Later |
| Review and process client orders | Later |
| Monitor agent activities | Later |
| Monitor orders and sales | Later |
| Request stocks from warehouse | Later |
| Request stocks from other hubs | Later |
| Approve stock requests | Later |
| Monitor client return requests | Later |
| View stock movement history | Planned (after warehouse movements exist) |
| View sales and inventory reports | Later |
| View client payment status / details / transaction reference | Later |
| Monitor paid, unpaid, failed, pending payments | Later |
| Verify payment status | Later |
| View payment transaction history | Later |
| Process orders after successful payment | Later |
| View payment reports | Later |
| View beginning and ending balance per hub | Later (inventory balance tracking) |

### Agent

| Capability | Status |
| --- | --- |
| Create and manage client accounts | Later |
| Create orders on behalf of clients / walk-in orders | Later |
| Review and process client orders | Later |
| Request stocks from warehouse | Later |
| Request stocks from other hubs (stock transfer) | Later |
| Manage assigned hub inventory | Later |
| Approve or reject client return requests | Later |
| Create / process returns on behalf of clients | Later |
| View client order history | Later |
| View stock movement history | Planned (shared ledger once stock exists) |
| View personal activities | Later |
| View payment status / reference for assigned client orders | Later |
| Monitor paid and unpaid orders | Later |
| Assist clients with failed or pending payments | Later |
| View payment history for client orders | Later |
| Daily report for end-of-day transactions | Later |

### Client

| Capability | Status |
| --- | --- |
| Create purchase orders (client orders) | Later |
| View order status and history | Later |
| Request returns using a PO number | Later |
| Select items, quantity, purpose, reason for return | Later |
| Track return request status | Later |
| Submit reports and concerns | Later |
| View transaction history | Later |
| Select payment method upon checkout | Later / TBD gateway |
| Pay for orders through PayMongo | TBD |
| Select available bank payment option | TBD |
| Redirect to PayMongo/bank for authorization | TBD |
| View payment status, history, reference number | Later / TBD |
| Retry failed or incomplete payments | TBD |
| Receive payment confirmation | TBD |
| View/download payment receipt | TBD |

---

## System features

### Inventory management

| Feature | Status | Notes |
| --- | --- | --- |
| Manage products and stock | Next → Planned | Products next; stock after receive |
| Track warehouse inventory | Planned | After locations + posted receipts |
| Track hub inventory | Later | After hub locations |
| Track available and reserved stocks | Later | Needs orders / reservations |
| Receive stocks | Planned | Goods receipt against supplier PO |
| Request and transfer stocks | Later | Hub ↔ warehouse / hub ↔ hub |
| Process stock adjustments | Planned | After receive path; corrections |
| Track stock movements | Planned | Ledger on every stock change |
| Track damaged / returned / disposed stocks | Later | Return and dispose flows |

Design for warehouse receive and balances: [Warehouse inventory](WAREHOUSE_INVENTORY.md).

### Inventory balance tracking

| Feature | Status |
| --- | --- |
| Beginning / ending inventory balance | Later |
| Carry forward previous ending as next beginning | Later |
| Beginning / ending per product, warehouse, hub | Later |
| Stock-in / stock-out / adjustments in period | Later |
| Auto-calculate ending balance | Later |
| Balance history | Later |
| Filter by date range, month, year, product, warehouse, hub | Later |
| View beginning, in, out, adjustments, ending for period | Later |
| Export filtered reports to CSV, Excel, PDF | Later |

Depends on stock movements and period reporting after the core ledger exists.

### Stock management

| Feature | Status |
| --- | --- |
| Request stocks from warehouse | Later |
| Request stocks from other hubs (transfer) | Later |
| Approve stock requests | Later |
| Transfer stocks between hubs | Later |
| Receive transferred stocks | Later |
| Track stock-in and stock-out | Planned (warehouse in first) |
| Track inventory adjustments | Planned |
| View complete stock movement history | Planned |

### Order management (client / sales)

| Feature | Status |
| --- | --- |
| Create client purchase orders | Later |
| Create orders on behalf of clients | Later |
| Create walk-in orders | Later |
| Review and approve orders | Later |
| Track order status / process completed / cancel | Later |
| View order history | Later |

### Create order (client order wizard)

| Feature | Status |
| --- | --- |
| Order type: Direct / Booking | Later |
| Purchase type: Refill / New | Later (aligns with separate products) |
| Order item: Butane / Crate / Butane + Crate | Later |
| Fixed quantity per set; number of sets | Later |
| Auto total qty, price by Refill/New, order amount | Later |
| Review, confirm, submit | Later |

### Return management

| Feature | Status |
| --- | --- |
| Return requests by client PO number | Later |
| Create returns on behalf of clients | Later |
| Approve / reject; track status | Later |
| Purpose: Restock / Dispose | Later |
| Reason and item condition | Later |
| Return only items on the order | Later |
| Process approved returns; update inventory | Later |
| Track return history | Later |

### CRM

| Feature | Status |
| --- | --- |
| Manage client accounts | Later |
| Assign clients to agents | Later |
| View client info, order history, transaction history | Later |
| Manage client reports and concerns | Later |
| Track client activities | Later |

### Dashboard and reports

| Feature | Status |
| --- | --- |
| Role-based dashboards | Later (shell Done; widgets Later) |
| Sales / inventory / order / hub / agent dashboards | Later |
| Sales, inventory, order, stock movement, agent, client, return reports | Later |
| Export reports to CSV, Excel, PDF | Later |

### Notifications

| Feature | Status |
| --- | --- |
| Order, stock request, transfer, return notifications | Later |
| Approval / rejection notifications | Later |
| Low-stock notifications | Later |
| System notifications | Later |

### Audit and activity logs

| Feature | Status |
| --- | --- |
| Track user activities | Later |
| Track inventory changes (inflow, outflow, return) | Later (ledger first, audit UI later) |
| Track stock transfers, order changes, returns | Later |
| Track approvals / rejections | Later |
| Track role and permission changes | Later |
| Record user, date, time, and action | Later |

---

## Near-term build order (warehouse purchasing path)

Agreed first vertical before hubs, client orders, and PayMongo:

| # | Feature | Status | Doc |
| --- | --- | --- | --- |
| 1 | Locations (warehouse) | Next | [Warehouse inventory](WAREHOUSE_INVENTORY.md) |
| 2 | User ↔ location assignment (turnover) | Planned | same |
| 3 | Products (variant + base unit; NEW vs REFILL) | Next | same |
| 4 | Location conversions | Planned | same |
| 5 | Supplier purchase orders (terms, preferred method, ETA) | Planned | same |
| 6 | Receiving against supplier PO (draft → post) | Planned | same |
| 7 | Stock balance + movements | Planned | same |
| 8 | Supplier payments + proof (manual; PayMongo TBD) | Planned | same |

Then: hubs, stock requests/transfers, CRM, client orders, returns, balance-period reports, notifications, audit UI, PayMongo checkout.

## Related docs

- [Warehouse inventory](WAREHOUSE_INVENTORY.md) — locations, turnover, supplier PO, receiving, stock, supplier payments
- [Users, roles, and companies](DATA_MODEL.md) — RBAC assignment model
- [Backend structure](BACKEND_STRUCTURE.md) — simple catalog controllers for new modules
- [Architecture](ARCHITECTURE.md) — layers and CRUD playbook
