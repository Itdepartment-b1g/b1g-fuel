import type { CreateRoleInput, UpdateRoleInput, RoleScope } from "@/lib/roles";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { rateLimit } from "express-rate-limit";
import { roleService } from "@/server/services/roles_service";
import { parsePagination } from "@/server/utils/pagination";
import { RoleError } from "@/server/utils/errors";
import { handleController } from "./error_handler";

export const roleMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many role changes. Try again later." });
  },
});
const roleDatabaseErrors = {
  P2002: {
    status: 409,
    message:
      "The slug is already in use or a company role is already marked as default. Clear the existing default before choosing another.",
  },
  P2003: {
    status: 409,
    message: "This role is assigned to users and cannot be deleted.",
  },
  P2025: { status: 404, message: "Role not found." },
};
export const listRole = handleController(async (req, res) => {
  const pagination = parsePagination(req.query);
  const search = req.query.search ?? "";
  if (typeof search !== "string" || search.length > 100)
    throw new RoleError(400, "Search must contain at most 100 characters.");
  const scope =
    req.query.scope === undefined
      ? undefined
      : validateRoleScope(req.query.scope);
  res.json(await roleService.listRole(pagination, search.trim(), scope));
});
export const editRole = handleController(async (req, res) => {
  res.json({ role: await roleService.editRole(validateRoleId(req.query.id)) });
});
export const getRoleOption = handleController(async (_req, res) => {
  res.json(roleService.getRoleOption());
});
export const createRole = handleController(async (req, res) => {
  res
    .status(201)
    .json({ role: await roleService.createRole(validateCreateRole(req.body)) });
}, roleDatabaseErrors);
export const updateRole = handleController(async (req, res) => {
  res.json({
    role: await roleService.updateRole(validateUpdateRole(req.body)),
  });
}, roleDatabaseErrors);
export const deleteRole = handleController(async (req, res) => {
  res.json(await roleService.deleteRole(validateRoleId(req.query.id)));
}, roleDatabaseErrors);

export function validateRoleId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new RoleError(400, "Provide a valid role ID.");
  return value.toLowerCase();
}
export function validateRoleScope(value: unknown): RoleScope {
  if (value !== "company" && value !== "global")
    throw new RoleError(400, "Role scope must be company or global.");
  return value;
}
function validateRoleBody(
  value: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RoleError(400, "Provide role details.");
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new RoleError(400, "Unknown or read-only role field.");
  return value as Record<string, unknown>;
}
function validateRoleName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new RoleError(
      400,
      "Provide a role name between 1 and 100 characters.",
    );
  return value.trim();
}
function validateDefaultRole(value: unknown) {
  if (typeof value !== "boolean")
    throw new RoleError(400, "is_default_role must be a boolean.");
  return value;
}
function validateRoleKeys(value: unknown, allowed: string[], label: string) {
  if (
    !Array.isArray(value) ||
    value.length > 200 ||
    value.some((key) => typeof key !== "string" || !allowed.includes(key)) ||
    new Set(value).size !== value.length
  )
    throw new RoleError(
      400,
      `Provide distinct, registered ${label} keys (maximum 200).`,
    );
  return value as string[];
}
function validateRolePage(value: unknown) {
  return validateRoleKeys(
    value,
    PAGE_CATALOG.map((page) => page.key),
    "page",
  );
}
function validateRolePermission(value: unknown) {
  return validateRoleKeys(
    value,
    PERMISSION_CATALOG.map((permission) => permission.key),
    "permission",
  );
}

export function validateCreateRole(value: unknown): Required<CreateRoleInput> {
  const body = validateRoleBody(value, [
    "name",
    "slug",
    "scope",
    "is_default_role",
    "pages",
    "permissions",
  ]);
  const roleName = validateRoleName(body.name);
  const derived = roleName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const slug =
    body.slug === undefined
      ? derived
      : typeof body.slug === "string"
        ? body.slug.trim().toLowerCase()
        : "";
  if (
    !slug ||
    slug.length > 100 ||
    !/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(slug)
  )
    throw new RoleError(
      400,
      "Provide a slug of at most 100 characters using lowercase letters, numbers, underscores or hyphens, starting with a letter.",
    );
  const scope =
    body.scope === undefined ? "company" : validateRoleScope(body.scope);
  const isDefault =
    body.is_default_role === undefined
      ? false
      : validateDefaultRole(body.is_default_role);
  return {
    name: roleName,
    slug,
    scope,
    is_default_role: isDefault,
    pages: body.pages === undefined ? [] : validateRolePage(body.pages),
    permissions:
      body.permissions === undefined
        ? []
        : validateRolePermission(body.permissions),
  };
}
export function validateUpdateRole(value: unknown): UpdateRoleInput {
  const body = validateRoleBody(value, [
    "id",
    "name",
    "is_default_role",
    "pages",
    "permissions",
  ]);
  if (!Object.keys(body).some((key) => key !== "id"))
    throw new RoleError(400, "Provide at least one editable role field.");
  return {
    id: validateRoleId(body.id),
    ...(body.name !== undefined ? { name: validateRoleName(body.name) } : {}),
    ...(body.is_default_role !== undefined
      ? { is_default_role: validateDefaultRole(body.is_default_role) }
      : {}),
    ...(body.pages !== undefined
      ? { pages: validateRolePage(body.pages) }
      : {}),
    ...(body.permissions !== undefined
      ? { permissions: validateRolePermission(body.permissions) }
      : {}),
  };
}
