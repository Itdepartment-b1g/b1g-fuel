import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type { RecordAccess } from "@/lib/auth/access-scope";
import type { Pagination } from "@/server/lib/pagination";
import { MR_UUID, type RequestInput, type CreateRequestInput, type ActionInput } from "@/server/schema/material_requests_schema";
import * as repository from "@/server/repositories/material_requests_repository";

export class MaterialRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function valid_id(id: unknown): asserts id is string {
  if (typeof id !== "string" || !MR_UUID.test(id)) throw new MaterialRequestError(400, "Provide a valid ID.");
}
function clean_note(value: unknown) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 1000) throw new MaterialRequestError(400, "Notes must contain at most 1000 characters.");
  return value.trim();
}
function granted(access: RecordAccess, action: string, companyId: string, locationId: string | null, assignments: string[]) {
  return access.superAdmin || access.grants.some((grant) => grant.permission === `materialRequests.${action}` &&
    ((grant.scope === "all" && !grant.companyId) ||
      ((grant.companyId ? grant.companyId === companyId : access.companyIds.includes(companyId)) &&
        (grant.scope !== "own" || Boolean(locationId && assignments.includes(locationId))))));
}
function request_permissions(row: Pick<repository.RequestRecord, "status" | "requesting_company_id" | "requesting_hub_id" | "supplying_company_id" | "supplying_warehouse_id">, access: RecordAccess, assignments: string[]) {
  const requester = granted(access, "edit", row.requesting_company_id, row.requesting_hub_id, assignments);
  const reviewer = granted(access, "edit", row.supplying_company_id, row.supplying_warehouse_id, assignments);
  return {
    edit: requester && row.status === "draft", submit: requester && row.status === "draft",
    cancel: requester && row.status === "draft", review: reviewer && row.status === "submitted",
  };
}
async function assignments_for(access: RecordAccess, tx: DatabaseExecutor) {
  return (await repository.get_request_assignments(access.userId, tx)).map((row) => row.location_id);
}
function can_read(row: repository.RequestRecord, access: RecordAccess, assignments: string[]) {
  return granted(access, "view", row.requesting_company_id, row.requesting_hub_id, assignments) ||
    (row.submitted_at !== null && granted(access, "view", row.supplying_company_id, row.supplying_warehouse_id, assignments));
}
async function checked_request(id: string, access: RecordAccess, tx: DatabaseExecutor) {
  valid_id(id);
  const row = await repository.get_request(id, tx);
  const assignments = await assignments_for(access, tx);
  if (!row || !can_read(row, access, assignments)) throw new MaterialRequestError(404, "Material request not found.");
  return { row, assignments };
}
async function checked_items(input: RequestInput, companyId: string, tx: DatabaseExecutor) {
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new MaterialRequestError(400, "Include between 1 and 100 products.");
  for (const item of input.items) {
    if (!item || Object.keys(item).some((key) => !["product_id", "requested_qty"].includes(key))) throw new MaterialRequestError(400, "Provide product and quantity only.");
    valid_id(item.product_id);
    if (typeof item.requested_qty !== "string" || !/^\d{1,11}(\.\d{1,3})?$/.test(item.requested_qty) || Number(item.requested_qty) <= 0)
      throw new MaterialRequestError(400, "Quantities must be positive, with at most 11 whole digits and 3 decimal places.");
  }
  const ids = input.items.map((item) => item.product_id.toLowerCase());
  if (new Set(ids).size !== ids.length) throw new MaterialRequestError(400, "Each product can appear only once.");
  const products = await repository.get_request_product(ids, companyId, tx);
  if (products.length !== ids.length) throw new MaterialRequestError(400, "Select products from the supplying company's catalog.");
  return input.items.map((item) => {
    const product = products.find((row) => row.id === item.product_id.toLowerCase())!;
    return { product_id: product.id, unit_id: product.base_unit_id, requested_qty: item.requested_qty,
      product_label: `${product.variant.brand.name} / ${product.variant.name} / ${product.product_type.name}`,
      unit_label: product.base_unit.symbol };
  });
}
async function checked_input(input: RequestInput, access: RecordAccess, tx: DatabaseExecutor, action: string) {
  if (!input || Object.keys(input).some((key) => !["requesting_hub_id", "supplying_company_id", "items", "notes", "needed_at"].includes(key))) throw new MaterialRequestError(400, "Provide hub, supplier, items, notes and needed date only.");
  valid_id(input.requesting_hub_id); valid_id(input.supplying_company_id);
  const hub = await repository.get_request_location(input.requesting_hub_id, tx);
  if (!hub || hub.type !== "hub" || !granted(access, action, hub.company_id, hub.id, await assignments_for(access, tx))) throw new MaterialRequestError(403, "You cannot request materials for this hub.");
  let relationship = await repository.get_request_relationship(hub.company_id, input.supplying_company_id, tx);
  if (!relationship) throw new MaterialRequestError(400, "These companies do not have an active supply link.");
  await repository.lock_request_relationship(relationship.id, tx);
  relationship = await repository.get_request_relationship(hub.company_id, input.supplying_company_id, tx);
  if (!relationship?.is_active) throw new MaterialRequestError(409, "The company supply link is inactive.");
  let neededAt: Date | null = null;
  if (input.needed_at) {
    if (typeof input.needed_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.needed_at)) throw new MaterialRequestError(400, "Provide a valid needed date.");
    neededAt = new Date(`${input.needed_at}T00:00:00+08:00`);
    if (Number.isNaN(neededAt.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(neededAt) !== input.needed_at) throw new MaterialRequestError(400, "Provide a valid needed date.");
  }
  return { hub, relationship, notes: clean_note(input.notes), neededAt, items: await checked_items(input, input.supplying_company_id, tx) };
}

export async function create_material_request(input: CreateRequestInput, access: RecordAccess) {
  if (!input || (input.submit !== undefined && typeof input.submit !== "boolean")) throw new MaterialRequestError(400, "Submit must be true or false.");
  const { submit = false, ...draft } = input;
  return getDatabase().$transaction(async (tx) => {
    const { hub, relationship, notes, neededAt, items } = await checked_input(draft, access, tx, "add");
    const now = new Date();
    const events: Prisma.material_request_eventUncheckedCreateWithoutRequestInput[] = [{ kind: "created", to_status: "draft", created_by: access.userId, created_at: now }];
    let requestNo: string | null = null;
    if (submit) {
      if (!granted(access, "edit", hub.company_id, hub.id, await assignments_for(access, tx))) throw new MaterialRequestError(403, "You cannot submit requests for this hub.");
      await repository.lock_request_company(hub.company_id, tx);
      requestNo = await repository.allocate_request_number(hub.company_id, hub.company.name, now, tx);
      // Keep creation before submission when both timeline events are written together.
      events.push({ kind: "submitted", from_status: "draft", to_status: "submitted", created_by: access.userId, created_at: new Date(now.getTime() + 1) });
    }
    const row = await repository.create_material_request({ requesting_company_id: hub.company_id, supplying_company_id: relationship.supplying_company_id,
      requesting_hub_id: hub.id, supply_relationship_id: relationship.id, notes, needed_at: neededAt, created_by: access.userId,
      status: submit ? "submitted" : "draft", request_no: requestNo, submitted_at: submit ? now : null,
      items: { create: items }, events: { create: events } }, tx);
    return repository.serialize_request(row, tx);
  });
}
export async function update_material_request(id: string, input: RequestInput, access: RecordAccess) {
  valid_id(id);
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_material_request(id, tx);
    const { row, assignments } = await checked_request(id, access, tx);
    if (!granted(access, "edit", row.requesting_company_id, row.requesting_hub_id, assignments)) throw new MaterialRequestError(403, "Only the requesting side can edit drafts.");
    if (row.status !== "draft") throw new MaterialRequestError(409, "Only drafts can be edited.");
    const checked = await checked_input(input, access, tx, "edit");
    if (checked.hub.id !== row.requesting_hub_id || checked.relationship.id !== row.supply_relationship_id) throw new MaterialRequestError(400, "The hub and supplier cannot be changed. Create another request instead.");
    await repository.replace_request_items(id, tx);
    const updated = await repository.update_material_request(id, { notes: checked.notes, needed_at: checked.neededAt, items: { create: checked.items },
      events: { create: { kind: "updated", from_status: "draft", to_status: "draft", created_by: access.userId, created_at: new Date() } } }, tx);
    return repository.serialize_request(updated, tx);
  });
}
export async function action_material_request(input: ActionInput, access: RecordAccess) {
  if (!input || Object.keys(input).some((key) => !["id", "action", "note", "supplying_warehouse_id"].includes(key))) throw new MaterialRequestError(400, "Provide action details only.");
  valid_id(input.id);
  if (!["submit", "approve", "reject", "cancel"].includes(input.action)) throw new MaterialRequestError(400, "Choose a valid request action.");
  const note = clean_note(input.note);
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_material_request(input.id, tx);
    const { row, assignments } = await checked_request(input.id, access, tx);
    const review = input.action === "approve" || input.action === "reject";
    const companyId = review ? row.supplying_company_id : row.requesting_company_id;
    let warehouseId = row.supplying_warehouse_id;
    if (input.action === "approve") {
      valid_id(input.supplying_warehouse_id);
      const warehouse = await repository.get_request_location(input.supplying_warehouse_id, tx);
      if (!warehouse || warehouse.type !== "warehouse" || warehouse.company_id !== companyId) throw new MaterialRequestError(400, "Select a warehouse belonging to the supplying company.");
      warehouseId = warehouse.id;
    }
    if (!granted(access, "edit", companyId, review ? warehouseId : row.requesting_hub_id, assignments)) throw new MaterialRequestError(403, "You cannot perform this action for this company or location.");
    if ((input.action === "submit" && row.status !== "draft") || (review && row.status !== "submitted") || (input.action === "cancel" && row.status !== "draft"))
      throw new MaterialRequestError(409, "The request status no longer allows this action.");
    const status = input.action === "submit" ? "submitted" : input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "cancelled";
    const data: Prisma.material_requestUncheckedUpdateInput = { status, events: { create: { kind: status, from_status: row.status, to_status: status, note, created_by: access.userId, created_at: new Date() } } };
    if (input.action === "submit") {
      await repository.lock_request_company(row.requesting_company_id, tx);
      const checked = await checked_input({ requesting_hub_id: row.requesting_hub_id, supplying_company_id: row.supplying_company_id, items: row.items.map((item) => ({ product_id: item.product_id, requested_qty: item.requested_qty.toString() })) }, access, tx, "edit");
      await repository.replace_request_items(row.id, tx);
      data.items = { create: checked.items };
      const now = new Date();
      data.request_no = await repository.allocate_request_number(row.requesting_company_id, checked.hub.company.name, now, tx);
      data.submitted_at = now;
    }
    if (input.action === "approve") {
      data.supplying_warehouse_id = warehouseId;
      data.items = { update: row.items.map((item) => ({ where: { id: item.id }, data: { approved_qty: item.requested_qty } })) };
    }
    return repository.serialize_request(await repository.update_material_request(row.id, data, tx), tx);
  });
}

export async function list_by_id_material_request(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const { row, assignments } = await checked_request(id, access, tx);
    return { ...await repository.serialize_request(row, tx), permissions: request_permissions(row, access, assignments) };
  });
}
export async function list_material_request(search: string, status: string, pagination: Pagination, access: RecordAccess) {
  if (search.length > 160 || (status && !["draft", "submitted", "approved", "rejected", "cancelled"].includes(status))) throw new MaterialRequestError(400, "Provide valid search and status filters.");
  return getDatabase().$transaction(async (tx) => {
    const assigned = await assignments_for(access, tx);
    const OR: Prisma.material_requestWhereInput[] = access.superAdmin ? [{}] : access.grants.filter((grant) => grant.permission === "materialRequests.view").flatMap((grant) => {
      if (grant.scope === "all" && !grant.companyId) return [{}];
      const company = { in: grant.companyId ? [grant.companyId] : access.companyIds };
      return [{ requesting_company_id: company, ...(grant.scope === "own" ? { requesting_hub_id: { in: assigned } } : {}) },
        { supplying_company_id: company, submitted_at: { not: null }, ...(grant.scope === "own" ? { supplying_warehouse_id: { in: assigned } } : {}) }];
    });
    const where: Prisma.material_requestWhereInput = { AND: [{ OR }, ...(status ? [{ status: status as "draft" }] : []), ...(search ? [{ OR: [ { request_no: { contains: search, mode: "insensitive" as const } }, { requesting_hub: { name: { contains: search, mode: "insensitive" as const } } } ] }] : [])] };
    const page = await repository.list_material_request(where, pagination, tx);
    return { ...page, requests: page.requests.map((row) => ({ ...row, permissions: request_permissions(row, access, assigned) })) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function get_material_request_options(hubId: string | undefined, supplierId: string | undefined, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const assigned = await assignments_for(access, tx);
    const hubs = (await repository.list_request_hubs(tx)).filter((hub) => granted(access, "add", hub.company_id, hub.id, assigned) || granted(access, "edit", hub.company_id, hub.id, assigned));
    const hub = hubs.find((row) => row.id === hubId);
    const suppliers = hub ? (await repository.list_request_suppliers(hub.company_id, tx)).map((row) => row.supplying_company) : [];
    let warehouses: { id: string; name: string }[] = [];
    if (supplierId) {
      valid_id(supplierId);
      warehouses = (await repository.list_request_warehouses(supplierId, tx)).filter((warehouse) => granted(access, "edit", supplierId, warehouse.id, assigned));
    }
    return { hubs, suppliers, warehouses };
  });
}
export async function get_material_request_catalog(hubId: string, supplierId: string, search: string, pagination: Pagination, access: RecordAccess) {
  valid_id(hubId); valid_id(supplierId);
  if (search.length > 160) throw new MaterialRequestError(400, "Search is too long.");
  return getDatabase().$transaction(async (tx) => {
    const hub = await repository.get_request_location(hubId, tx);
    const assigned = await assignments_for(access, tx);
    if (!hub || hub.type !== "hub" || !(granted(access, "add", hub.company_id, hub.id, assigned) || granted(access, "edit", hub.company_id, hub.id, assigned))) throw new MaterialRequestError(403, "You cannot browse this hub's supply catalog.");
    const link = await repository.get_request_relationship(hub.company_id, supplierId, tx);
    if (!link?.is_active) throw new MaterialRequestError(403, "An active company supply link is required.");
    return repository.list_request_catalog(supplierId, search, pagination, tx);
  }, { isolationLevel: "RepeatableRead" });
}
