import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecordAccess } from "@/lib/auth/access-scope";
import { record_where } from "@/server/auth/record-access";
import { openapi } from "@/lib/openapi/openapi";
import { Prisma } from "@/generated/prisma/client";
import { company_code, receiving_number } from "@/server/utils/receiving-number";
import { receipt_status } from "@/server/repositories/receiving_repository";
import {
  confirm_purchase_order,
  purchase_order_company,
} from "@/server/services/purchase_order_service";
import type { Database } from "@/server/lib/database";

const company = "30000000-0000-4000-8000-000000000001";
const access: RecordAccess = {
  userId: "creator",
  superAdmin: false,
  companyIds: [company],
  pages: ["purchaseOrders"],
  grants: ["view", "add", "edit", "delete"].map((action) => ({
    permission: `purchaseOrders.${action}`,
    scope: "company" as const,
    companyId: company,
  })),
};

test("purchase order visibility stays inside the company", () => {
  assert.deepEqual(record_where(access, "purchaseOrders"), {
    OR: [{ company_id: { in: [company] } }],
  });
});

test("purchase order company follows the creator and requires a choice for a super admin", () => {
  assert.equal(purchase_order_company(access, "outside"), company);
  assert.throws(() => purchase_order_company({ ...access, superAdmin: true }), /Select a company/);
  assert.equal(
    purchase_order_company({ ...access, superAdmin: true }, company),
    company,
  );
});

test("confirming a draft without payment terms does not open the order", async () => {
  const state = globalThis as typeof globalThis & {
    fuelDatabase?: { database: Database };
  };
  const previous = state.fuelDatabase;
  let updated = false;
  const tx = {
    purchase_order: {
      findFirst: async () => ({
        id: company,
        status: "draft",
        payment_terms: "",
        _count: { items: 1 },
      }),
      update: async () => {
        updated = true;
      },
    },
  };
  state.fuelDatabase = {
    database: {
      $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
    } as unknown as Database,
  };
  try {
    await assert.rejects(confirm_purchase_order(company, access), /payment terms/);
    assert.equal(updated, false);
  } finally {
    state.fuelDatabase = previous;
  }
});

test("purchase order endpoints are documented", () => {
  assert.ok(openapi.paths["/api/purchase-orders"]);
  assert.ok(openapi.paths["/api/purchase-orders/confirm"]);
  assert.ok(openapi.components.schemas.CreatePurchaseOrder);
});

test("a receipt is partial until every ordered quantity is covered", () => {
  const ordered = new Prisma.Decimal("100");
  const partial = receipt_status([
    { ordered_qty: ordered, received_qty: new Prisma.Decimal("80") },
  ]);
  const complete = receipt_status([
    { ordered_qty: ordered, received_qty: ordered },
  ]);
  assert.equal(partial, "partially_received");
  assert.equal(complete, "received");
});

test("a posted receipt number counts per company", () => {
  assert.equal(company_code("Warehouse"), "WAR");
  assert.equal(company_code("AB"), "ABX");
  assert.equal(
    receiving_number("Warehouse", new Date("2026-10-16T16:00:00.000Z"), 1),
    "RR-WAR-202610-0000001",
  );
  assert.equal(
    receiving_number("Warehouse", new Date("2026-11-02T00:00:00.000Z"), 2),
    "RR-WAR-202611-0000002",
  );
});

test("receiving endpoints are documented", () => {
  assert.ok(openapi.paths["/api/receiving"]);
  assert.ok(openapi.paths["/api/receiving/post"]);
  assert.ok(openapi.components.schemas.CreateReceiving);
});
