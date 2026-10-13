import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { RoleForm } from "@/components/roles/dialog/role-form";
import { ToastProvider } from "@/components/providers/toast-provider";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { makeStore } from "@/lib/store/store";
import { getRoleOption } from "@/lib/store/roles-slice";
import { create_role, RoleError } from "@/server/services/roles_service";
import * as repository from "@/server/repositories/roles_repository";
import type { CreateRoleInput, RoleSummary } from "@/server/schema/roles_schema";
import type { AccessScope } from "@/lib/auth/access-scope";

const companyId = "10000000-0000-4000-8000-000000000001";
const input: Required<CreateRoleInput> = {
  name: "Manager", slug: "manager", scope: "company", company_id: companyId,
  permission_scopes: {},
  is_default_role: false, pages: ["home"], permissions: ["home.view", "home.edit", "home.add", "home.delete"],
};
const role: RoleSummary = {
  ...input, created_by: null, id: "20000000-0000-4000-8000-000000000001", is_system: false,
  company: { id: companyId, name: "Example Company" },
  created_at: "2026-10-13T00:00:00Z", updated_at: "2026-10-13T00:00:00Z", assignment_count: 0,
};

function renderForm(existing?: RoleSummary) {
  const store = makeStore();
  store.dispatch(getRoleOption.pending("choices", undefined));
  store.dispatch(getRoleOption.fulfilled({
    scopes: ["company", "global"], companies: [role.company!],
    pages: [...PAGE_CATALOG], permissions: [...PERMISSION_CATALOG],
  }, "choices", undefined));
  return renderToStaticMarkup(<Provider store={store}><ToastProvider><RoleForm role={existing} onCancel={() => {}} onSaved={() => {}} /></ToastProvider></Provider>);
}

test("permissions stay hidden until a page is selected", () => {
  const html = renderForm();
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /Select a company/);
});

test("editing a selected page reveals its saved action permissions and company", () => {
  const html = renderForm(role);
  assert.equal((html.match(/<details/g) ?? []).length, 1);
  assert.match(html, /Permissions for Dashboard/);
  assert.doesNotMatch(html, /Permissions for Users/);
  for (const action of ["View", "Edit", "Add", "Delete"]) assert.match(html, new RegExp(`/>${action}</label>`));
  assert.match(html, new RegExp(`value="${companyId}" selected=""`));
});

test("assigned roles lock the company selector", () => {
  assert.match(renderForm({ ...role, assignment_count: 1 }), /aria-label="Role company"[^>]*disabled=""/);
});

test("role creation saves a company and all four page actions", async () => {
  let saved: Required<CreateRoleInput> | undefined;
  const result = await create_role(input, { ...repository, create_role: async (value) => { saved = value; return role; } });
  assert.equal(result.company_id, companyId);
  assert.deepEqual(saved, input);
});

test("permissions without their page and company-linked global roles are rejected", async () => {
  const fake = { ...repository, create_role: async () => { throw new Error("Persistence must not run"); } };
  await assert.rejects(create_role({ ...input, pages: [] }, fake), (error: unknown) => error instanceof RoleError && error.code === "invalid_input");
  await assert.rejects(create_role({ ...input, scope: "global" }, fake), (error: unknown) => error instanceof RoleError && error.code === "invalid_input");
});

test("selected View/Edit/Delete permissions have scopes; Add has none", () => {
  const html = renderForm({ ...role, permission_scopes: { "home.view": "own" } });
  assert.match(html, /aria-label="Dashboard View access scope"/);
  assert.match(html, /aria-label="Dashboard Edit access scope"/);
  assert.match(html, /aria-label="Dashboard Delete access scope"/);
  assert.doesNotMatch(html, /aria-label="Dashboard Add access scope"/);
  assert.match(html, /value="own" selected=""/);
  assert.doesNotMatch(html, /value="all"/);
  assert.match(renderForm({ ...role, scope: "global", company_id: null, company: null }), /value="all"/);
});

test("company roles cannot request All or scopes for Add/unselected permissions", async () => {
  const fake = { ...repository, create_role: async () => { throw new Error("Persistence must not run"); } };
  const invalidScopes: Record<string, AccessScope>[] = [{ "home.view": "all" }, { "home.add": "own" }, { "users.view": "own" }];
  for (const permission_scopes of invalidScopes) {
    await assert.rejects(create_role({ ...input, permission_scopes }, fake), (error: unknown) => error instanceof RoleError && error.code === "invalid_input");
  }
});
