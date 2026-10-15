import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecordAccess } from "@/lib/auth/access-scope";
import type { Database } from "@/server/lib/database";
import { create_supplier } from "@/server/services/supplier_service";

const company = "30000000-0000-4000-8000-000000000001";
const access: RecordAccess = {
  userId: "creator", superAdmin: false, companyIds: [company], pages: ["suppliers"],
  grants: [{ permission: "suppliers.add", scope: "company", companyId: company }],
};
const input = {
  name: "Shell", contact_person: "Ada", contact_email: "ada@example.com",
  contact_phone: "555", contact_address: "Manila",
};

test("supplier creation is shared for a super admin and limited to the user's company", async () => {
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  const saved: Array<string | null | undefined> = [];
  state.fuelDatabase = { database: {
    supplier: { create: async (args: { data: { company_id?: string | null } }) => {
      saved.push(args.data.company_id);
      return { ...args.data, id: company, created_by: access.userId, created_at: new Date(), updated_at: new Date() };
    } },
    user: { findMany: async () => [{ id: access.userId, name: "Ada" }] },
  } as unknown as Database };
  try {
    await create_supplier({ ...input, company_id: "another-company" }, access);
    await create_supplier(input, { ...access, superAdmin: true });
    const several = {
      ...access,
      companyIds: [company, "another-company"],
      grants: [company, "another-company"].map((companyId) => ({ permission: "suppliers.add", scope: "company" as const, companyId })),
    };
    await assert.rejects(create_supplier(input, several), /Select a company/);
    await assert.rejects(create_supplier({ ...input, company_id: "outside" }, several), /cannot create suppliers/);
    assert.deepEqual(saved, [company, undefined]);
  } finally { state.fuelDatabase = previous; }
});
