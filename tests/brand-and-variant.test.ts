import assert from "node:assert/strict";
import { test } from "node:test";
import { parse_create_brand, parse_update_brand } from "@/server/controllers/brands_controller";
import { parse_create_variant, parse_update_variant } from "@/server/controllers/variants_controller";
import { brand_company, can_create_brand, delete_brand } from "@/server/services/brands_service";
import { create_variant, variant_company } from "@/server/services/variants_service";
import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import { record_where } from "@/server/auth/record-access";
import { openapi } from "@/lib/openapi/openapi";
import { makeStore } from "@/lib/store/store";
import { createBrand, deleteBrand, listBrand } from "@/lib/store/brands-slice";
import { createVariant, deleteVariant } from "@/lib/store/variants-slice";
import type { Database } from "@/server/lib/database";

const company = "30000000-0000-4000-8000-000000000001";
const brand = "40000000-0000-4000-8000-000000000001";
const access: RecordAccess = {
  userId: "creator", superAdmin: false, companyIds: [company], pages: ["brandsAndVariants"],
  grants: ["view", "add", "edit", "delete"].map((action) => (
    { permission: `brandsAndVariants.${action}`, scope: "company" as const, companyId: company }
  )),
};

test("brand and variant names are trimmed and unknown fields are rejected", () => {
  assert.equal(parse_create_brand({ name: " Shell ", company_id: company }).name, "Shell");
  assert.equal(parse_create_variant({ brand_id: brand, name: " Diesel " }).name, "Diesel");
  assert.throws(() => parse_create_brand({ name: "Shell", created_by: "someone" }));
  assert.equal(parse_create_variant({ brand_id: brand, name: "Diesel", company_id: company }).company_id, company);
  assert.throws(() => parse_create_variant({ brand_id: brand, name: "Diesel", created_by: "someone" }));
  assert.throws(() => parse_update_brand({ id: brand }));
  assert.equal(parse_update_variant({ id: brand, name: " Premium " }).name, "Premium");
});

test("brand visibility follows company scope and shared rows stay super-admin only", () => {
  assert.equal(can_create_brand(access, company), true);
  assert.equal(can_create_brand(access, "another-company"), false);
  assert.equal(brand_company(access, "another-company"), company);
  assert.equal(brand_company({ ...access, superAdmin: true }, company), null);
  assert.equal(variant_company(access, "another-company"), company);
  assert.equal(variant_company({ ...access, superAdmin: true }), null);
  assert.deepEqual(record_where(access, "brandsAndVariants"), { OR: [{ company_id: { in: [company] } }, { company_id: null }] });
  assert.equal(canPerform(access, "brandsAndVariants", "edit", { id: brand, company_id: null, created_by: "admin" }), false);
  assert.equal(canPerform(access, "brandsAndVariants", "delete", { id: brand, company_id: null, created_by: "admin" }), false);
  assert.deepEqual(record_where({ ...access, grants: [{ permission: "brandsAndVariants.edit", scope: "all", companyId: null }] }, "brandsAndVariants", "edit"), { company_id: { not: null } });
  assert.deepEqual(record_where({ ...access, grants: [{ permission: "brandsAndVariants.delete", scope: "all", companyId: null }] }, "brandsAndVariants", "delete"), { company_id: { not: null } });
});

test("deleting a brand with variants writes nothing", async () => {
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  let deleted = false;
  const tx = {
    brand: {
      findFirst: async () => ({ id: brand, _count: { variants: 1 } }),
      delete: async () => { deleted = true; },
    },
  };
  state.fuelDatabase = { database: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } as unknown as Database };
  try {
    await assert.rejects(delete_brand(brand, access), /Delete this brand's variants first/);
    assert.equal(deleted, false);
  } finally { state.fuelDatabase = previous; }
});

test("variant creation stores the user's company and leaves a super admin unassigned", async () => {
  const state = globalThis as typeof globalThis & { fuelDatabase?: { database: Database } };
  const previous = state.fuelDatabase;
  const saved: Array<string | null> = [];
  const database = {
    brand: { findUnique: async () => ({ company_id: null as string | null }) },
    variant: { create: async (args: { data: { company_id: string | null; name: string; brand_id: string } }) => {
      saved.push(args.data.company_id);
      return { ...args.data, id: brand, created_by: access.userId, created_at: new Date(), updated_at: new Date(), brand: { id: brand, name: "Shell" }, company: null };
    } },
    user: { findMany: async () => [] },
  };
  state.fuelDatabase = { database: database as unknown as Database };
  try {
    await create_variant({ brand_id: brand, name: "Diesel", company_id: "another-company" }, access);
    database.brand.findUnique = async () => ({ company_id: "another-company" });
    await assert.rejects(create_variant({ brand_id: brand, name: "Diesel" }, access), /cannot create variants for this brand/);
    await create_variant({ brand_id: brand, name: "Diesel", company_id: company }, { ...access, superAdmin: true });
    assert.deepEqual(saved, [company, null]);
  } finally { state.fuelDatabase = previous; }
});

test("brand and variant endpoints are documented", () => {
  assert.ok(openapi.paths["/api/brands"]);
  assert.ok(openapi.paths["/api/variants"]);
  assert.ok(openapi.components.schemas.CreateBrand);
  assert.ok(openapi.components.schemas.CreateVariant);
});

test("brand and variant thunks call the catalog API", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  const brandRecord = {
    id: brand, company_id: company, company: { id: company, name: "B1G Fuel" }, created_by: "creator", created_by_name: "Ada",
    name: "Shell", variant_count: 0, created_at: "2026-10-14T00:00:00Z", updated_at: "2026-10-14T00:00:00Z",
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const body = init?.method === "DELETE" ? { id: brand, message: "Brand deleted." } : init?.method === "POST" ? { brand: brandRecord, variant: { ...brandRecord, brand_id: brand, brand: { id: brand, name: "Shell" } } } : { brands: [brandRecord], variants: [], total: 1, page: 1, page_size: 10 };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const store = makeStore();
    await store.dispatch(listBrand({ search: "Shell", page: 1 })).unwrap();
    assert.equal(new URL(calls[0].url, "http://test").searchParams.get("search"), "Shell");
    assert.equal(calls[0].init?.credentials, "include");
    await store.dispatch(createBrand({ name: "Shell", company_id: company })).unwrap();
    assert.equal(calls[1].init?.method, "POST");
    assert.equal(calls[1].url, "/api/brands");
    await store.dispatch(createVariant({ brand_id: brand, name: "Diesel" })).unwrap();
    assert.equal(calls[2].url, "/api/variants");
    await store.dispatch(deleteBrand(brand)).unwrap();
    assert.equal(calls[3].init?.method, "DELETE");
    store.dispatch(deleteVariant.pending("busy", brand));
    const blocked = await store.dispatch(deleteVariant(brand));
    assert.ok(deleteVariant.rejected.match(blocked) && blocked.meta.condition);
  } finally { globalThis.fetch = original; }
});
