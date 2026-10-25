import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseExecutor } from "@/server/lib/database";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_filter } from "@/server/lib/filter";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { QuickFilterState } from "@/types/quick-filter";

const include = {
  requesting_company: { select: { id: true, name: true } },
  supplying_company: { select: { id: true, name: true } },
  requesting_hub: { select: { id: true, name: true } },
  supplying_warehouse: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" }, include: { product: { select: { variant: { select: { name: true, brand: { select: { name: true } } } }, product_type: { select: { name: true } } } } } },
  events: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
  dispatches: { orderBy: [{ posted_at: "asc" }, { id: "asc" }], include: { items: { orderBy: { id: "asc" } } } },
  receivings: { orderBy: [{ posted_at: "asc" }, { id: "asc" }], include: { items: { orderBy: { id: "asc" } } } },
} satisfies Prisma.material_requestInclude;
export type RequestRecord = Prisma.material_requestGetPayload<{ include: typeof include }>;

export async function serialize_request(row: RequestRecord, tx: DatabaseExecutor) {
  const users = await tx.user.findMany({ where: { id: { in: [...new Set([row.created_by, ...row.events.map((event) => event.created_by), ...row.dispatches.map((dispatch) => dispatch.created_by), ...row.receivings.map((receipt) => receipt.created_by)])] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  const movement = (lines: { material_request_item_id: string; qty: Prisma.Decimal }[]) => lines.map((line) => ({ material_request_item_id: line.material_request_item_id, qty: line.qty.toString() }));
  return { ...row, created_by_name: names.get(row.created_by) ?? null,
    created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString(),
    needed_at: row.needed_at?.toISOString() ?? null, submitted_at: row.submitted_at?.toISOString() ?? null,
    items: row.items.map(({ product, ...item }) => ({ ...item, brand_name: product.variant.brand.name, variant_name: product.variant.name, product_type_name: product.product_type.name, requested_qty: item.requested_qty.toString(), approved_qty: item.approved_qty?.toString() ?? null, dispatched_qty: item.dispatched_qty.toString(), received_qty: item.received_qty.toString() })),
    events: row.events.map((event) => ({ ...event, created_at: event.created_at.toISOString(), created_by_name: names.get(event.created_by) ?? null })),
    dispatches: row.dispatches.map((dispatch) => ({ id: dispatch.id, number: dispatch.dispatch_no, posted_at: dispatch.posted_at?.toISOString() ?? null, created_by_name: names.get(dispatch.created_by) ?? null, lines: movement(dispatch.items) })),
    receivings: row.receivings.map((receipt) => ({ id: receipt.id, number: receipt.receiving_no, posted_at: receipt.posted_at?.toISOString() ?? null, created_by_name: names.get(receipt.created_by) ?? null, lines: movement(receipt.items) })),
  };
}

export function get_request(id: string, tx: DatabaseExecutor) {
  return tx.material_request.findUnique({ where: { id }, include });
}
export async function list_material_request(visibility: Prisma.material_requestWhereInput, pagination: Pagination, tx: DatabaseExecutor, search = "", sorting?: Sorting, filters?: QuickFilterState) {
  const where = build_filter<Prisma.material_requestWhereInput>(filters, {
    where: visibility,
    fields: {
      request_no: (values) => ({ OR: values.map((value) => value === "draft" ? { request_no: null } : { request_no: { equals: value, mode: "insensitive" as const } }) }),
      hub: (values) => ({ requesting_hub_id: { in: values } }),
      supplier: (values) => ({ supplying_company_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: { draft: { status: "draft" }, submitted: { status: "submitted" }, approved: { status: "approved" }, partially_dispatched: { status: "partially_dispatched" }, fully_dispatched: { status: "fully_dispatched" }, partially_received: { status: "partially_received" }, received: { status: "received" }, closed: { status: "closed" }, rejected: { status: "rejected" }, cancelled: { status: "cancelled" } },
    search: { value: search, fields: [(value) => ({ request_no: value }), (value) => ({ requesting_hub: { name: value } }), (value) => ({ supplying_company: { name: value } })] },
  });
  const orderBy = build_sort<Prisma.material_requestOrderByWithRelationInput>(sorting, {
    fields: {
      request_no: (direction) => ({ request_no: { sort: direction, nulls: "last" } }),
      requesting_hub: (direction) => ({ requesting_hub: { name: direction } }),
      supplying_company: (direction) => ({ supplying_company: { name: direction } }),
      status: (direction) => ({ status: direction }),
      created_at: (direction) => ({ created_at: direction }),
    },
    default: { field: "created_at", direction: "desc" }, tieBreaker: { field: "id", order: { id: "asc" } },
  });
  const rows = await tx.material_request.findMany({ where, include, orderBy, skip: pagination.skip, take: pagination.take });
  const requests = [];
  for (const row of rows) requests.push(await serialize_request(row, tx));
  return { requests, ...paginationMetadata(await tx.material_request.count({ where }), pagination) };
}
export function get_material_request_filter_data(where: Prisma.material_requestWhereInput, tx: DatabaseExecutor) {
  return tx.material_request.findMany({ where, select: { request_no: true, status: true, requesting_hub: { select: { id: true, name: true } }, supplying_company: { select: { id: true, name: true } } } });
}
export function get_request_location(id: string, tx: DatabaseExecutor) {
  return tx.location.findUnique({ where: { id }, include: { company: { select: { name: true } } } });
}
export function get_request_assignment(locationId: string, userId: string, tx: DatabaseExecutor) {
  return tx.user_location.findFirst({ where: { location_id: locationId, membership: { user_id: userId } } });
}
export function get_request_relationship(requester: string, supplier: string, tx: DatabaseExecutor) {
  return tx.company_supply_relationship.findUnique({ where: { requesting_company_id_supplying_company_id: { requesting_company_id: requester, supplying_company_id: supplier } } });
}
export function lock_request_relationship(id: string, tx: DatabaseExecutor) {
  return tx.$queryRaw`SELECT id FROM company_supply_relationship WHERE id = ${id}::uuid FOR SHARE`;
}
export function get_request_assignments(userId: string, tx: DatabaseExecutor) {
  return tx.user_location.findMany({ where: { membership: { user_id: userId } }, select: { location_id: true } });
}
export function get_request_product(ids: string[], companyId: string, tx: DatabaseExecutor) {
  return tx.product.findMany({ where: { id: { in: ids }, company_id: companyId }, include: { variant: { include: { brand: true } }, product_type: true, base_unit: true } });
}
export function create_material_request(data: Prisma.material_requestUncheckedCreateInput, tx: DatabaseExecutor) {
  return tx.material_request.create({ data, include });
}
export function replace_request_items(id: string, tx: DatabaseExecutor) {
  return tx.material_request_item.deleteMany({ where: { material_request_id: id } });
}
export function update_material_request(id: string, data: Prisma.material_requestUncheckedUpdateInput, tx: DatabaseExecutor) {
  return tx.material_request.update({ where: { id }, data, include });
}
export function lock_material_request(id: string, tx: DatabaseExecutor) {
  return tx.$queryRaw`SELECT id FROM material_request WHERE id = ${id}::uuid FOR UPDATE`;
}
export function lock_request_company(id: string, tx: DatabaseExecutor) {
  return tx.$queryRaw`SELECT id FROM company WHERE id = ${id}::uuid FOR SHARE`;
}
export async function allocate_request_number(companyId: string, companyName: string, now: Date, tx: DatabaseExecutor) {
  const code = (companyName.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => [...word][0]).join("").toUpperCase().slice(0, 46) || "MR";
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(now);
  const period = `${parts.find((part) => part.type === "year")!.value}${parts.find((part) => part.type === "month")!.value}`;
  const counter = await tx.material_request_counter.upsert({ where: { company_id_period: { company_id: companyId, period } }, create: { company_id: companyId, period, last_value: 1 }, update: { last_value: { increment: 1 } } });
  if (counter.last_value > 9_999_999) throw new Error("Material request sequence exhausted.");
  return `MR-${code}-${period}-${String(counter.last_value).padStart(7, "0")}`;
}
export async function allocate_receipt_number(companyId: string, companyName: string, postedAt: Date, tx: DatabaseExecutor) {
  const code = (companyName.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => [...word][0]).join("").toUpperCase().slice(0, 44) || "MR";
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(postedAt);
  const period = `${parts.find((part) => part.type === "year")!.value}${parts.find((part) => part.type === "month")!.value}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mr-receipt:${companyId}`})::bigint)`;
  const latest = await tx.material_request_receiving.aggregate({ where: { requesting_company_id: companyId, receipt_seq: { not: null } }, _max: { receipt_seq: true } });
  const receipt_seq = (latest._max.receipt_seq ?? 0) + 1;
  if (receipt_seq > 9_999_999) throw new Error("Material request receipt sequence exhausted.");
  return { receipt_seq, receiving_no: `RRMR-${code}-${period}-${String(receipt_seq).padStart(7, "0")}` };
}
export function create_posted_request_receipt(data: Prisma.material_request_receivingUncheckedCreateInput, tx: DatabaseExecutor) {
  return tx.material_request_receiving.create({ data, select: { id: true, receiving_no: true, items: { select: { id: true, product_id: true, qty: true } } } });
}
export async function allocate_dispatch_number(companyId: string, companyName: string, postedAt: Date, tx: DatabaseExecutor) {
  const code = (companyName.match(/[\p{L}\p{N}]+/gu) ?? []).map((word) => [...word][0]).join("").toUpperCase().slice(0, 46) || "MR";
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).formatToParts(postedAt);
  const period = `${parts.find((part) => part.type === "year")!.value}${parts.find((part) => part.type === "month")!.value}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mr-dispatch:${companyId}`})::bigint)`;
  const latest = await tx.material_request_dispatch.aggregate({ where: { supplying_company_id: companyId }, _max: { dispatch_seq: true } });
  const dispatch_seq = (latest._max.dispatch_seq ?? 0) + 1;
  if (dispatch_seq > 9_999_999) throw new Error("Material request dispatch sequence exhausted.");
  return { dispatch_seq, dispatch_no: `MRD-${code}-${period}-${String(dispatch_seq).padStart(7, "0")}` };
}
export function create_posted_request_dispatch(data: Prisma.material_request_dispatchUncheckedCreateInput, tx: DatabaseExecutor) {
  return tx.material_request_dispatch.create({ data, select: { id: true, dispatch_no: true, items: { select: { id: true, product_id: true, qty: true } } } });
}
export function list_location_stock(locationId: string, productIds: string[], tx: DatabaseExecutor) {
  return tx.stock_balance.findMany({ where: { location_id: locationId, product_id: { in: productIds } }, select: { product_id: true, qty: true } });
}
export async function take_stock(locationId: string, productId: string, qty: Prisma.Decimal, dispatchItemId: string, userId: string, tx: DatabaseExecutor) {
  await tx.$queryRaw`SELECT id FROM stock_balance WHERE location_id = ${locationId}::uuid AND product_id = ${productId}::uuid FOR UPDATE`;
  const updated = await tx.stock_balance.updateMany({ where: { location_id: locationId, product_id: productId, qty: { gte: qty } }, data: { qty: { decrement: qty } } });
  if (updated.count !== 1) return false;
  await tx.stock_movement.create({ data: { location_id: locationId, product_id: productId, qty, direction: "out", type: "dispatch_out", material_request_dispatch_item_id: dispatchItemId, created_by: userId } });
  return true;
}
export async function give_stock(locationId: string, productId: string, qty: Prisma.Decimal, receivingItemId: string, userId: string, tx: DatabaseExecutor) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${locationId}:${productId}`})::bigint)`;
  await tx.stock_balance.upsert({ where: { location_id_product_id: { location_id: locationId, product_id: productId } }, create: { location_id: locationId, product_id: productId, qty }, update: { qty: { increment: qty } } });
  await tx.stock_movement.create({ data: { location_id: locationId, product_id: productId, qty, direction: "in", type: "receive_in", material_request_receiving_item_id: receivingItemId, created_by: userId } });
}
export async function list_request_receipts(visibility: Prisma.material_requestWhereInput, search: string, pagination: Pagination, sorting: Sorting | undefined, tx: DatabaseExecutor) {
  const where: Prisma.material_request_receivingWhereInput = {
    status: "posted",
    AND: [
      { request: visibility },
      ...(search ? [{ OR: [
        { receiving_no: { contains: search, mode: "insensitive" as const } },
        { request: { request_no: { contains: search, mode: "insensitive" as const } } },
        { request: { requesting_hub: { name: { contains: search, mode: "insensitive" as const } } } },
        { request: { supplying_company: { name: { contains: search, mode: "insensitive" as const } } } },
      ] }] : []),
    ],
  };
  const rows = await tx.material_request_receiving.findMany({
    where,
    include: {
      request: { select: { id: true, request_no: true, requesting_hub: { select: { name: true } }, requesting_company: { select: { name: true } }, supplying_company: { select: { name: true } } } },
      items: { orderBy: { id: "asc" }, select: { id: true, qty: true, request_item: { select: { product_label: true, unit_label: true, requested_qty: true, dispatched_qty: true, received_qty: true } } } },
    },
    orderBy: build_sort<Prisma.material_request_receivingOrderByWithRelationInput>(sorting, {
      fields: {
        receiving_no: (direction) => ({ receiving_no: { sort: direction, nulls: "last" } }),
        request_no: (direction) => ({ request: { request_no: { sort: direction, nulls: "last" } } }),
        requesting_hub: (direction) => ({ request: { requesting_hub: { name: direction } } }),
        supplying_company: (direction) => ({ request: { supplying_company: { name: direction } } }),
        posted_at: (direction) => ({ posted_at: { sort: direction, nulls: "last" } }),
        created_at: (direction) => ({ created_at: direction }),
      },
      default: { field: "created_at", direction: "desc" },
      tieBreaker: { field: "id", order: { id: "asc" } },
    }),
    skip: pagination.skip,
    take: pagination.take,
  });
  const users = await tx.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((row) => row.posted_by ? [row.posted_by] : []))] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  return {
    receipts: rows.map((row) => {
      const thousandths = row.items.reduce((sum, item) => sum + Math.round(Number(item.qty) * 1000), 0);
      return {
        id: row.id, receiving_no: row.receiving_no, notes: row.notes, created_at: row.created_at.toISOString(), posted_at: row.posted_at?.toISOString() ?? null,
        posted_by_name: row.posted_by ? names.get(row.posted_by) ?? null : null,
        request_id: row.request.id, request_no: row.request.request_no,
        requesting_hub_name: row.request.requesting_hub.name, requesting_company_name: row.request.requesting_company.name,
        supplying_company_name: row.request.supplying_company.name, line_count: row.items.length, qty: String(thousandths / 1000),
        lines: row.items.map((item) => ({ id: item.id, product_label: item.request_item.product_label, unit_label: item.request_item.unit_label, qty: item.qty.toString(), requested_qty: item.request_item.requested_qty.toString(), dispatched_qty: item.request_item.dispatched_qty.toString(), received_qty: item.request_item.received_qty.toString() })),
      };
    }),
    ...paginationMetadata(await tx.material_request_receiving.count({ where }), pagination),
  };
}
export function list_request_hubs(tx: DatabaseExecutor) {
  return tx.location.findMany({ where: { type: "hub" }, select: { id: true, name: true, company_id: true, company: { select: { name: true } } }, orderBy: { name: "asc" } });
}
export function list_request_suppliers(companyId: string, tx: DatabaseExecutor) {
  return tx.company_supply_relationship.findMany({ where: { requesting_company_id: companyId, is_active: true }, select: { supplying_company: { select: { id: true, name: true } } }, orderBy: { supplying_company: { name: "asc" } } });
}
export function list_request_warehouses(companyId: string, tx: DatabaseExecutor) {
  return tx.location.findMany({ where: { company_id: companyId, type: "warehouse", is_active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
export async function list_request_catalog(companyId: string, search: string, pagination: Pagination, tx: DatabaseExecutor) {
  const where: Prisma.productWhereInput = { company_id: companyId, OR: [
    { variant: { name: { contains: search, mode: "insensitive" } } },
    { variant: { brand: { name: { contains: search, mode: "insensitive" } } } },
  ] };
  const rows = await tx.product.findMany({ where, include: { variant: { include: { brand: true } }, product_type: true, base_unit: true }, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: pagination.skip, take: pagination.take });
  return { products: rows.map((product) => ({ id: product.id, label: `${product.variant.brand.name} / ${product.variant.name} / ${product.product_type.name}`, brand_name: product.variant.brand.name, variant_name: product.variant.name, product_type_name: product.product_type.name, unit_id: product.base_unit_id, unit_label: product.base_unit.symbol })), ...paginationMetadata(await tx.product.count({ where }), pagination) };
}
