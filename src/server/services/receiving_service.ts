import type { QuickFilterState } from "@/types/quick-filter";
import { RECEIVING_FILTER_OPTIONS } from "@/utils/management-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type { CreateReceivingInput, UpdateReceivingInput } from "@/server/schema/receiving_schema";
import * as repository from "@/server/repositories/receiving_repository";

export class ReceivingError extends Error {
  constructor(
    public code: "invalid_input" | "not_found" | "forbidden" | "conflict",
    message: string,
  ) {
    super(message);
  }
}

function clean_text(value: string | undefined, max: number, label: string) {
  const text = value?.trim() ?? "";
  if (text.length > max) throw new ReceivingError("invalid_input", `${label} must be at most ${max} characters.`);
  return text;
}

function lines(input: CreateReceivingInput["lines"]) {
  if (!Array.isArray(input) || !input.length)
    throw new ReceivingError("invalid_input", "Add at least one line.");
  if (input.length > 50)
    throw new ReceivingError("invalid_input", "A receipt can have at most 50 lines.");
  const seen = new Set<string>();
  return input.map((line) => {
    if (!line.purchase_order_item_id)
      throw new ReceivingError("invalid_input", "Each line needs a purchase order line.");
    if (seen.has(line.purchase_order_item_id))
      throw new ReceivingError("invalid_input", "Each purchase order line can appear once on a receipt.");
    seen.add(line.purchase_order_item_id);
    const qty = String(line.qty ?? "").trim();
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(qty) || Number(qty) <= 0)
      throw new ReceivingError("invalid_input", "Enter a received quantity greater than 0, with at most 3 decimal places.");
    return { purchase_order_item_id: line.purchase_order_item_id, qty };
  });
}

function saved(result: Awaited<ReturnType<typeof repository.create_receiving>>) {
  if (result === "not_receivable")
    throw new ReceivingError("invalid_input", "Only an order that is waiting for stock can be received.");
  if (result === "draft_exists")
    throw new ReceivingError("conflict", "This purchase order already has a draft receipt.");
  if (result === "invalid_line")
    throw new ReceivingError("invalid_input", "Each line must belong to the purchase order.");
  if (result === "duplicate_line")
    throw new ReceivingError("invalid_input", "Each purchase order line can appear once on a receipt.");
  if (result === "over_receipt")
    throw new ReceivingError("invalid_input", "Received quantity cannot be more than the quantity still outstanding.");
  return result;
}

export function list_receivings(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  filters?: QuickFilterState,
) {
  return repository.list_receivings(pagination, search, sorting, access, filters);
}

export async function list_by_id_receiving(id: string, access: RecordAccess) {
  const row = await repository.list_by_id_receiving(id, access);
  if (!row) throw new ReceivingError("not_found", "Receipt not found.");
  return row;
}

export async function create_receiving(input: CreateReceivingInput, access: RecordAccess) {
  return saved(
    await repository.create_receiving(
      { purchase_order_id: input.purchase_order_id, notes: clean_text(input.notes, 1000, "Notes"), lines: lines(input.lines) },
      access,
    ),
  );
}

export async function update_receiving(input: UpdateReceivingInput, access: RecordAccess) {
  const result = await repository.update_receiving(
    {
      id: input.id,
      purchase_order_id: input.purchase_order_id,
      notes: clean_text(input.notes, 1000, "Notes"),
      lines: lines(input.lines),
    },
    access,
  );
  if (result === "not_found") throw new ReceivingError("not_found", "Receipt not found.");
  if (result === "not_draft") throw new ReceivingError("conflict", "Only a draft receipt can be edited.");
  return saved(result);
}

export async function post_receiving(id: string, access: RecordAccess) {
  const result = await repository.post_receiving(id, access);
  if (result === "not_found") throw new ReceivingError("not_found", "Receipt not found.");
  if (result === "not_draft") throw new ReceivingError("conflict", "Only a draft receipt can be posted.");
  if (result === "not_receivable")
    throw new ReceivingError("conflict", "Only an order that is waiting for stock can be received.");
  if (result === "invalid_line")
    throw new ReceivingError("invalid_input", "Each line must belong to the purchase order.");
  if (result === "over_receipt")
    throw new ReceivingError("invalid_input", "Received quantity cannot be more than the quantity still outstanding.");
  return result;
}

export async function delete_receiving(id: string, access: RecordAccess) {
  const result = await repository.delete_receiving(id, access);
  if (result === "not_found") throw new ReceivingError("not_found", "Receipt not found.");
  if (result === "not_draft") throw new ReceivingError("conflict", "Only a draft receipt can be deleted.");
}

export async function get_receiving_filter_options(access: RecordAccess) {
  const records = await repository.get_receiving_filter_data(access);
  return build_filter_options(
    records,
    RECEIVING_FILTER_OPTIONS,
    (row, field) =>
      field === "company"
        ? { value: row.company.id, label: row.company.name }
        : field === "supplier"
          ? { value: row.purchase_order.supplier.id, label: row.purchase_order.supplier.name }
          : { value: row.location.id, label: row.location.name },
    (row, status) => status === "all" || row.status === status,
  );
}

export function get_receivable_orders(access: RecordAccess) {
  return repository.list_receivable_orders(access);
}
