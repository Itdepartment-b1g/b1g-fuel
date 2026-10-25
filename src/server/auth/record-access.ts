import type { RequestHandler } from "express";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import {
  scopesWithin,
  type AccessScope,
  type AccessGrant,
  type RecordAccess,
} from "@/lib/auth/access-scope";
export type { RecordAccess } from "@/lib/auth/access-scope";

export type Resource =
  | "users"
  | "roles"
  | "companies"
  | "measurements"
  | "brandsAndVariants"
  | "suppliers"
  | "productTypes"
  | "products"
  | "purchaseOrders"
  | "receiving"
  | "hubs";

type ResourceWhere = {
  users: Prisma.userWhereInput;
  roles: Prisma.rolesWhereInput;
  companies: Prisma.companyWhereInput;
  measurements: Prisma.measurementWhereInput;
  brandsAndVariants: Prisma.brandWhereInput;
  suppliers: Prisma.supplierWhereInput;
  productTypes: Prisma.product_typeWhereInput;
  products: Prisma.productWhereInput;
  purchaseOrders: Prisma.purchase_orderWhereInput;
  receiving: Prisma.receivingWhereInput;
  hubs: Prisma.locationWhereInput;
}

const OWNED_RESOURCES = [
  "measurements",
  "brandsAndVariants",
  "suppliers",
  "productTypes",
  "products",
  "purchaseOrders",
  "receiving",
] as const;

// Catalogs that can be shared have a nullable company_id. Products and purchase orders cannot.
const SHARED_RESOURCES = [
  "measurements",
  "brandsAndVariants",
  "suppliers",
  "productTypes",
] as const;

type OwnedResource = typeof OWNED_RESOURCES[number];

function is_owned(resource: Resource): resource is OwnedResource {
  return (OWNED_RESOURCES as readonly Resource[]).includes(resource);
}

function is_shared(resource: Resource) {
  return (SHARED_RESOURCES as readonly Resource[]).includes(resource);
}

/** Pages from one company role. role_pages uses the role list. assigned_pages keeps the overlap with that membership. */
export function membership_page_keys(
  mode: "role_pages" | "assigned_pages",
  rolePages: string[],
  assignedPages: string[],
) {
  if (mode !== "assigned_pages") return rolePages;
  const assigned = new Set(assignedPages);
  return rolePages.filter((key) => assigned.has(key));
}

export async function get_record_access(
  userId: string,
  client: DatabaseExecutor = getDatabase(),
): Promise<RecordAccess> {
  const roleSelect = {
    slug: true,
    company_id: true,
    pages: { select: { page_key: true } },
    permissions: { select: { permission_key: true, access_scope: true } },
  } satisfies Prisma.rolesSelect;
  const profile = await client.user.findUnique({
    where: { id: userId },
    select: {
      user_roles: { select: { role: { select: roleSelect } } },
      user_companies: {
        select: {
          company_id: true,
          page_grant_mode: true,
          pages: { select: { page_key: true } },
          permissions: { select: { permission_key: true, access_scope: true } },
          roles: { select: { role: { select: roleSelect } } },
        },
      },
    },
  });
  const assignments = [
    ...(profile?.user_roles ?? []).map(({ role }) => ({
      role,
      companyId: null as string | null,
      pageKeys: role.pages.map((page) => page.page_key),
      permissionScopes: null as Map<string, string> | null,
    })),
    ...(profile?.user_companies ?? []).flatMap((membership) =>
      membership.roles.map(({ role }) => ({
        role,
        companyId: membership.company_id,
        pageKeys: membership_page_keys(
          membership.page_grant_mode,
          role.pages.map((page) => page.page_key),
          membership.pages.map((page) => page.page_key),
        ),
        permissionScopes: membership.page_grant_mode === "assigned_pages"
          ? new Map(membership.permissions.map((permission) => [permission.permission_key, permission.access_scope]))
          : null as Map<string, string> | null,
      })),
    ),
  ];
  const pages = new Set<string>();
  const grants: AccessGrant[] = [];
  for (const assignment of assignments) {
    const pageKeys = assignment.pageKeys;
    for (const pageKey of pageKeys) pages.add(pageKey);
    for (const permission of assignment.role.permissions) {
      if (!pageKeys.includes(permission.permission_key.split(".")[0])) continue;
      const chosen = assignment.permissionScopes
        ? assignment.permissionScopes.get(permission.permission_key)
        : permission.access_scope;
      if (assignment.permissionScopes && chosen === undefined) continue;
      const roleScope = permission.access_scope as AccessScope;
      const scope = chosen && scopesWithin(roleScope).includes(chosen as AccessScope) ? chosen as AccessScope : roleScope;
      grants.push({
        permission: permission.permission_key,
        scope,
        companyId: scope === "all" ? null : assignment.companyId,
      });
    }
  }
  return {
    userId,
    superAdmin: (profile?.user_roles ?? []).some(
      ({ role }) => role.slug === "super_admin",
    ),
    companyIds: (profile?.user_companies ?? []).map(
      (membership) => membership.company_id,
    ),
    pages: [...pages],
    grants,
  };
}

export function record_where<R extends Resource>(
  access: RecordAccess | undefined,
  resource: R,
  action?: string,
): ResourceWhere[R];
export function record_where(
  access: RecordAccess | undefined,
  resource: Resource,
  action = "view",
): Record<string, unknown> {
  if (!access || access.superAdmin) return {};
  const grants = access.grants.filter(
    (grant) => grant.permission === `${resource}.${action}`,
  );
  // Keep a concrete deny predicate when combined with hub ID/type conditions.
  if (resource === "hubs" && grants.length === 0) return { id: { in: [] } };
  const owned = is_owned(resource);
  if (grants.some((grant) => grant.scope === "all" && !grant.companyId)) {
    if (is_shared(resource) && (action === "edit" || action === "delete"))
      return { company_id: { not: null } };
    return {};
  }
  const rules = grants.map((grant) => {
    // A hub's creator is audit only. Own access follows current staff assignments.
    if (resource === "hubs" && grant.scope === "own") return {
      company_id: { in: grant.companyId ? [grant.companyId] : access.companyIds },
      users: { some: { membership: { user_id: access.userId } } },
    };
    if (grant.scope === "own") return { created_by: access.userId };
    const ids = grant.companyId ? [grant.companyId] : access.companyIds;
    if (resource === "companies") return { id: { in: ids } };
    if (resource === "roles" || resource === "hubs" || owned) return { company_id: { in: ids } };
    return { user_companies: { some: { company_id: { in: ids } } } };
  });
  if (is_shared(resource) && action === "view")
    return { OR: [...rules, { company_id: null }] };
  return { OR: rules };
}

export function allowed_company_ids(
  access: RecordAccess | undefined,
  resource: Resource,
  action = "add",
): string[] | undefined {
  if (!access || access.superAdmin) return undefined;
  return [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === `${resource}.${action}`)
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
}

export const loadRecordAccess: RequestHandler = async (_req, res, next) => {
  res.locals.access = await get_record_access(res.locals.user.id);
  next();
};

export function requirePermission(
  resource: Resource | "materialRequests" | "materialRequestReceiving",
  action: "view" | "add" | "edit" | "delete",
): RequestHandler {
  return (_req, res, next) => {
    const access = res.locals.access as RecordAccess;
    if (
      !access.superAdmin &&
      !access.grants.some(
        (grant) => grant.permission === `${resource}.${action}`,
      )
    ) {
      res
        .status(403)
        .json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
