import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import { createQuickFilterState } from "../src/lib/quick-filter";
import { build_filter } from "../src/server/lib/filter";

test("shared filtering supports unrestricted lists and independent repository predicates", () => {
  assert.deepEqual(build_filter<Prisma.companyWhereInput>(undefined, {}), {});
  assert.deepEqual(build_filter<Prisma.rolesWhereInput>(undefined, {
    where: { scope: "company" },
    search: { value: "", fields: [(filter) => ({ name: filter })] },
  }), { AND: [{ scope: "company" }] });
});

test("shared filtering groups active values and combines dates, status and extra conditions", () => {
  const filters = createQuickFilterState({ status: "all", additional: { membership: "all" } });
  filters.conditions = [
    { id: "a", field: "name", value: " Juan " },
    { id: "b", field: "email", value: "juan@example.com" },
    { id: "c", field: "name", value: "Aaron" },
    { id: "d", field: "name", value: "Juan" },
    { id: "e", field: "name", value: " " },
  ];
  filters.date.preset = "today";
  filters.status = "assigned";
  filters.additional.membership = "unassigned";
  const has_role: Prisma.userWhereInput = { user_roles: { some: {} } };
  const no_membership: Prisma.userWhereInput = { user_companies: { none: {} } };
  const where = build_filter<Prisma.userWhereInput>(filters, {
    fields: {
      name: (values) => ({ name: { in: values } }),
      email: (values) => ({ email: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: { assigned: has_role },
    additional: { membership: { unassigned: no_membership } },
  }, new Date("2026-10-06T18:00:00Z"));
  assert.deepEqual(where, { AND: [
    { name: { in: ["Juan", "Aaron"] } },
    { email: { in: ["juan@example.com"] } },
    { created_at: { gte: new Date("2026-10-06T16:00:00Z"), lt: new Date("2026-10-07T16:00:00Z") } },
    has_role,
    no_membership,
  ] });
});

test("shared filtering ignores unconfigured choices and never invokes inherited handlers", () => {
  const filters = createQuickFilterState({ status: "all" });
  filters.conditions = [{ id: "a", field: "constructor", value: "x" }];
  filters.status = "toString";
  filters.additional.membership = "constructor";
  assert.deepEqual(build_filter<Prisma.userWhereInput>(filters, {
    fields: {}, status: {}, additional: { membership: {} },
  }), {});
});
