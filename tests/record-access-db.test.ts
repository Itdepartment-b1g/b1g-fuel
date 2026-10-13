import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { closeDatabase, getDatabase } from "@/server/lib/database";
import { get_record_access, record_where, allowed_company_ids } from "@/server/auth/record-access";
import { list_by_id_company, update_company } from "@/server/repositories/companies_repository";
import { update_role } from "@/server/repositories/roles_repository";

const url = process.env.DATABASE_URL;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

test("stored scopes filter real records and reject edits to another creator's company", { skip: !local }, async () => {
  const rollback = new Error("Rollback test records");
  try {
    await assert.rejects(getDatabase().$transaction(async (tx) => {
      const [actor, other, owned, outside, companyA, companyB, roleId, globalId] = Array.from({ length: 8 }, () => randomUUID());
      await tx.user.createMany({ data: [
        { id: actor, name: "Scope actor" }, { id: other, name: "Scope other" },
        { id: owned, name: "Scope owned", created_by: actor }, { id: outside, name: "Scope outside", created_by: other },
      ] });
      await tx.company.createMany({ data: [{ id: companyA, name: "Scope A", created_by: actor }, { id: companyB, name: "Scope B", created_by: other }] });
      await tx.roles.create({ data: {
        id: roleId, name: "Scoped role", slug: `scope_${roleId.replaceAll("-", "")}`, company_id: companyA, created_by: actor,
        pages: { create: [{ page_key: "users" }, { page_key: "companies" }] },
        permissions: { create: [
          { permission_key: "users.view", access_scope: "company" }, { permission_key: "users.add" },
          { permission_key: "companies.view", access_scope: "own" }, { permission_key: "companies.edit", access_scope: "own" },
        ] },
      } });
      await tx.user_company.create({ data: { user_id: actor, company_id: companyA, roles: { create: { role_id: roleId } } } });
      await tx.user_company.createMany({ data: [{ user_id: actor, company_id: companyB }, { user_id: owned, company_id: companyA }, { user_id: other, company_id: companyA }, { user_id: outside, company_id: companyB }] });

      let access = await get_record_access(actor, tx);
      const fixtures = { id: { in: [actor, other, owned, outside] } };
      const companyUsers = await tx.user.findMany({ where: { AND: [fixtures, record_where(access, "users")] } });
      assert.deepEqual(companyUsers.map((user) => user.id).sort(), [actor, other, owned].sort());
      assert.deepEqual(allowed_company_ids(access, "users"), [companyA]);
      assert.equal(await list_by_id_company(companyB, tx, false, access), null);
      await assert.rejects(update_company({ id: companyB, name: "Forbidden" }, tx, access));
      const renamed = await update_company({ id: companyA, name: "Allowed" }, tx, access);
      assert.equal(renamed.created_by, actor);

      const saved = await update_role({ id: roleId, permission_scopes: { "users.view": "own" } }, { scope: "company", is_system: false, slug: `scope_${roleId.replaceAll("-", "")}` }, tx);
      assert.equal(saved?.permission_scopes["users.view"], "own");
      assert.equal(saved?.created_by, actor);
      access = await get_record_access(actor, tx);
      const ownUsers = await tx.user.findMany({ where: { AND: [fixtures, record_where(access, "users")] } });
      assert.deepEqual(ownUsers.map((user) => user.id), [owned]);
      assert.equal(await tx.user.count({ where: { AND: [fixtures, record_where(access, "users")] } }), 1);

      await tx.roles.create({ data: { id: globalId, name: "Global scope", slug: `scope_${globalId.replaceAll("-", "")}`, scope: "global", pages: { create: { page_key: "users" } }, permissions: { create: { permission_key: "users.view", access_scope: "all" } } } });
      await tx.user_role.create({ data: { user_id: actor, role_id: globalId } });
      access = await get_record_access(actor, tx);
      assert.equal(await tx.user.count({ where: { AND: [fixtures, record_where(access, "users")] } }), 4);
      throw rollback;
    }), (error: unknown) => error === rollback);
  } finally { await closeDatabase(); }
});
