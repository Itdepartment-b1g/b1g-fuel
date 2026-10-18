import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { Request, Response } from "express";
import { closeDatabase, getDatabase, type Database } from "@/server/lib/database";
import { get_record_access } from "@/server/auth/record-access";
import type { RecordAccess } from "@/lib/auth/access-scope";
import * as controller from "@/server/controllers/hubs_controller";
import type { HubAssignment, HubAssignmentHistory, HubSummary } from "@/server/schema/hubs_schema";
import { createQuickFilterState } from "@/utils/quick-filter";
import { HUB_FILTER_DEFAULTS } from "@/utils/hubs-filters";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);

async function request_hub(handler: (req: Request, res: Response) => Promise<void>, access: RecordAccess, body?: unknown, query: object = {}) {
  const state = { status: 0, body: undefined as unknown };
  const res = {
    locals: { access },
    status: (value: number) => { state.status = value; return res; },
    json: (value: unknown) => { state.body = value; return res; },
  };
  await handler({ body, query } as Request, res as unknown as Response);
  return state;
}

test("hub API preserves ownership, scopes assigned staff, enforces tenant boundaries, and retains deactivated history", { skip: !local }, async () => {
  const database = getDatabase();
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const original = state.fuelDatabase;
  const rollback = new Error("Rollback hub test fixtures");
  try {
    await assert.rejects(database.$transaction(async (tx) => {
      // Services can open transactions normally; run them inside this rollback-only test transaction.
      state.fuelDatabase = { database: new Proxy(tx, {
        get(target, key) {
          if (key === "$transaction") return async (run: (client: typeof tx) => unknown) => run(tx);
          return Reflect.get(target, key);
        },
      }) as unknown as Database };
      const [actor, agent, nextAgent, outsider, companyId, outsideCompany, membershipId, nextMembershipId, outsideMembershipId, roleId, staffRoleId] =
        Array.from({ length: 11 }, () => randomUUID());
      await tx.user.createMany({ data: [
        { id: actor, name: "Hub supervisor", created_at: new Date("2026-01-01T00:00:00Z") }, { id: agent, name: "Hub agent", email: `hub-${agent}@example.test`, created_at: new Date("2026-02-01T00:00:00Z") },
        { id: nextAgent, name: "Replacement agent", created_at: new Date("2026-03-01T00:00:00Z") }, { id: outsider, name: "Other company agent", created_at: new Date("2026-04-01T00:00:00Z") },
      ] });
      await tx.company.createMany({ data: [{ id: companyId, name: "Hub company" }, { id: outsideCompany, name: "Other hub company" }] });
      await tx.roles.create({ data: {
        id: roleId, name: "Hub supervisor", slug: `hub_supervisor_${roleId}`, company_id: companyId,
        pages: { create: { page_key: "hubs" } },
        permissions: { create: ["view", "add", "edit", "delete"].map((action) => ({ permission_key: `hubs.${action}`, access_scope: "company" })) },
      } });
      await tx.roles.create({ data: {
        id: staffRoleId, name: "Hub agent", slug: `hub_agent_${staffRoleId}`, company_id: companyId,
        pages: { create: { page_key: "hubs" } },
        permissions: { create: { permission_key: "hubs.view", access_scope: "own" } },
      } });
      await tx.user_company.create({ data: { user_id: actor, company_id: companyId, roles: { create: { role_id: roleId } } } });
      await tx.user_company.create({ data: { id: membershipId, user_id: agent, company_id: companyId, roles: { create: { role_id: staffRoleId } } } });
      await tx.user_company.createMany({ data: [
        { id: nextMembershipId, user_id: nextAgent, company_id: companyId },
        { id: outsideMembershipId, user_id: outsider, company_id: outsideCompany },
      ] });
      const supervisor = await get_record_access(actor, tx);
      const staff = await get_record_access(agent, tx);
      const noPermissions = await get_record_access(nextAgent, tx);
      const outside = { ...supervisor, companyIds: [outsideCompany], grants: supervisor.grants.map((grant) => ({ ...grant, companyId: outsideCompany })) };
      const warehouse = await tx.location.create({ data: { company_id: companyId, name: "Warehouse", type: "warehouse" } });
      const foreignHub = await tx.location.create({ data: { company_id: outsideCompany, name: "Foreign hub", type: "hub" } });

      const created = await request_hub(controller.create_hub, supervisor, { name: "  North hub  ", address: "  North road  " });
      assert.equal(created.status, 201);
      const hub = (created.body as { hub: HubSummary }).hub;
      assert.equal(hub.name, "North hub");
      assert.equal(hub.address, "North road");
      assert.equal(hub.company_id, companyId);
      assert.equal(hub.created_by, actor);
      assert.equal(hub.created_by_name, "Hub supervisor");
      assert.equal(hub.staff_count, 0);
      assert.equal((await request_hub(controller.create_hub, supervisor, { name: "Forbidden", company_id: outsideCompany })).status, 403);

      const options = await request_hub(controller.get_hub_option, supervisor);
      assert.deepEqual((options.body as { companies: Array<{ id: string }> }).companies.map((company) => company.id), [companyId]);
      const listed = await request_hub(controller.list_hub, supervisor, undefined, { page_size: "10", search: "North" });
      assert.equal((listed.body as { total: number }).total, 1);
      assert.equal((await request_hub(controller.list_by_id_hub, supervisor, undefined, { id: foreignHub.id })).status, 404);
      assert.equal((await request_hub(controller.list_by_id_hub, outside, undefined, { id: hub.id })).status, 404);
      assert.equal((await request_hub(controller.list_by_id_hub, supervisor, undefined, { id: warehouse.id })).status, 404);
      assert.equal((await request_hub(controller.update_hub, supervisor, { id: warehouse.id, name: "Not a hub" })).status, 404);
      assert.equal((await request_hub(controller.delete_hub, supervisor, undefined, { id: warehouse.id })).status, 404);
      assert.equal((await request_hub(controller.update_hub, outside, { id: hub.id, name: "Forbidden" })).status, 404);
      assert.equal((await request_hub(controller.delete_hub, outside, undefined, { id: hub.id })).status, 404);
      assert.equal((await request_hub(controller.list_by_id_hub, staff, undefined, { id: hub.id })).status, 404);

      const assignmentInput = { location_id: hub.id, user_company_id: membershipId };
      const ownEditor = { ...staff, grants: [...staff.grants, { permission: "hubs.edit", scope: "own" as const, companyId }] };
      assert.equal((await request_hub(controller.assign_hub, ownEditor, assignmentInput)).status, 403);
      assert.equal((await request_hub(controller.assign_hub, outside, assignmentInput)).status, 404);
      assert.equal((await request_hub(controller.assign_hub, supervisor, { ...assignmentInput, user_company_id: outsideMembershipId })).status, 400);
      assert.equal((await request_hub(controller.assign_hub, supervisor, { ...assignmentInput, location_id: warehouse.id })).status, 404);
      const assigned = await request_hub(controller.assign_hub, supervisor, assignmentInput);
      assert.equal(assigned.status, 201);
      const assignment = (assigned.body as { assignment: HubAssignment }).assignment;
      assert.equal(assignment.assigned_by, actor);
      assert.equal(assignment.assigned_by_name, "Hub supervisor");
      assert.equal(assignment.user.id, agent);
      assert.deepEqual(assignment.roles, [{ id: staffRoleId, name: "Hub agent" }]);
      const repeated = await request_hub(controller.assign_hub, supervisor, assignmentInput);
      assert.deepEqual(repeated.body, assigned.body);
      assert.equal(await tx.user_location.count({ where: { location_id: hub.id } }), 1);
      assert.equal(await tx.user_location_history.count({ where: { id: assignment.id } }), 1);
      const activeHistory = await request_hub(controller.list_hub_assignment_history, supervisor, undefined, { location_id: hub.id });
      assert.equal(activeHistory.status, 200);
      assert.equal((activeHistory.body as { assignments: HubAssignmentHistory[] }).assignments[0].unassigned_at, null);
      assert.equal((await request_hub(controller.list_hub_assignment_history, outside, undefined, { location_id: hub.id })).status, 404);
      assert.equal((await request_hub(controller.list_hub_assignment_history, ownEditor, undefined, { location_id: hub.id })).status, 403);

      assert.equal((await request_hub(controller.list_by_id_hub, staff, undefined, { id: hub.id })).status, 200);
      const staffList = await request_hub(controller.list_hub, staff, undefined, { page_size: "10" });
      assert.deepEqual((staffList.body as { hubs: HubSummary[] }).hubs.map((row) => row.id), [hub.id]);
      const roster = await request_hub(controller.list_hub_assignment, supervisor, undefined, { location_id: hub.id });
      assert.equal((roster.body as { total: number }).total, 1);
      assert.deepEqual((roster.body as { assignments: HubAssignment[] }).assignments[0].roles, [{ id: staffRoleId, name: "Hub agent" }]);
      const choices = await request_hub(controller.get_hub_assignment_option, supervisor, undefined, { location_id: hub.id });
      const members = (choices.body as { members: Array<{ user_company_id: string }> }).members.map((member) => member.user_company_id);
      assert.ok(members.includes(nextMembershipId));
      assert.ok(!members.includes(membershipId));
      assert.ok(!members.includes(outsideMembershipId));
      const eligible = (choices.body as { members: Array<{ user: { id: string }; roles: Array<{ id: string; name: string }> }> }).members;
      assert.deepEqual(eligible.find((member) => member.user.id === actor)?.roles, [{ id: roleId, name: "Hub supervisor" }]);
      assert.deepEqual(eligible.find((member) => member.user.id === nextAgent)?.roles, []);
      assert.deepEqual(eligible.map((member) => member.user.id), [nextAgent, actor]);
      const searchedChoice = await request_hub(controller.get_hub_assignment_option, supervisor, undefined, { location_id: hub.id, search: "replacement" });
      assert.equal((searchedChoice.body as { total: number }).total, 1);
      const searchedAssignment = await request_hub(controller.list_hub_assignment, supervisor, undefined, { location_id: hub.id, search: `hub-${agent}@example.test` });
      assert.equal((searchedAssignment.body as { total: number }).total, 1);
      const noAssignmentMatch = await request_hub(controller.list_hub_assignment, supervisor, undefined, { location_id: hub.id, search: "does-not-exist" });
      assert.equal((noAssignmentMatch.body as { total: number }).total, 0);

      // More than one page proves sorting happens before pagination and counts honor search.
      const extraUsers = Array.from({ length: 12 }, (_, index) => ({
        id: randomUUID(), name: `Pagination member ${index}`,
        created_at: new Date(Date.UTC(2026, 8, 1, 0, index)),
      }));
      const extraMemberships = extraUsers.map((user) => ({ id: randomUUID(), user_id: user.id, company_id: companyId }));
      await tx.user.createMany({ data: extraUsers });
      await tx.user_company.createMany({ data: extraMemberships });
      const firstChoices = await request_hub(controller.get_hub_assignment_option, supervisor, undefined, { location_id: hub.id, search: "Pagination member", page: "1", page_size: "10" });
      const secondChoices = await request_hub(controller.get_hub_assignment_option, supervisor, undefined, { location_id: hub.id, search: "Pagination member", page: "2", page_size: "10" });
      const firstChoicePage = firstChoices.body as { total: number; members: Array<{ user: { id: string } }> };
      const secondChoicePage = secondChoices.body as typeof firstChoicePage;
      assert.equal(firstChoicePage.total, 12);
      assert.equal(secondChoicePage.total, 12);
      assert.deepEqual(
        [...firstChoicePage.members, ...secondChoicePage.members].map((member) => member.user.id),
        extraUsers.toReversed().map((user) => user.id),
      );
      assert.equal(firstChoicePage.members.length, 10);
      assert.equal(secondChoicePage.members.length, 2);
      await tx.user_location.createMany({ data: extraMemberships.map((membership) => ({
        user_company_id: membership.id, company_id: companyId, location_id: hub.id, assigned_by: actor,
      })) });
      const firstAssignments = await request_hub(controller.list_hub_assignment, supervisor, undefined, { location_id: hub.id, search: "Pagination member", page: "1", page_size: "10" });
      const secondAssignments = await request_hub(controller.list_hub_assignment, supervisor, undefined, { location_id: hub.id, search: "Pagination member", page: "2", page_size: "10" });
      const firstAssignedPage = firstAssignments.body as { total: number; assignments: HubAssignment[] };
      const secondAssignedPage = secondAssignments.body as typeof firstAssignedPage;
      assert.equal(firstAssignedPage.total, 12);
      assert.equal(secondAssignedPage.total, 12);
      assert.deepEqual(
        [...firstAssignedPage.assignments, ...secondAssignedPage.assignments].map((member) => member.user.id),
        extraUsers.toReversed().map((user) => user.id),
      );
      await tx.user_location.deleteMany({ where: { location_id: hub.id, user_company_id: { in: extraMemberships.map((membership) => membership.id) } } });

      const updated = await request_hub(controller.update_hub, supervisor, { id: hub.id, name: "Renamed hub" });
      assert.equal(updated.status, 200);
      assert.equal((updated.body as { hub: HubSummary }).hub.created_by, actor);
      assert.equal((await request_hub(controller.delete_hub, supervisor, undefined, { id: hub.id })).status, 200);
      assert.equal((await tx.location.findUniqueOrThrow({ where: { id: hub.id } })).is_active, false);
      assert.equal(await tx.user_location.count({ where: { location_id: hub.id } }), 1);
      assert.equal((await request_hub(controller.assign_hub, supervisor, { ...assignmentInput, user_company_id: nextMembershipId })).status, 409);
      const inactive = await request_hub(controller.list_hub, supervisor, undefined, { is_active: "false" });
      assert.equal((inactive.body as { total: number }).total, 1);
      const quickFilters = createQuickFilterState(HUB_FILTER_DEFAULTS);
      quickFilters.status = "inactive";
      quickFilters.conditions = [{ id: "company", field: "company", value: companyId }];
      const filtered = await request_hub(controller.list_hub, supervisor, undefined, { filters: JSON.stringify(quickFilters) });
      assert.deepEqual((filtered.body as { hubs: HubSummary[] }).hubs.map((row) => row.id), [hub.id]);
      quickFilters.status = "active";
      const activeOnly = await request_hub(controller.list_hub, supervisor, undefined, { filters: JSON.stringify(quickFilters) });
      assert.equal((activeOnly.body as { total: number }).total, 0);
      const filterChoices = await request_hub(controller.get_hub_filter_option, supervisor);
      assert.equal(filterChoices.status, 200);
      assert.deepEqual((filterChoices.body as { fields: Array<{ key: string; options: Array<{ value: string }> }> }).fields.find((field) => field.key === "company")?.options.map((option) => option.value), [companyId]);
      assert.equal((await request_hub(controller.update_hub, supervisor, { id: hub.id, is_active: true })).status, 200);

      assert.equal((await request_hub(controller.unassign_hub, supervisor, undefined, assignmentInput)).status, 200);
      const closedHistory = await request_hub(controller.list_hub_assignment_history, supervisor, undefined, { location_id: hub.id, search: `hub-${agent}@example.test` });
      const closedPeriod = (closedHistory.body as { assignments: HubAssignmentHistory[] }).assignments[0];
      assert.equal(closedPeriod.name, "Hub agent");
      assert.equal(closedPeriod.assigned_by_name, "Hub supervisor");
      assert.ok(closedPeriod.unassigned_at);
      assert.ok(new Date(closedPeriod.unassigned_at) >= new Date(closedPeriod.assigned_at));
      assert.equal((await request_hub(controller.assign_hub, supervisor, assignmentInput)).status, 201);
      const periods = await tx.user_location_history.findMany({ where: { location_id: hub.id, user_id: agent } });
      assert.equal(periods.length, 2);
      assert.equal(periods.filter((period) => period.unassigned_at === null).length, 1);
      assert.equal((await request_hub(controller.unassign_hub, supervisor, undefined, assignmentInput)).status, 200);
      assert.equal((await request_hub(controller.list_by_id_hub, staff, undefined, { id: hub.id })).status, 404);
      assert.equal((await request_hub(controller.unassign_hub, supervisor, undefined, assignmentInput)).status, 404);
      assert.equal((await request_hub(controller.assign_hub, supervisor, { ...assignmentInput, user_company_id: nextMembershipId })).status, 201);
      assert.equal((await request_hub(controller.list_by_id_hub, noPermissions, undefined, { id: hub.id })).status, 404);
      assert.deepEqual((await get_record_access(nextAgent, tx)).grants, []);
      assert.equal((await tx.location.findUniqueOrThrow({ where: { id: hub.id } })).created_by, actor);

      // Verify the database rejects cross-company links even when bypassing service checks.
      await tx.$executeRawUnsafe("SAVEPOINT hub_constraint");
      await assert.rejects(tx.user_location.create({ data: {
        company_id: companyId, location_id: hub.id, user_company_id: outsideMembershipId, assigned_by: actor,
      } }), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2003"));
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT hub_constraint");

      await assert.rejects(tx.user_location.create({ data: {
        company_id: companyId, location_id: hub.id, user_company_id: nextMembershipId, assigned_by: actor,
      } }), (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002"));
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT hub_constraint");

      // Duplicate names translate to 409, including a collision with a warehouse name.
      assert.equal((await request_hub(controller.create_hub, supervisor, { name: "Warehouse" })).status, 409);
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT hub_constraint");
      await tx.user_company.delete({ where: { id: nextMembershipId } });
      assert.equal(await tx.user_location.count({ where: { location_id: hub.id } }), 0);
      const removedMembershipHistory = await tx.user_location_history.findFirstOrThrow({ where: { location_id: hub.id, user_id: nextAgent } });
      assert.ok(removedMembershipHistory.unassigned_at);
      assert.equal(removedMembershipHistory.name, "Replacement agent");
      assert.equal(removedMembershipHistory.user_company_id, nextMembershipId);
      throw rollback;
    }, { timeout: 30000 }), (error: unknown) => error === rollback);
  } finally {
    state.fuelDatabase = original;
    await closeDatabase();
  }
});
