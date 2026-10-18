import { allowed_company_ids, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import type { AssignHubInput, CreateHubInput, UpdateHubInput } from "@/server/schema/hubs_schema";
import * as repository from "@/server/repositories/hubs_repository";
import type { QuickFilterState } from "@/types/quick-filter";
import { HUB_FILTER_OPTIONS } from "@/utils/hubs-filters";
import { build_filter_options } from "@/server/lib/quick-filters";

export class HubError extends Error {
  constructor(public code: "invalid_input" | "not_found" | "forbidden" | "conflict", message: string) { super(message); }
}

function hub_company_ids(access: RecordAccess) {
  if (access.superAdmin || access.grants.some((grant) => grant.permission === "hubs.add" && grant.scope === "all" && !grant.companyId)) return undefined;
  return allowed_company_ids(access, "hubs");
}

export function hub_company(access: RecordAccess, requested?: string) {
  const ids = hub_company_ids(access);
  if (ids?.length === 0) throw new HubError("forbidden", "You cannot create hubs.");
  const companyId = requested ?? (ids?.length === 1 ? ids[0] : undefined);
  if (!companyId) throw new HubError("invalid_input", "Select a company.");
  if (ids && !ids.includes(companyId)) throw new HubError("forbidden", "You cannot create hubs in this company.");
  return companyId;
}

export function hub_assignment_access(access: RecordAccess): RecordAccess {
  if (access.superAdmin) return access;
  const grants = access.grants.filter((grant) => grant.permission === "hubs.edit" && grant.scope !== "own");
  if (!grants.length) throw new HubError("forbidden", "Company-level hub edit permission is required to manage assignments.");
  return { ...access, grants };
}

export function list_hub(pagination: Pagination, search: string, sorting: Sorting | undefined, access: RecordAccess, companyId?: string, active?: boolean, filters?: QuickFilterState) {
  return repository.list_hub(pagination, search, sorting, access, companyId, active, filters);
}

export async function get_hub_filter_option(access: RecordAccess) {
  return build_filter_options(await repository.get_hub_filter_data(access), HUB_FILTER_OPTIONS,
    (hub, field) => field === "company" ? { value: hub.company.id, label: hub.company.name } : { value: hub.name, label: hub.name },
    (hub, status) => hub.is_active === (status === "active"),
  );
}

export async function list_by_id_hub(id: string, access: RecordAccess) {
  const hub = await repository.list_by_id_hub(id, access);
  if (!hub) throw new HubError("not_found", "Hub not found.");
  return hub;
}

export function create_hub(input: CreateHubInput, access: RecordAccess) {
  return repository.create_hub({ ...input, company_id: hub_company(access, input.company_id) }, access.userId);
}

export function update_hub(input: UpdateHubInput, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_hub(input.id, tx);
    const hub = await repository.update_hub(input, access, tx);
    if (!hub) throw new HubError("not_found", "Hub not found.");
    return hub;
  });
}

export function delete_hub(id: string, access: RecordAccess) {
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_hub(id, tx);
    if (!(await repository.delete_hub(id, access, tx)).count) throw new HubError("not_found", "Hub not found.");
    return { id, message: "Hub deactivated." };
  });
}

export async function get_hub_option(access: RecordAccess) {
  return { companies: await repository.get_hub_option(hub_company_ids(access)) };
}

export function get_hub_assignment_option(id: string, pagination: Pagination, search: string, access: RecordAccess) {
  const manager = hub_assignment_access(access);
  return getDatabase().$transaction(async (tx) => {
    const hub = await repository.list_by_id_hub(id, manager, "edit", tx);
    if (!hub) throw new HubError("not_found", "Hub not found.");
    return repository.get_hub_assignment_option(id, hub.company_id, pagination, search, tx);
  }, { isolationLevel: "RepeatableRead" });
}

export function list_hub_assignment(id: string, pagination: Pagination, access: RecordAccess, search = "") {
  const manager = hub_assignment_access(access);
  return getDatabase().$transaction(async (tx) => {
    if (!await repository.list_by_id_hub(id, manager, "edit", tx)) throw new HubError("not_found", "Hub not found.");
    return repository.list_hub_assignment(id, pagination, tx, search);
  }, { isolationLevel: "RepeatableRead" });
}

export function list_hub_assignment_history(id: string, pagination: Pagination, access: RecordAccess, search = "") {
  const manager = hub_assignment_access(access);
  return getDatabase().$transaction(async (tx) => {
    if (!await repository.list_by_id_hub(id, manager, "edit", tx)) throw new HubError("not_found", "Hub not found.");
    return repository.list_hub_assignment_history(id, pagination, search, tx);
  }, { isolationLevel: "RepeatableRead" });
}

export function assign_hub(input: AssignHubInput, access: RecordAccess) {
  const manager = hub_assignment_access(access);
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_hub(input.location_id, tx);
    const hub = await repository.list_by_id_hub(input.location_id, manager, "edit", tx);
    if (!hub) throw new HubError("not_found", "Hub not found.");
    if (!hub.is_active) throw new HubError("conflict", "Activate this hub before assigning staff.");
    if (!await repository.get_hub_membership(input.user_company_id, hub.company_id, tx))
      throw new HubError("invalid_input", "Select a staff member from the hub's company.");
    return repository.assign_hub(hub.id, hub.company_id, input.user_company_id, access.userId, tx);
  });
}

export function unassign_hub(input: AssignHubInput, access: RecordAccess) {
  const manager = hub_assignment_access(access);
  return getDatabase().$transaction(async (tx) => {
    await repository.lock_hub(input.location_id, tx);
    if (!await repository.list_by_id_hub(input.location_id, manager, "edit", tx)) throw new HubError("not_found", "Hub not found.");
    if (!(await repository.unassign_hub(input.location_id, input.user_company_id, tx)).count)
      throw new HubError("not_found", "Hub assignment not found.");
    return { location_id: input.location_id, user_company_id: input.user_company_id, message: "Staff member unassigned." };
  });
}
