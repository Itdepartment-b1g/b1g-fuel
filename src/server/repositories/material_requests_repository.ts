import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseExecutor } from "@/server/lib/database";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";

const include = {
  requesting_company: { select: { id: true, name: true } },
  supplying_company: { select: { id: true, name: true } },
  requesting_hub: { select: { id: true, name: true } },
  supplying_warehouse: { select: { id: true, name: true } },
  items: { orderBy: { id: "asc" } },
  events: { orderBy: [{ created_at: "asc" }, { id: "asc" }] },
} satisfies Prisma.material_requestInclude;
export type RequestRecord = Prisma.material_requestGetPayload<{ include: typeof include }>;

export async function serialize_request(row: RequestRecord, tx: DatabaseExecutor) {
  const users = await tx.user.findMany({ where: { id: { in: [...new Set([row.created_by, ...row.events.map((event) => event.created_by)])] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  return { ...row, created_by_name: names.get(row.created_by) ?? null,
    created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString(),
    needed_at: row.needed_at?.toISOString() ?? null, submitted_at: row.submitted_at?.toISOString() ?? null,
    items: row.items.map((item) => ({ ...item, requested_qty: item.requested_qty.toString(), approved_qty: item.approved_qty?.toString() ?? null })),
    events: row.events.map((event) => ({ ...event, created_at: event.created_at.toISOString(), created_by_name: names.get(event.created_by) ?? null })),
  };
}

export function get_request(id: string, tx: DatabaseExecutor) {
  return tx.material_request.findUnique({ where: { id }, include });
}
export async function list_material_request(where: Prisma.material_requestWhereInput, pagination: Pagination, tx: DatabaseExecutor) {
  const rows = await tx.material_request.findMany({ where, include, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: pagination.skip, take: pagination.take });
  const requests = [];
  for (const row of rows) requests.push(await serialize_request(row, tx));
  return { requests, ...paginationMetadata(await tx.material_request.count({ where }), pagination) };
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
export function list_request_hubs(tx: DatabaseExecutor) {
  return tx.location.findMany({ where: { type: "hub" }, select: { id: true, name: true, company_id: true, company: { select: { name: true } } }, orderBy: { name: "asc" } });
}
export function list_request_suppliers(companyId: string, tx: DatabaseExecutor) {
  return tx.company_supply_relationship.findMany({ where: { requesting_company_id: companyId, is_active: true }, select: { supplying_company: { select: { id: true, name: true } } }, orderBy: { supplying_company: { name: "asc" } } });
}
export function list_request_warehouses(companyId: string, tx: DatabaseExecutor) {
  return tx.location.findMany({ where: { company_id: companyId, type: "warehouse" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
export async function list_request_catalog(companyId: string, search: string, pagination: Pagination, tx: DatabaseExecutor) {
  const where: Prisma.productWhereInput = { company_id: companyId, OR: [
    { variant: { name: { contains: search, mode: "insensitive" } } },
    { variant: { brand: { name: { contains: search, mode: "insensitive" } } } },
  ] };
  const rows = await tx.product.findMany({ where, include: { variant: { include: { brand: true } }, product_type: true, base_unit: true }, orderBy: [{ created_at: "desc" }, { id: "asc" }], skip: pagination.skip, take: pagination.take });
  return { products: rows.map((product) => ({ id: product.id, label: `${product.variant.brand.name} / ${product.variant.name} / ${product.product_type.name}`, unit_id: product.base_unit_id, unit_label: product.base_unit.symbol })), ...paginationMetadata(await tx.product.count({ where }), pagination) };
}
