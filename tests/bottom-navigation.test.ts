import assert from "node:assert/strict";
import { test } from "node:test";
import { listBottomNavigationMenu } from "@/app/layout/bottomNavigationMenu";

test("bottom navigation keeps dashboard first and stops at five pages", () => {
  const items = listBottomNavigationMenu([], { role: "super_admin" });
  assert.equal(items.length, 5);
  assert.equal(items[0]?.href, "/dashboard");
  assert.deepEqual(
    items.map((item) => item.href),
    ["/dashboard", "/users", "/roles", "/companies", "/measurements"],
  );
});

test("bottom navigation only includes pages the user can open", () => {
  const items = listBottomNavigationMenu(
    ["home", "purchaseOrders", "receiving"],
    {
      pages: ["home", "purchaseOrders", "receiving"],
      permissions: ["home.view", "purchaseOrders.view", "receiving.view"],
    },
  );
  assert.deepEqual(
    items.map((item) => item.href),
    ["/dashboard", "/purchase-orders", "/purchase-order-receiving"],
  );
});
