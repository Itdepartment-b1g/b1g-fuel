import type { RequestHandler } from "express";
import type { Prisma } from "@/generated/prisma/client";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import type { AccessScope, AccessGrant, RecordAccess } from "@/lib/auth/access-scope";
export type { RecordAccess } from "@/lib/auth/access-scope";

export type Resource = "users" | "roles" | "companies" | "measurements";

export async function get_record_access(userId: string, client: DatabaseExecutor = getDatabase()): Promise<RecordAccess> {
  const roleSelect = { slug: true, company_id: true, pages: { select: { page_key: true } }, permissions: { select: { permission_key: true, access_scope: true } } } satisfies Prisma.rolesSelect;
  const profile = await client.user.findUnique({
    where: { id: userId },
    select: {
      user_roles: { select: { role: { select: roleSelect } } },
      user_companies: { select: { company_id: true, roles: { select: { role: { select: roleSelect } } } } },
    },
  });
  const assignments = [
    ...(profile?.user_roles ?? []).map(({ role }) => ({ role, companyId: null as string | null })),
    ...(profile?.user_companies ?? []).flatMap((membership) => membership.roles.map(({ role }) => ({ role, companyId: membership.company_id }))),
  ];
  const pages = new Set<string>();
  const grants: AccessGrant[] = [];
  for (const { role, companyId } of assignments) {
    for (const page of role.pages) pages.add(page.page_key);
    for (const permission of role.permissions) {
      if (!role.pages.some((page) => page.page_key === permission.permission_key.split(".")[0])) continue;
      grants.push({ permission: permission.permission_key, scope: permission.access_scope as AccessScope, companyId: permission.access_scope === "all" ? null : companyId });
    }
  }
  return { userId, superAdmin: (profile?.user_roles ?? []).some(({ role }) => role.slug === "super_admin"), companyIds: (profile?.user_companies ?? []).map((membership) => membership.company_id), pages: [...pages], grants };
}

export function record_where(access: RecordAccess | undefined, resource: "users", action?: string): Prisma.userWhereInput;
export function record_where(access: RecordAccess | undefined, resource: "roles", action?: string): Prisma.rolesWhereInput;
export function record_where(access: RecordAccess | undefined, resource: "companies", action?: string): Prisma.companyWhereInput;
export function record_where(access: RecordAccess | undefined, resource: "measurements", action?: string): Prisma.measurementWhereInput;
export function record_where(access: RecordAccess | undefined, resource: Resource, action = "view") {
  if (!access || access.superAdmin) return {};
  const grants = access.grants.filter((grant) => grant.permission === `${resource}.${action}`);
  if (grants.some((grant) => grant.scope === "all" && !grant.companyId)) return {};
  const rules = grants.map((grant) => {
    if (grant.scope === "own") return { created_by: access.userId };
    const ids = grant.companyId ? [grant.companyId] : access.companyIds;
    if (resource === "companies") return { id: { in: ids } };
    if (resource === "roles" || resource === "measurements") return { company_id: { in: ids } };
    return { user_companies: { some: { company_id: { in: ids } } } };
  });
  return { OR: rules };
}

export function allowed_company_ids(access: RecordAccess | undefined, resource: Resource, action = "add"): string[] | undefined {
  if (!access || access.superAdmin) return undefined;
  return [...new Set(access.grants.filter((grant) => grant.permission === `${resource}.${action}`).flatMap((grant) => grant.companyId ? [grant.companyId] : access.companyIds))];
}

export const loadRecordAccess: RequestHandler = async (_req, res, next) => {
  res.locals.access = await get_record_access(res.locals.user.id);
  next();
};

export function requirePermission(resource: Resource, action: "view" | "add" | "edit" | "delete"): RequestHandler {
  return (_req, res, next) => {
    const access = res.locals.access as RecordAccess;
    if (!access.superAdmin && !access.grants.some((grant) => grant.permission === `${resource}.${action}`)) {
      res.status(403).json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
