import type { QuickFilterState } from "@/types/quick-filter";
import { PURCHASE_ORDER_FILTER_OPTIONS } from "@/utils/management-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { build_filter_options } from "@/server/lib/quick-filters";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import {
  PAYMENT_METHODS,
  type CreatePurchaseOrderInput,
  type PaymentMethod,
  type UpdatePurchaseOrderInput,
} from "@/server/schema/purchase_order_schema";
import * as repository from "@/server/repositories/purchase_order_repository";

export class PurchaseOrderError extends Error {
  constructor(
    public code: "invalid_input" | "not_found" | "forbidden" | "conflict",
    message: string,
  ) {
    super(message);
  }
}

function can_create(access: RecordAccess, companyId: string) {
  return (
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "purchaseOrders.add" &&
        ((grant.scope === "all" && !grant.companyId) ||
          (grant.companyId
            ? grant.companyId === companyId
            : access.companyIds.includes(companyId))),
    )
  );
}

export function purchase_order_company(access: RecordAccess, requested?: string) {
  if (access.superAdmin) {
    if (!requested) throw new PurchaseOrderError("invalid_input", "Select a company.");
    return requested;
  }
  const unrestricted = access.grants.some(
    (grant) =>
      grant.permission === "purchaseOrders.add" &&
      grant.scope === "all" &&
      !grant.companyId,
  );
  const granted = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "purchaseOrders.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const choices = unrestricted ? access.companyIds : granted;
  if (choices.length === 1) {
    if (!can_create(access, choices[0]))
      throw new PurchaseOrderError(
        "forbidden",
        "You cannot create purchase orders in this company.",
      );
    return choices[0];
  }
  if (!requested) throw new PurchaseOrderError("invalid_input", "Select a company.");
  if (!can_create(access, requested))
    throw new PurchaseOrderError(
      "forbidden",
      "You cannot create purchase orders in this company.",
    );
  return requested;
}

function clean_text(value: string | undefined, max: number, label: string) {
  const text = value?.trim() ?? "";
  if (text.length > max)
    throw new PurchaseOrderError(
      "invalid_input",
      `${label} must be at most ${max} characters.`,
    );
  return text;
}

function payment_method(value: string | null | undefined) {
  if (value === undefined || value === null || value === "") return null;
  if (!(PAYMENT_METHODS as readonly string[]).includes(value))
    throw new PurchaseOrderError("invalid_input", "Select a valid payment method.");
  return value as PaymentMethod;
}

function delivery_date(value: string | null | undefined) {
  if (value === undefined || value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new PurchaseOrderError("invalid_input", "Enter a valid delivery date.");
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime()))
    throw new PurchaseOrderError("invalid_input", "Enter a valid delivery date.");
  return date;
}

function lines(input: CreatePurchaseOrderInput["lines"]) {
  if (!Array.isArray(input) || !input.length)
    throw new PurchaseOrderError("invalid_input", "Add at least one line.");
  if (input.length > 50)
    throw new PurchaseOrderError("invalid_input", "A purchase order can have at most 50 lines.");
  const seen = new Set<string>();
  return input.map((line) => {
    const key = `${line.variant_id}:${line.product_type_id}`;
    if (!line.variant_id || !line.product_type_id || !line.base_unit_id)
      throw new PurchaseOrderError(
        "invalid_input",
        "Each line needs a variant, product type, and base unit.",
      );
    if (seen.has(key))
      throw new PurchaseOrderError(
        "invalid_input",
        "Each variant and product type can appear once on an order.",
      );
    seen.add(key);
    const ordered_qty = String(line.ordered_qty ?? "").trim();
    if (!/^\d{1,9}(\.\d{1,3})?$/.test(ordered_qty) || Number(ordered_qty) <= 0)
      throw new PurchaseOrderError(
        "invalid_input",
        "Enter an ordered quantity greater than 0, with at most 3 decimal places.",
      );
    return { ...line, ordered_qty };
  });
}

function header(input: CreatePurchaseOrderInput, access: RecordAccess) {
  return {
    company_id: purchase_order_company(access, input.company_id),
    supplier_id: input.supplier_id,
    payment_terms: clean_text(input.payment_terms, 160, "Payment terms"),
    payment_method: payment_method(input.payment_method),
    estimated_delivery_at: delivery_date(input.estimated_delivery_on),
    notes: clean_text(input.notes, 1000, "Notes"),
    lines: lines(input.lines),
  };
}

export function list_purchase_orders(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  filters?: QuickFilterState,
) {
  return repository.list_purchase_orders(pagination, search, sorting, access, filters);
}

export async function list_by_id_purchase_order(id: string, access: RecordAccess) {
  const row = await repository.list_by_id_purchase_order(id, access);
  if (!row) throw new PurchaseOrderError("not_found", "Purchase order not found.");
  return row;
}

function saved(result: Awaited<ReturnType<typeof repository.create_purchase_order>>) {
  if (result === "invalid_location")
    throw new PurchaseOrderError(
      "invalid_input",
      "This company has no active warehouse.",
    );
  if (result === "many_warehouses")
    throw new PurchaseOrderError(
      "invalid_input",
      "This company has more than one warehouse.",
    );
  if (result === "invalid_supplier")
    throw new PurchaseOrderError("invalid_input", "Select a supplier for this company.");
  if (result === "invalid_line")
    throw new PurchaseOrderError(
      "invalid_input",
      "Each line needs a variant, product type, and base unit available to this company.",
    );
  if (result === "unit_conflict")
    throw new PurchaseOrderError(
      "conflict",
      "That variant and product type already use a different base unit.",
    );
  return result;
}

export async function create_purchase_order(
  input: CreatePurchaseOrderInput,
  access: RecordAccess,
) {
  return saved(await repository.create_purchase_order(header(input, access), access.userId));
}

export async function update_purchase_order(
  input: UpdatePurchaseOrderInput,
  access: RecordAccess,
) {
  const result = await repository.update_purchase_order(
    { id: input.id, ...header(input, access) },
    access,
  );
  if (result === "not_found")
    throw new PurchaseOrderError("not_found", "Purchase order not found.");
  if (result === "not_draft")
    throw new PurchaseOrderError("conflict", "Only a draft purchase order can be edited.");
  return saved(result);
}

export async function confirm_purchase_order(id: string, access: RecordAccess) {
  const result = await repository.confirm_purchase_order(id, access);
  if (result === "not_found")
    throw new PurchaseOrderError("not_found", "Purchase order not found.");
  if (result === "not_draft")
    throw new PurchaseOrderError("conflict", "Only a draft purchase order can be confirmed.");
  if (result === "terms")
    throw new PurchaseOrderError(
      "invalid_input",
      "Enter payment terms before confirming the purchase order.",
    );
  if (result === "lines")
    throw new PurchaseOrderError("invalid_input", "Add at least one line.");
  return result;
}

export async function close_purchase_order(id: string, access: RecordAccess) {
  const result = await repository.close_purchase_order(id, access);
  if (result === "not_found")
    throw new PurchaseOrderError("not_found", "Purchase order not found.");
  if (result === "not_open")
    throw new PurchaseOrderError("conflict", "Only an open purchase order can be closed.");
  return result;
}

export async function delete_purchase_order(id: string, access: RecordAccess) {
  const result = await repository.delete_purchase_order(id, access);
  if (result === "not_found")
    throw new PurchaseOrderError("not_found", "Purchase order not found.");
  if (result === "not_draft")
    throw new PurchaseOrderError("conflict", "Only a draft purchase order can be deleted.");
}

export async function get_purchase_order_filter_options(access: RecordAccess) {
  const records = await repository.get_purchase_order_filter_data(access);
  return build_filter_options(
    records,
    PURCHASE_ORDER_FILTER_OPTIONS,
    (row, field) =>
      field === "company"
        ? { value: row.company.id, label: row.company.name }
        : field === "supplier"
          ? { value: row.supplier.id, label: row.supplier.name }
          : { value: row.location.id, label: row.location.name },
    (row, status) => status === "all" || row.status === status,
  );
}

export async function get_purchase_order_options(access: RecordAccess) {
  const all =
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "purchaseOrders.view" &&
        grant.scope === "all" &&
        !grant.companyId,
    );
  const ids = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "purchaseOrders.view")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const companyWhere = all ? {} : { id: { in: ids } };
  const ownedOrShared = all
    ? {}
    : { OR: [{ company_id: null }, { company_id: { in: ids } }] };
  const client = getDatabase();
  const [companies, suppliers, locations, variants, product_types, units] =
    await Promise.all([
      client.company.findMany({
        where: companyWhere,
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      client.supplier.findMany({
        where: ownedOrShared,
        select: { id: true, name: true, company_id: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      client.location.findMany({
        where: {
          type: "warehouse",
          is_active: true,
          ...(all ? {} : { company_id: { in: ids } }),
        },
        select: { id: true, name: true, address: true, company_id: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      client.variant.findMany({
        where: ownedOrShared,
        select: {
          id: true,
          name: true,
          company_id: true,
          brand: { select: { id: true, name: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      client.product_type.findMany({
        where: ownedOrShared,
        select: { id: true, name: true, key: true, company_id: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      client.measurement_unit.findMany({
        where: all
          ? {}
          : { measurement: { OR: [{ company_id: null }, { company_id: { in: ids } }] } },
        select: { id: true, name: true, symbol: true, key: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    ]);
  return { companies, suppliers, locations, variants, product_types, units };
}
