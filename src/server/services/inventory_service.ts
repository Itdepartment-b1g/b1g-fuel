import type { RecordAccess } from "@/server/auth/record-access";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type { QuickFilterState } from "@/types/quick-filter";
import { build_filter_options } from "@/server/lib/quick-filters";
import { INVENTORY_FILTER_OPTIONS } from "@/utils/inventory-filters";
import * as repository from "@/server/repositories/inventory_repository";
import { inventory_spreadsheet } from "@/server/utils/inventory-export";

export class InventoryError extends Error {
  constructor(public code: "invalid_input" | "not_found", message: string) { super(message); }
}

export function list_inventory(pagination: Pagination, search: string, sorting: Sorting | undefined, filters: QuickFilterState | undefined, access: RecordAccess) {
  return repository.list_inventory(pagination, search, sorting, filters, access);
}

export async function list_by_id_inventory(id: string, access: RecordAccess) {
  const row = await repository.list_by_id_inventory(id, access);
  if (!row) throw new InventoryError("not_found", "Inventory balance not found.");
  return row;
}

export async function list_stock_movement(inventoryId: string, pagination: Pagination, sorting: Sorting | undefined, access: RecordAccess) {
  const result = await repository.list_stock_movement(inventoryId, pagination, sorting, access);
  if (!result) throw new InventoryError("not_found", "Inventory balance not found.");
  return result;
}

export async function get_inventory_filter_option(access: RecordAccess) {
  const rows = await repository.get_inventory_filter_data(access);
  return build_filter_options(rows, INVENTORY_FILTER_OPTIONS, (row, field) => {
    const value = field === "company" ? row.facility.company
      : field === "facility" ? row.facility
        : field === "brand" ? row.product.variant.brand
          : field === "variant" ? row.product.variant : row.product.product_type;
    return { value: value.id, label: value.name };
  }, (row, status) => status === "all" || (status === "zero" ? row.qty.isZero() : row.qty.greaterThan(0)),
  (row, _key, value) => value === "all" || row.facility.type === value);
}

export function list_inventory_brand(pagination: Pagination, search: string, filters: QuickFilterState | undefined, access: RecordAccess, sorting?: Sorting) {
  return repository.list_inventory_brand(pagination, search, filters, access, sorting);
}

export async function get_inventory_history(id: string, pagination: Pagination | undefined, search: string, filters: QuickFilterState | undefined, access: RecordAccess, sorting?: Sorting) {
  const history = await repository.get_inventory_history(id, pagination, search, filters, access, sorting);
  if (!history) throw new InventoryError("not_found", "Inventory balance not found.");
  return history;
}

export async function export_inventory_history(id: string, search: string, filters: QuickFilterState | undefined, access: RecordAccess, sorting?: Sorting) {
  // shortcut: export rows are held in memory; stream them when export volumes outgrow available memory.
  const history = await get_inventory_history(id, undefined, search, filters, access, sorting);
  const product = history.inventory.product;
  return inventory_spreadsheet(["Brand", "Variant", "Product type", "Facility", "Unit", "Date & Time (UTC)", "Reference", "Movement", "Transaction type", "Quantity", "Balance Before", "Balance After", "Processed By", "Remarks"], history.movements.map((row) => [
    product.brand.name, product.variant.name, product.product_type.name, history.inventory.facility.name, `${product.base_unit.name} (${product.base_unit.symbol})`,
    row.created_at, row.reference_no, row.direction === "in" ? "Stock In" : "Stock Out", row.type,
    `${row.direction === "in" ? "+" : "-"}${row.qty}`, row.balance_before, row.balance_after, row.created_by_name ?? "Unknown user", row.remarks,
  ]));
}
