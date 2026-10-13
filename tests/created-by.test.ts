import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { create_company } from "@/server/controllers/companies_controller";
import { create_role } from "@/server/controllers/roles_controller";
import { create_user } from "@/server/controllers/users_controller";
import * as companies from "@/server/services/companies_service";
import * as roles from "@/server/services/roles_service";
import * as users from "@/server/services/users_service";
import type { CompanySummary } from "@/server/schema/companies_schema";
import type { RoleSummary } from "@/server/schema/roles_schema";
import type { UserSummary } from "@/server/schema/users_schema";

const actor = "30000000-0000-4000-8000-000000000001";
function response() {
  const state = { status: 0 };
  const res = { locals: { user: { id: actor }, access: { superAdmin: true } }, status: (value: number) => { state.status = value; return res; }, json: () => res } as unknown as Response;
  return { res, state };
}

test("create endpoints pass the authenticated creator to persistence", async () => {
  const creators: (string | undefined)[] = [];
  const company = response();
  await create_company({ body: { name: "Company" } } as Request, company.res, undefined, { ...companies, create_company: async (...args) => { creators.push(args[2]); return {} as CompanySummary; } });
  const role = response();
  await create_role({ body: { name: "Manager" } } as Request, role.res, undefined, { ...roles, create_role: async (...args) => { creators.push(args[2]); return {} as RoleSummary; } });
  const user = response();
  await create_user({ body: { name: "User", email: "test@example.com", password: "example-password" } } as Request, user.res, undefined, { ...users, create_user: async (...args) => { creators.push(args[3]); return {} as UserSummary; } });
  assert.deepEqual(creators, [actor, actor, actor]);
  assert.deepEqual([company.state.status, role.state.status, user.state.status], [201, 201, 201]);
});

test("clients cannot supply created_by to any create endpoint", async () => {
  const company = response();
  await create_company({ body: { name: "Company", created_by: actor } } as Request, company.res);
  const role = response();
  await create_role({ body: { name: "Manager", created_by: actor } } as Request, role.res);
  const user = response();
  await create_user({ body: { name: "User", email: "test@example.com", password: "example-password", created_by: actor } } as Request, user.res);
  assert.deepEqual([company.state.status, role.state.status, user.state.status], [400, 400, 400]);
});
