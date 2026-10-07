import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_CATALOG, PAGE_KEYS } from "../src/lib/auth/catalog";
import { listSidebarMenu } from "../src/app/layout/sideBarMenuItems";

test("super_admin can see every registered dashboard page without explicit grants", () => {
  const items = listSidebarMenu([], { role: "super_admin", pages: [], permissions: [] });
  assert.deepEqual(items.map((item) => item.href), PAGE_CATALOG.map((page) => page.href));
});
test("ordinary navigation still requires page and permission grants", () => {
  assert.deepEqual(listSidebarMenu([PAGE_KEYS.home], { role: "staff" }).map((item) => item.href), ["/dashboard"]);
  assert.equal(listSidebarMenu([PAGE_KEYS.users], { role: "staff" }).length, 0);
  assert.deepEqual(listSidebarMenu([PAGE_KEYS.users], { role: "staff", permissions: ["users.view"] }).map((item) => item.href), ["/users"]);
});
