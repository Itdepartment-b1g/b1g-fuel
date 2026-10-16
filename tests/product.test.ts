import assert from "node:assert/strict";
import { test } from "node:test";
import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import { record_where } from "@/server/auth/record-access";
import { openapi } from "@/lib/openapi/openapi";
import { create_product } from "@/server/services/product_service";
import { create_product_type } from "@/server/services/product_type_service";
import type { Database } from "@/server/lib/database";

const company = "30000000-0000-4000-8000-000000000001";
const variant = "40000000-0000-4000-8000-000000000001";
const unit = "50000000-0000-4000-8000-000000000001";
const typeId = "60000000-0000-4000-8000-000000000001";

const productAccess: RecordAccess = {
  userId: "creator",
  superAdmin: false,
  companyIds: [company],
  pages: ["products"],
  grants: ["view", "add", "edit", "delete"].map((action) => ({
    permission: `products.${action}`,
    scope: "company" as const,
    companyId: company,
  })),
};

const typeAccess: RecordAccess = {
  userId: "creator",
  superAdmin: false,
  companyIds: [company],
  pages: ["productTypes"],
  grants: ["view", "add", "edit", "delete"].map((action) => ({
    permission: `productTypes.${action}`,
    scope: "company" as const,
    companyId: company,
  })),
};

test("product visibility is company-scoped and shared product types stay read-only for company users", () => {
  assert.deepEqual(record_where(productAccess, "products"), {
    OR: [{ company_id: { in: [company] } }],
  });
  assert.deepEqual(record_where(typeAccess, "productTypes"), {
    OR: [{ company_id: { in: [company] } }, { company_id: null }],
  });
  assert.equal(
    canPerform(typeAccess, "productTypes", "edit", {
      id: typeId,
      company_id: null,
      created_by: "admin",
    }),
    false,
  );
  assert.equal(
    canPerform(typeAccess, "productTypes", "delete", {
      id: typeId,
      company_id: null,
      created_by: "admin",
    }),
    false,
  );
});

test("product creation requires a company and stays in the user's company", async () => {
  const state = globalThis as typeof globalThis & {
    fuelDatabase?: { database: Database };
  };
  const previous = state.fuelDatabase;
  const saved: string[] = [];
  state.fuelDatabase = {
    database: {
      product: {
        create: async (args: {
          data: {
            company_id: string;
            variant_id: string;
            base_unit_id: string;
            product_type_id: string;
            note: string;
          };
        }) => {
          saved.push(args.data.company_id);
          return {
            ...args.data,
            id: company,
            created_by: productAccess.userId,
            created_at: new Date(),
            updated_at: new Date(),
            company: { id: company, name: "Acme" },
            variant: {
              id: variant,
              name: "Diesel",
              brand: { id: variant, name: "Shell" },
            },
            base_unit: { id: unit, name: "Piece", symbol: "PCS", key: "pcs" },
            product_type: { id: typeId, name: "New", key: "new" },
          };
        },
      },
      user: { findMany: async () => [{ id: productAccess.userId, name: "Ada" }] },
    } as unknown as Database,
  };
  try {
    await create_product(
      {
        company_id: "outside",
        variant_id: variant,
        base_unit_id: unit,
        product_type_id: typeId,
      },
      productAccess,
    );
    await assert.rejects(
      create_product(
        {
          company_id: "",
          variant_id: variant,
          base_unit_id: unit,
          product_type_id: typeId,
        },
        {
          ...productAccess,
          companyIds: [company, "another-company"],
          grants: [company, "another-company"].map((companyId) => ({
            permission: "products.add",
            scope: "company" as const,
            companyId,
          })),
        },
      ),
      /Select a company/,
    );
    await create_product(
      {
        company_id: company,
        variant_id: variant,
        base_unit_id: unit,
        product_type_id: typeId,
      },
      { ...productAccess, superAdmin: true },
    );
    assert.deepEqual(saved, [company, company]);
  } finally {
    state.fuelDatabase = previous;
  }
});

test("product type creation is shared for a super admin and limited to the user's company", async () => {
  const state = globalThis as typeof globalThis & {
    fuelDatabase?: { database: Database };
  };
  const previous = state.fuelDatabase;
  const saved: Array<string | null | undefined> = [];
  state.fuelDatabase = {
    database: {
      product_type: {
        create: async (args: {
          data: { company_id?: string | null; name: string; key: string };
        }) => {
          saved.push(args.data.company_id);
          return {
            ...args.data,
            id: typeId,
            company_id: args.data.company_id ?? null,
            created_by: typeAccess.userId,
            created_at: new Date(),
            updated_at: new Date(),
            company: args.data.company_id
              ? { id: company, name: "Acme" }
              : null,
          };
        },
      },
      user: { findMany: async () => [{ id: typeAccess.userId, name: "Ada" }] },
    } as unknown as Database,
  };
  try {
    await create_product_type(
      { name: "Promo", key: "promo", company_id: "outside" },
      typeAccess,
    );
    await create_product_type(
      { name: "Promo", key: "promo" },
      { ...typeAccess, superAdmin: true },
    );
    assert.deepEqual(saved, [company, undefined]);
  } finally {
    state.fuelDatabase = previous;
  }
});

test("product endpoints are documented", () => {
  assert.ok(openapi.paths["/api/product-types"]);
  assert.ok(openapi.paths["/api/products"]);
  assert.ok(openapi.components.schemas.CreateProductType);
  assert.ok(openapi.components.schemas.CreateProduct);
});
