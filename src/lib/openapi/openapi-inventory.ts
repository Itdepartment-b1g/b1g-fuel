import { INVENTORY_SORT_FIELDS, STOCK_MOVEMENT_SORT_FIELDS, INVENTORY_BRAND_SORT_FIELDS, INVENTORY_HISTORY_SORT_FIELDS } from "@/server/schema/inventory_schema";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/utils/pagination";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const uuid = { type: "string", format: "uuid" };
const named = { type: "object", required: ["id", "name"], properties: { id: uuid, name: { type: "string" } } };
const qty = { type: "string", description: "Decimal quantity in the product's base unit", example: "12.5" };
const query = (name: string, schema: object, required = false) => ({ in: "query", name, required, schema });
const pagination = [query("page", { type: "integer", minimum: 1, default: 1 }), query("page_size", { type: "integer", enum: PAGE_SIZE_OPTIONS, default: DEFAULT_PAGE_SIZE })];
const page = { total: { type: "integer" }, page: { type: "integer" }, page_size: { type: "integer" } };
const errors = Object.fromEntries(["400", "401", "403", "404", "500"].map((code) => [code, { description: "Request failed", ...json(ref("Error")) }]));
const base = { tags: ["Inventory"], security: [{ session: [] }] };

export const inventorySchemas = {
  Inventory: {
    type: "object", required: ["id", "company", "facility", "product", "qty", "updated_at"], properties: {
      id: uuid, company: named,
      facility: { type: "object", required: ["id", "name", "type", "is_active"], properties: { ...named.properties, type: { type: "string", enum: ["warehouse", "hub"] }, is_active: { type: "boolean" } } },
      product: { type: "object", required: ["id", "brand", "variant", "product_type", "base_unit"], properties: {
        id: uuid, brand: named, variant: named, product_type: named,
        base_unit: { type: "object", required: ["id", "name", "symbol"], properties: { ...named.properties, symbol: { type: "string" } } },
      } },
      qty, updated_at: { type: "string", format: "date-time" },
    },
  },
  StockMovement: {
    type: "object", required: ["id", "qty", "direction", "type", "source_line_id", "created_by", "created_by_name", "created_at"], properties: {
      id: uuid, qty, direction: { type: "string", enum: ["in", "out"] }, type: { type: "string", enum: ["po_receive_in", "dispatch_out", "receive_in"] },
      source_line_id: { ...uuid, description: "Source document line reference only. Full source documents require their own permissions." },
      created_by: uuid, created_by_name: { type: "string", nullable: true }, created_at: { type: "string", format: "date-time" },
    },
  },
  InventoryBrand: {
    type: "object", required: ["id", "name", "sku_count", "totals", "variants"], properties: {
      ...named.properties, sku_count: { type: "integer" },
      totals: { type: "array", items: { type: "object", properties: { unit: { type: "string", description: "Unit name and symbol", example: "Litre (L)" }, qty, net_movement: qty } } },
      variants: { type: "array", items: { allOf: [ref("Inventory"), { type: "object", properties: { net_movement: qty } }] } },
    },
  },
  InventoryHistoryMovement: {
    allOf: [ref("StockMovement"), { type: "object", properties: {
      balance_before: { ...qty, nullable: true }, balance_after: { ...qty, nullable: true },
      reference_no: { type: "string" }, remarks: { type: "string" }, source_href: { type: "string", nullable: true },
    } }],
  },
  InventoryHistory: {
    type: "object", properties: { inventory: ref("Inventory"), movements: { type: "array", items: ref("InventoryHistoryMovement") }, ...page,
      summary: { type: "object", properties: { stock_in: qty, stock_out: qty, net_movement: qty, current_stock: qty, beginning_balance: { ...qty, nullable: true }, ending_balance: { ...qty, nullable: true } } },
    },
  },
};

export const inventoryPaths = {
  "/api/inventory/brands": { get: {
    ...base, summary: "Read inventory grouped by brand with complete variant rows",
    description: "Requires inventory.view. Aggregates and sorts the complete filtered brand result before pagination. SKU is the existing product UUID; unique SKUs are counted once per brand across facilities. Quantities are grouped by base-unit ID and never combined across units. Stock/movement sorting groups matching base-unit sets, then compares each unit quantity separately. QuickFilter date ranges apply to actual movement dates, not balance updated_at. Current available stock is independent of the selected movement dates. Default sorting is brand ascending, then id.",
    parameters: [query("search", { type: "string", maxLength: 160 }), query("filters", { type: "string", description: "Inventory QuickFilterState; date selects movement period. UUID conditions: company, facility, brand, variant, product_type." }), query("sort_by", { type: "string", enum: INVENTORY_BRAND_SORT_FIELDS }), query("sort_order", { type: "string", enum: ["asc", "desc"] }), ...pagination],
    responses: { "200": { description: "Brand summaries and variant balances", ...json({ type: "object", properties: { brands: { type: "array", items: ref("InventoryBrand") }, ...page } }) }, ...errors },
  } },
  "/api/inventory/history": { get: {
    ...base, summary: "Read a facility/product movement history and period summary",
    description: "Requires inventory.view for the balance. New movements include saved balance before/after; historical records without snapshots remain null. Reference numbers and source remarks are inventory audit metadata; source links still lead to independently authorized document pages. Period summary uses all transactions in the selected date range. Reference/type/direction filters apply only to table rows and export. Ordering is created_at descending then insertion sequence descending.",
    parameters: [query("inventory_id", uuid, true), query("search", { type: "string", maxLength: 160, description: "Literal reference-number search" }), query("filters", { type: "string", description: "QuickFilterState: no column conditions; status all/in/out; additional transaction_type all/po_receive_in/dispatch_out/receive_in; shared Manila date ranges." }), query("sort_by", { type: "string", enum: INVENTORY_HISTORY_SORT_FIELDS, description: "qty sorts quantity magnitude; unavailable balance snapshots stay last." }), query("sort_order", { type: "string", enum: ["asc", "desc"] }), ...pagination],
    responses: { "200": { description: "History and date-period totals", ...json(ref("InventoryHistory")) }, ...errors },
  } },
  "/api/inventory/export": { get: {
    ...base, summary: "Export all filtered movements as an Excel XML spreadsheet",
    description: "Requires inventory.view. Uses the same filters and authorization as history, without pagination. Text cells prevent formula execution and preserve decimal precision. Unavailable historical balances remain explicit. Downloads stock-movements.xml, which opens in Excel.",
    parameters: [query("inventory_id", uuid, true), query("search", { type: "string", maxLength: 160 }), query("filters", { type: "string", description: "Same QuickFilterState as history." }), query("sort_by", { type: "string", enum: INVENTORY_HISTORY_SORT_FIELDS }), query("sort_order", { type: "string", enum: ["asc", "desc"] })],
    responses: { "200": { description: "Excel XML download", content: { "application/vnd.ms-excel": { schema: { type: "string" } } } }, ...errors },
  } },
  "/api/inventory": { get: {
    ...base, summary: "List inventory balances or read one by ID",
    description: "Requires inventory.view. Company ownership follows the facility, not the product. Own scope uses current facility assignments within the grant company. Inactive facilities and existing zero balances remain visible. Search and filters run before pagination; default order is updated_at descending, then id. Inventory cannot be edited directly. Historical balances may require reconciliation.",
    parameters: [query("id", uuid), query("search", { type: "string", maxLength: 160 }), query("sort_by", { type: "string", enum: INVENTORY_SORT_FIELDS }), query("sort_order", { type: "string", enum: ["asc", "desc"] }),
      query("filters", { type: "string", description: "JSON QuickFilterState. UUID conditions: company, facility, brand, variant, product_type. Status: all/positive/zero. Additional facility_type: all/warehouse/hub. Date filters use balance updated_at." }), ...pagination],
    responses: { "200": { description: "Accessible balances or one balance", ...json({ oneOf: [
      { type: "object", required: ["inventories", "total", "page", "page_size"], properties: { inventories: { type: "array", items: ref("Inventory") }, ...page } },
      { type: "object", required: ["inventory"], properties: { inventory: ref("Inventory") } },
    ] }) }, ...errors },
  } },
  "/api/inventory/movements": { get: {
    ...base, summary: "Read movement history for an accessible inventory balance",
    description: "Requires inventory.view for the balance's facility. Returns immutable movements with actor and source line reference, without exposing full source documents. Default order is created_at descending, then id.",
    parameters: [query("inventory_id", uuid, true), query("sort_by", { type: "string", enum: STOCK_MOVEMENT_SORT_FIELDS }), query("sort_order", { type: "string", enum: ["asc", "desc"] }), ...pagination],
    responses: { "200": { description: "Movement history", ...json({ type: "object", required: ["movements", "total", "page", "page_size"], properties: { movements: { type: "array", items: ref("StockMovement") }, ...page } }) }, ...errors },
  } },
  "/api/inventory/filter-options": { get: {
    ...base, summary: "Get accessible inventory filter choices and counts",
    description: "Requires inventory.view. Uses the same facility access rules as balance and movement reads.",
    responses: { "200": { description: "Company/facility/product filters, stock statuses and facility types", ...json({ type: "object", required: ["fields", "statusOptions", "additionalFilters"], properties: { fields: { type: "array", items: { type: "object" } }, statusOptions: { type: "array", items: { type: "object" } }, additionalFilters: { type: "array", items: { type: "object" } } } }) }, ...errors },
  } },
};
