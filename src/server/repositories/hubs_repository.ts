import type { Prisma } from "@/generated/prisma/client";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type { CreateHubInput, UpdateHubInput, HubSummary, HubAssignment, HubAssignmentHistory } from "@/server/schema/hubs_schema";
import type { QuickFilterState } from "@/types/quick-filter";

const hubInclude = {
  company: { select: { id: true, name: true } },
  users: { select: { membership: { select: { user_id: true } } } },
} satisfies Prisma.locationInclude;
const memberSelect = {
  id: true,
  company_id: true,
  user: { select: { id: true, name: true, email: true } },
  roles: {
    select: { role: { select: { id: true, name: true, company_id: true } } },
    orderBy: [{ role: { name: "asc" } }, { role: { id: "asc" } }],
  },
} satisfies Prisma.user_companySelect;
const assignmentInclude = {
  membership: { select: memberSelect },
} satisfies Prisma.user_locationInclude;

function serialize_hub_member(record: Prisma.user_companyGetPayload<{ select: typeof memberSelect }>) {
  return {
    user_company_id: record.id,
    user: record.user,
    roles: record.roles
      .filter(({ role }) => role.company_id === record.company_id)
      .map(({ role }) => ({ id: role.id, name: role.name })),
  };
}

async function actor_names(ids: Array<string | null>, client: DatabaseExecutor) {
  const unique = [...new Set(ids.flatMap((id) => id ? [id] : []))];
  const users = unique.length ? await client.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } }) : [];
  return new Map(users.map((user) => [user.id, user.name]));
}

function serialize_hub(record: Prisma.locationGetPayload<{ include: typeof hubInclude }>, names: Map<string, string>): HubSummary {
  const { users, ...hub } = record;
  return {
    ...hub,
    type: "hub",
    created_by_name: record.created_by ? names.get(record.created_by) ?? null : null,
    assigned_user_ids: users.map(({ membership }) => membership.user_id),
    staff_count: users.length,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
  };
}

function serialize_assignment(record: Prisma.user_locationGetPayload<{ include: typeof assignmentInclude }>, names: Map<string, string>): HubAssignment {
  return {
    id: record.id,
    ...serialize_hub_member(record.membership),
    location_id: record.location_id,
    assigned_by: record.assigned_by,
    assigned_by_name: names.get(record.assigned_by) ?? null,
    assigned_at: record.assigned_at.toISOString(),
  };
}

export async function list_hub(pagination: Pagination, search: string, sorting: Sorting | undefined, access: RecordAccess, companyId?: string, active?: boolean, filters?: QuickFilterState) {
  const where = build_filter<Prisma.locationWhereInput>(filters, {
    where: { AND: [
      { type: "hub" }, record_where(access, "hubs"),
      ...(companyId ? [{ company_id: companyId }] : []),
      ...(active === undefined ? [] : [{ is_active: active }]),
    ] },
    fields: {
      name: (values) => ({ OR: values.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) }),
      company: (values) => ({ company_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: { active: { is_active: true }, inactive: { is_active: false } },
    search: { value: search, fields: [(filter) => ({ name: filter }), (filter) => ({ address: filter })] },
  });
  const orderBy = build_sort<Prisma.locationOrderByWithRelationInput>(sorting, {
    fields: {
      id: (direction) => ({ id: direction }), name: (direction) => ({ name: direction }),
      address: (direction) => ({ address: direction }), is_active: (direction) => ({ is_active: direction }),
      created_at: (direction) => ({ created_at: direction }), updated_at: (direction) => ({ updated_at: direction }),
    },
    default: { field: "created_at", direction: "desc" },
    tieBreaker: { field: "id", order: { id: "asc" } },
  });
  return getDatabase().$transaction(async (tx) => {
    const rows = await tx.location.findMany({ where, include: hubInclude, orderBy, skip: pagination.skip, take: pagination.take });
    const names = await actor_names(rows.map((row) => row.created_by), tx);
    return { hubs: rows.map((row) => serialize_hub(row, names)), ...paginationMetadata(await tx.location.count({ where }), pagination) };
  }, { isolationLevel: "RepeatableRead" });
}

export function get_hub_filter_data(access: RecordAccess) {
  return getDatabase().location.findMany({
    where: { AND: [{ type: "hub" }, record_where(access, "hubs")] },
    select: { name: true, is_active: true, company: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function list_by_id_hub(id: string, access: RecordAccess, action = "view", client: DatabaseExecutor = getDatabase()) {
  const row = await client.location.findFirst({ where: { AND: [{ id, type: "hub" }, record_where(access, "hubs", action)] }, include: hubInclude });
  return row ? serialize_hub(row, await actor_names([row.created_by], client)) : null;
}

export async function create_hub(input: CreateHubInput & { company_id: string }, actor: string, client: DatabaseExecutor = getDatabase()) {
  const row = await client.location.create({
    data: { name: input.name, address: input.address ?? "", type: "hub", company_id: input.company_id, created_by: actor },
    include: hubInclude,
  });
  return serialize_hub(row, await actor_names([actor], client));
}

// Serialize hub mutation/assignment/deactivation decisions on the physical location row.
export async function lock_hub(id: string, client: DatabaseExecutor) {
  await client.$queryRaw`SELECT "id" FROM "location" WHERE "id" = ${id}::uuid AND "type" = 'hub' FOR UPDATE`;
}

export async function update_hub(input: UpdateHubInput, access: RecordAccess, client: DatabaseExecutor) {
  const changed = await client.location.updateMany({
    where: { AND: [{ id: input.id, type: "hub" }, record_where(access, "hubs", "edit")] },
    data: { name: input.name, address: input.address, is_active: input.is_active },
  });
  return changed.count ? list_by_id_hub(input.id, access, "edit", client) : null;
}

export async function delete_hub(id: string, access: RecordAccess, client: DatabaseExecutor) {
  return client.location.updateMany({
    where: { AND: [{ id, type: "hub" }, record_where(access, "hubs", "delete")] },
    data: { is_active: false },
  });
}

export function get_hub_option(companyIds: string[] | undefined, client: DatabaseExecutor = getDatabase()) {
  return client.company.findMany({ where: companyIds ? { id: { in: companyIds } } : {}, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
}

export function get_hub_membership(id: string, companyId: string, client: DatabaseExecutor) {
  return client.user_company.findFirst({ where: { id, company_id: companyId }, select: { id: true } });
}

export async function get_hub_assignment_option(locationId: string, companyId: string, pagination: Pagination, search: string, client: DatabaseExecutor) {
  const where = build_filter<Prisma.user_companyWhereInput>(undefined, {
    where: { company_id: companyId, locations: { none: { location_id: locationId } } }, fields: {},
    search: { value: search, fields: [(filter) => ({ user: { name: filter } }), (filter) => ({ user: { email: filter } })] },
  });
  const rows = await client.user_company.findMany({
    where, select: memberSelect,
    orderBy: [{ user: { created_at: "desc" } }, { id: "asc" }], skip: pagination.skip, take: pagination.take,
  });
  return { members: rows.map(serialize_hub_member), ...paginationMetadata(await client.user_company.count({ where }), pagination) };
}

export async function list_hub_assignment(locationId: string, pagination: Pagination, client: DatabaseExecutor, search = "") {
  const where = build_filter<Prisma.user_locationWhereInput>(undefined, {
    where: { location_id: locationId }, fields: {},
    search: { value: search, fields: [
      (filter) => ({ membership: { user: { name: filter } } }),
      (filter) => ({ membership: { user: { email: filter } } }),
    ] },
  });
  const rows = await client.user_location.findMany({ where, include: assignmentInclude, orderBy: [{ membership: { user: { created_at: "desc" } } }, { id: "asc" }], skip: pagination.skip, take: pagination.take });
  const names = await actor_names(rows.map((row) => row.assigned_by), client);
  return { assignments: rows.map((row) => serialize_assignment(row, names)), ...paginationMetadata(await client.user_location.count({ where }), pagination) };
}

export async function assign_hub(locationId: string, companyId: string, membershipId: string, actor: string, client: DatabaseExecutor) {
  // Repeated assignment preserves the original assigning supervisor and timestamp.
  const row = await client.user_location.upsert({
    where: { user_company_id_location_id: { user_company_id: membershipId, location_id: locationId } },
    create: { location_id: locationId, company_id: companyId, user_company_id: membershipId, assigned_by: actor },
    update: {}, include: assignmentInclude,
  });
  return serialize_assignment(row, await actor_names([row.assigned_by], client));
}

export function unassign_hub(locationId: string, membershipId: string, client: DatabaseExecutor) {
  return client.user_location.deleteMany({ where: { location_id: locationId, user_company_id: membershipId } });
}

export async function list_hub_assignment_history(locationId: string, pagination: Pagination, search: string, client: DatabaseExecutor) {
  const where = build_filter<Prisma.user_location_historyWhereInput>(undefined, {
    where: { location_id: locationId }, fields: {},
    search: { value: search, fields: [(filter) => ({ name: filter }), (filter) => ({ email: filter })] },
  });
  const rows = await client.user_location_history.findMany({
    where, orderBy: [{ user_created_at: "desc" }, { assigned_at: "desc" }, { id: "asc" }],
    skip: pagination.skip, take: pagination.take,
  });
  const assignments: HubAssignmentHistory[] = rows.map((row) => ({
    id: row.id, location_id: row.location_id, user_company_id: row.user_company_id, user_id: row.user_id,
    name: row.name, email: row.email, assigned_by: row.assigned_by, assigned_by_name: row.assigned_by_name,
    assigned_at: row.assigned_at.toISOString(), unassigned_at: row.unassigned_at?.toISOString() ?? null,
  }));
  return { assignments, ...paginationMetadata(await client.user_location_history.count({ where }), pagination) };
}
