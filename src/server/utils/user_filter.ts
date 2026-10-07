import type { Prisma } from "@/generated/prisma/client";
import {
  groupActiveConditions,
  resolveDateRange,
  type QuickFilterState,
} from "@/lib/quick-filter";
export function buildUserFilter(
  filters?: QuickFilterState,
  now = new Date(),
): Prisma.userWhereInput {
  if (!filters) return {};
  const clauses: Prisma.userWhereInput[] = [];
  for (const [field, values] of groupActiveConditions(filters.conditions)) {
    if (field === "name" || field === "email")
      clauses.push({ [field]: { in: values, mode: "insensitive" } });
    else if (field === "company")
      clauses.push({
        user_companies: { some: { company_id: { in: values } } },
      });
    else if (field === "role")
      clauses.push({
        OR: [
          { user_roles: { some: { role_id: { in: values } } } },
          {
            user_companies: {
              some: { roles: { some: { role_id: { in: values } } } },
            },
          },
        ],
      });
  }
  const range = resolveDateRange(filters.date, now);
  if (range.from || range.toExclusive)
    clauses.push({
      created_at: {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.toExclusive ? { lt: range.toExclusive } : {}),
      },
    });
  const assigned: Prisma.userWhereInput = {
    OR: [
      { user_roles: { some: {} } },
      { user_companies: { some: { roles: { some: {} } } } },
    ],
  };
  if (filters.status === "assigned") clauses.push(assigned);
  else if (filters.status === "unassigned") clauses.push({ NOT: assigned });
  if (filters.additional.membership === "assigned")
    clauses.push({ user_companies: { some: {} } });
  else if (filters.additional.membership === "unassigned")
    clauses.push({ user_companies: { none: {} } });
  return clauses.length ? { AND: clauses } : {};
}
