import { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type { RecordAccess } from "@/lib/auth/access-scope";
import type { Pagination } from "@/server/lib/pagination";
import { MR_UUID, type RequestInput, type CreateRequestInput, type ActionInput, type ReceiveInput, type DispatchInput } from "@/server/schema/material_requests_schema";
import * as repository from "@/server/repositories/material_requests_repository";
import type { Sorting } from "@/server/lib/sorting";
import type { QuickFilterState } from "@/types/quick-filter";
import { build_filter_options } from "@/server/lib/quick-filters";
import { MATERIAL_REQUEST_FILTER_OPTIONS } from "@/utils/material-request-filters";

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
function granted(access: RecordAccess, action: string, companyId: string, facilityId: string | null, assignments: string[]) {
  return access.superAdmin || access.grants.some((grant) => grant.permission === `materialRequests.${action}` &&
    ((grant.scope === "all" && !grant.companyId) ||
      ((grant.companyId ? grant.companyId === companyId : access.companyIds.includes(companyId)) &&
        (grant.scope !== "own" || Boolean(facilityId && assignments.includes(facilityId))))));
}
const DISPATCH_STATUSES = ["approved", "partially_dispatched", "fully_dispatched", "partially_received"];
const RECEIVE_STATUSES = ["partially_dispatched", "fully_dispatched", "partially_received"];
function decimal(value: { toString(): string }) {
  return new Prisma.Decimal(value.toString());
}
function request_permissions(row: { status: string; requesting_company_id: string; requesting_hub_id: string; supplying_company_id: string; supplying_warehouse_id: string | null; items: { requested_qty: { toString(): string }; dispatched_qty: { toString(): string }; received_qty: { toString(): string } }[] }, access: RecordAccess, assignments: string[]) {
  const requester = granted(access, "edit", row.requesting_company_id, row.requesting_hub_id, assignments);
  const reviewer = granted(access, "edit", row.supplying_company_id, row.supplying_warehouse_id, assignments);
  const remainingDispatch = row.items.some((item) => decimal(item.dispatched_qty).lessThan(decimal(item.requested_qty)));
  const remainingReceive = row.items.some((item) => decimal(item.received_qty).lessThan(decimal(item.dispatched_qty)));
  return {
    edit: requester && row.status === "draft", submit: requester && row.status === "draft",
    cancel: requester && row.status === "draft", review: reviewer && row.status === "submitted",
    dispatch: reviewer && DISPATCH_STATUSES.includes(row.status) && remainingDispatch,
    receive: requester && RECEIVE_STATUSES.includes(row.status) && remainingReceive,
  };
}
function fulfillment_status(items: { requested_qty: Prisma.Decimal; dispatched_qty: Prisma.Decimal; received_qty: Prisma.Decimal }[]) {
  if (items.every((item) => item.received_qty.greaterThanOrEqualTo(item.requested_qty))) return "received" as const;
  if (items.some((item) => item.received_qty.greaterThan(0))) return "partially_received" as const;
  if (items.every((item) => item.dispatched_qty.greaterThanOrEqualTo(item.requested_qty))) return "fully_dispatched" as const;
  if (items.some((item) => item.dispatched_qty.greaterThan(0))) return "partially_dispatched" as const;
  return "approved" as const;
}
function movement_lines(input: ReceiveInput) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["id", "lines", "notes"].includes(key))) throw new MaterialRequestError(400, "Provide the request, quantities and an optional note only.");
  valid_id(input.id);
  const note = clean_note(input.notes);
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) throw new MaterialRequestError(400, "Include between 1 and 100 lines.");
  for (const line of input.lines) {
    if (!line || Object.keys(line).some((key) => !["material_request_item_id", "qty"].includes(key))) throw new MaterialRequestError(400, "Provide the request line and quantity only.");
    valid_id(line.material_request_item_id);
    if (typeof line.qty !== "string" || !/^\d{1,11}(\.\d{1,3})?$/.test(line.qty) || Number(line.qty) <= 0) throw new MaterialRequestError(400, "Quantities must be positive, with at most 11 whole digits and 3 decimal places.");
  }
  const ids = input.lines.map((line) => line.material_request_item_id.toLowerCase());
  if (new Set(ids).size !== ids.length) throw new MaterialRequestError(400, "Each request line can appear only once.");
  return { note, ids };
}
async function assignments_for(access: RecordAccess, tx: DatabaseExecutor) {
  return (await repository.get_request_assignments(access.userId, tx)).map((row) => row.facility_id);
}
async function approval_warehouse(companyId: string, access: RecordAccess, assignments: string[], tx: DatabaseExecutor) {
  const warehouses = (await repository.list_request_warehouses(companyId, tx)).filter((warehouse) => granted(access, "edit", companyId, warehouse.id, assignments));
  const assigned = warehouses.filter((warehouse) => assignments.includes(warehouse.id));
  const eligible = assigned.length ? assigned : warehouses;
  return {
    warehouse: eligible.length === 1 ? eligible[0] : null,
    error: eligible.length === 1 ? null : eligible.length === 0 ? "No active supplying warehouse is available for your account. Ask an administrator to check the warehouse setup." : "More than one supplying warehouse is available. Ask an administrator to assign you to one warehouse before approving.",
  };
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
  const assignments = await assignments_for(access, tx);
  const hub = await repository.get_request_facility(input.requesting_hub_id, tx);
  if (!hub || hub.type !== "hub" || !granted(access, action, hub.company_id, hub.id, assignments)) throw new MaterialRequestError(403, "You cannot request materials for this hub.");
  if (action === "add" && !access.superAdmin && !assignments.includes(hub.id)) throw new MaterialRequestError(403, "You can only request materials for a hub you are assigned to.");
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
      let selectedId = input.supplying_warehouse_id;
      if (selectedId === undefined) {
        const resolved = await approval_warehouse(companyId, access, assignments, tx);
        if (!resolved.warehouse) throw new MaterialRequestError(409, resolved.error!);
        selectedId = resolved.warehouse.id;
      }
      valid_id(selectedId);
      const warehouse = await repository.get_request_facility(selectedId, tx);
      if (!warehouse || warehouse.type !== "warehouse" || warehouse.company_id !== companyId || !warehouse.is_active) throw new MaterialRequestError(400, "An active warehouse belonging to the supplying company is required.");
      warehouseId = warehouse.id;
    }
    if (!granted(access, "edit", companyId, review ? warehouseId : row.requesting_hub_id, assignments)) throw new MaterialRequestError(403, "You cannot perform this action for this company or facility.");
    if (input.action === "approve" && input.supplying_warehouse_id !== undefined) {
      const resolved = await approval_warehouse(companyId, access, assignments, tx);
      if (!resolved.warehouse || resolved.warehouse.id !== warehouseId) throw new MaterialRequestError(409, resolved.error ?? "The supplying warehouse changed. Refresh the request preview before approving.");
    }
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

export async function dispatch_material_request(input: DispatchInput, access: RecordAccess) {
  const { note } = movement_lines(input);
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_material_request(input.id, tx);
    const { row, assignments } = await checked_request(input.id, access, tx);
    if (!row.supplying_warehouse_id || !DISPATCH_STATUSES.includes(row.status)) throw new MaterialRequestError(409, "The request status no longer allows dispatch.");
    if (!granted(access, "edit", row.supplying_company_id, row.supplying_warehouse_id, assignments)) throw new MaterialRequestError(403, "You can only dispatch materials from the supplying warehouse.");
    const adds = input.lines.map((line) => {
      const item = row.items.find((rowItem) => rowItem.id.toLowerCase() === line.material_request_item_id.toLowerCase());
      if (!item || item.approved_qty === null) throw new MaterialRequestError(400, "Choose a line from this approved request.");
      const qty = new Prisma.Decimal(line.qty);
      if (qty.greaterThan(item.requested_qty.minus(item.dispatched_qty))) throw new MaterialRequestError(409, "Dispatched quantity cannot be more than the quantity still to dispatch.");
      return { item, qty, next: item.dispatched_qty.plus(qty) };
    });
    const postedAt = new Date();
    const number = await repository.allocate_dispatch_number(row.supplying_company_id, row.supplying_company.name, postedAt, tx);
    const dispatch = await repository.create_posted_request_dispatch({
      supplying_company_id: row.supplying_company_id, material_request_id: row.id, facility_id: row.supplying_warehouse_id,
      status: "posted", dispatch_seq: number.dispatch_seq, dispatch_no: number.dispatch_no, notes: note,
      created_by: access.userId, posted_by: access.userId, posted_at: postedAt,
      items: { create: adds.map((line) => ({ material_request_item_id: line.item.id, product_id: line.item.product_id, unit_id: line.item.unit_id, qty: line.qty, content_per_unit: new Prisma.Decimal(1), base_qty: line.qty })) },
    }, tx);
    for (const line of [...dispatch.items].sort((left, right) => left.product_id.localeCompare(right.product_id))) {
      await repository.take_stock(row.supplying_warehouse_id, line.product_id, line.qty, line.id, access.userId, tx);
    }
    const nextItems = row.items.map((item) => ({ requested_qty: item.requested_qty, dispatched_qty: adds.find((line) => line.item.id === item.id)?.next ?? item.dispatched_qty, received_qty: item.received_qty }));
    const status = fulfillment_status(nextItems);
    const updated = await repository.update_material_request(row.id, {
      status,
      items: { update: adds.map((line) => ({ where: { id: line.item.id }, data: { dispatched_qty: line.next } })) },
      events: { create: { kind: "dispatched", from_status: row.status, to_status: status, note, created_by: access.userId } },
    }, tx);
    return { ...await repository.serialize_request(updated, tx), dispatch_no: number.dispatch_no };
  });
}

export async function receive_material_request(input: ReceiveInput, access: RecordAccess) {
  const { note } = movement_lines(input);
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_material_request(input.id, tx);
    const { row, assignments } = await checked_request(input.id, access, tx);
    if (!RECEIVE_STATUSES.includes(row.status)) throw new MaterialRequestError(409, "The request status no longer allows receiving.");
    if (!granted(access, "edit", row.requesting_company_id, row.requesting_hub_id, assignments)) throw new MaterialRequestError(403, "You can only receive materials for a hub you can edit.");
    const adds = input.lines.map((line) => {
      const item = row.items.find((rowItem) => rowItem.id.toLowerCase() === line.material_request_item_id.toLowerCase());
      if (!item || item.approved_qty === null) throw new MaterialRequestError(400, "Choose a line from this approved request.");
      const qty = new Prisma.Decimal(line.qty);
      if (qty.greaterThan(item.dispatched_qty.minus(item.received_qty))) throw new MaterialRequestError(409, "Received quantity cannot be more than the dispatched quantity still to receive.");
      return { item, qty, next: item.received_qty.plus(qty) };
    });
    await repository.lock_request_company(row.requesting_company_id, tx);
    const postedAt = new Date();
    const number = await repository.allocate_receipt_number(row.requesting_company_id, row.requesting_company.name, postedAt, tx);
    const receipt = await repository.create_posted_request_receipt({
      requesting_company_id: row.requesting_company_id, material_request_id: row.id, facility_id: row.requesting_hub_id,
      status: "posted", receipt_seq: number.receipt_seq, receiving_no: number.receiving_no, notes: note,
      created_by: access.userId, posted_by: access.userId, posted_at: postedAt,
      items: { create: adds.map((line) => ({ material_request_item_id: line.item.id, product_id: line.item.product_id, unit_id: line.item.unit_id, qty: line.qty, content_per_unit: new Prisma.Decimal(1), base_qty: line.qty })) },
    }, tx);
    for (const line of receipt.items) await repository.give_stock(row.requesting_hub_id, line.product_id, line.qty, line.id, access.userId, tx);
    const nextItems = row.items.map((item) => ({ requested_qty: item.requested_qty, dispatched_qty: item.dispatched_qty, received_qty: adds.find((line) => line.item.id === item.id)?.next ?? item.received_qty }));
    const status = fulfillment_status(nextItems);
    const updated = await repository.update_material_request(row.id, {
      status,
      items: { update: adds.map((line) => ({ where: { id: line.item.id }, data: { received_qty: line.next } })) },
      events: { create: { kind: "receipt_posted", from_status: row.status, to_status: status, note, created_by: access.userId, material_request_receiving_id: receipt.id } },
    }, tx);
    return { ...await repository.serialize_request(updated, tx), receiving_no: number.receiving_no };
  });
}

export async function list_by_id_material_request(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const { row, assignments } = await checked_request(id, access, tx);
    const permissions = request_permissions(row, access, assignments);
    const resolved = permissions.review ? await approval_warehouse(row.supplying_company_id, access, assignments, tx) : null;
    const request = await repository.serialize_request(row, tx);
    if (permissions.dispatch && row.supplying_warehouse_id) {
      const stock = await repository.list_facility_stock(row.supplying_warehouse_id, row.items.map((item) => item.product_id), tx);
      const available = new Map(stock.map((balance) => [balance.product_id, balance.qty.toString()]));
      request.items = request.items.map((item) => ({ ...item, available_qty: available.get(item.product_id) ?? "0" }));
    }
    return { ...request, permissions, approval_warehouse: resolved?.warehouse ?? null, approval_warehouse_error: resolved?.error ?? null };
  });
}
function request_visibility(access: RecordAccess, assigned: string[], permission = "materialRequests.view"): Prisma.material_requestWhereInput {
  const OR: Prisma.material_requestWhereInput[] = access.superAdmin ? [{}] : access.grants.filter((grant) => grant.permission === permission).flatMap((grant) => {
      if (grant.scope === "all" && !grant.companyId) return [{}];
      const company = { in: grant.companyId ? [grant.companyId] : access.companyIds };
      return [{ requesting_company_id: company, ...(grant.scope === "own" ? { requesting_hub_id: { in: assigned } } : {}) },
        { supplying_company_id: company, submitted_at: { not: null }, ...(grant.scope === "own" ? { supplying_warehouse_id: { in: assigned } } : {}) }];
  });
  return { OR };
}
export async function list_material_request_receipts(search: string, pagination: Pagination, access: RecordAccess, sorting?: Sorting) {
  if (search.length > 160) throw new MaterialRequestError(400, "Provide a valid search.");
  return getDatabase().$transaction(async (tx) => repository.list_request_receipts(request_visibility(access, await assignments_for(access, tx), "materialRequestReceiving.view"), search.trim(), pagination, sorting, tx), { isolationLevel: "RepeatableRead" });
}
export async function list_material_request(search: string, status: string, pagination: Pagination, access: RecordAccess, sorting?: Sorting, filters?: QuickFilterState) {
  if (search.length > 160 || (status && !["draft", "submitted", "approved", "partially_dispatched", "fully_dispatched", "partially_received", "received", "closed", "rejected", "cancelled"].includes(status))) throw new MaterialRequestError(400, "Provide valid search and status filters.");
  for (const condition of filters?.conditions ?? []) {
    if ((condition.field === "hub" || condition.field === "supplier") && condition.value.trim()) valid_id(condition.value.trim());
  }
  return getDatabase().$transaction(async (tx) => {
    const assigned = await assignments_for(access, tx);
    const where: Prisma.material_requestWhereInput = { AND: [request_visibility(access, assigned), ...(status ? [{ status: status as "draft" }] : [])] };
    const page = await repository.list_material_request(where, pagination, tx, search, sorting, filters);
    return { ...page, requests: page.requests.map((row) => ({ ...row, permissions: request_permissions(row, access, assigned) })) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function get_material_request_filter_option(access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const rows = await repository.get_material_request_filter_data(request_visibility(access, await assignments_for(access, tx)), tx);
    return build_filter_options(rows, MATERIAL_REQUEST_FILTER_OPTIONS, (row, field) => {
      if (field === "request_no") return { value: row.request_no ?? "draft", label: row.request_no ?? "Draft" };
      const value = field === "hub" ? row.requesting_hub : row.supplying_company;
      return { value: value.id, label: value.name };
    }, (row, status) => row.status === status);
  }, { isolationLevel: "RepeatableRead" });
}
export async function get_material_request_options(hubId: string | undefined, supplierId: string | undefined, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    const assigned = await assignments_for(access, tx);
    const hubs = (await repository.list_request_hubs(tx)).filter((hub) => assigned.includes(hub.id) && (granted(access, "add", hub.company_id, hub.id, assigned) || granted(access, "edit", hub.company_id, hub.id, assigned)));
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
    const hub = await repository.get_request_facility(hubId, tx);
    const assigned = await assignments_for(access, tx);
    if (!hub || hub.type !== "hub" || !(granted(access, "add", hub.company_id, hub.id, assigned) || granted(access, "edit", hub.company_id, hub.id, assigned))) throw new MaterialRequestError(403, "You cannot browse this hub's supply catalog.");
    const link = await repository.get_request_relationship(hub.company_id, supplierId, tx);
    if (!link?.is_active) throw new MaterialRequestError(403, "An active company supply link is required.");
    return repository.list_request_catalog(supplierId, search, pagination, tx);
  }, { isolationLevel: "RepeatableRead" });
}
