import type { Response } from "express";
import type { CreateRoleInput, UpdateRoleInput, RoleScope } from "@/server/schema/roles_schema";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { PaginationError } from "@/server/utils/pagination";
import { RoleError, getDatabaseErrorCode, type ApplicationErrorCode } from "@/server/utils/errors";

export function validate_role_id(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new RoleError("invalid_input", "Provide a valid role ID.");
  return value.toLowerCase();
}
export function validate_role_scope(value: unknown): RoleScope {
  if (value !== "company" && value !== "global")
    throw new RoleError("invalid_input", "Role scope must be company or global.");
  return value;
}
function validate_role_body(
  value: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RoleError("invalid_input", "Provide role details.");
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new RoleError("invalid_input", "Unknown or read-only role field.");
  return value as Record<string, unknown>;
}
function validate_role_name(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new RoleError("invalid_input",
      "Provide a role name between 1 and 100 characters.",
    );
  return value.trim();
}
function validate_default_role(value: unknown) {
  if (typeof value !== "boolean")
    throw new RoleError("invalid_input", "is_default_role must be a boolean.");
  return value;
}
function validate_role_keys(value: unknown, allowed: string[], label: string) {
  if (
    !Array.isArray(value) ||
    value.length > 200 ||
    value.some((key) => typeof key !== "string" || !allowed.includes(key)) ||
    new Set(value).size !== value.length
  )
    throw new RoleError("invalid_input",
      `Provide distinct, registered ${label} keys (maximum 200).`,
    );
  return value as string[];
}
function validate_role_page(value: unknown) {
  return validate_role_keys(
    value,
    PAGE_CATALOG.map((page) => page.key),
    "page",
  );
}
function validate_role_permission(value: unknown) {
  return validate_role_keys(
    value,
    PERMISSION_CATALOG.map((permission) => permission.key),
    "permission",
  );
}

export function validate_create_role(value: unknown): Required<CreateRoleInput> {
  const body = validate_role_body(value, [
    "name",
    "slug",
    "scope",
    "is_default_role",
    "pages",
    "permissions",
  ]);
  const roleName = validate_role_name(body.name);
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
    throw new RoleError("invalid_input",
      "Provide a slug of at most 100 characters using lowercase letters, numbers, underscores or hyphens, starting with a letter.",
    );
  const scope =
    body.scope === undefined ? "company" : validate_role_scope(body.scope);
  const isDefault =
    body.is_default_role === undefined
      ? false
      : validate_default_role(body.is_default_role);
  return {
    name: roleName,
    slug,
    scope,
    is_default_role: isDefault,
    pages: body.pages === undefined ? [] : validate_role_page(body.pages),
    permissions:
      body.permissions === undefined
        ? []
        : validate_role_permission(body.permissions),
  };
}
export function validate_update_role(value: unknown): UpdateRoleInput {
  const body = validate_role_body(value, [
    "id",
    "name",
    "is_default_role",
    "pages",
    "permissions",
  ]);
  if (!Object.keys(body).some((key) => key !== "id"))
    throw new RoleError("invalid_input", "Provide at least one editable role field.");
  return {
    id: validate_role_id(body.id),
    ...(body.name !== undefined ? { name: validate_role_name(body.name) } : {}),
    ...(body.is_default_role !== undefined
      ? { is_default_role: validate_default_role(body.is_default_role) }
      : {}),
    ...(body.pages !== undefined
      ? { pages: validate_role_page(body.pages) }
      : {}),
    ...(body.permissions !== undefined
      ? { permissions: validate_role_permission(body.permissions) }
      : {}),
  };
}

const roleDatabaseErrors = {
  "23505": { status: 409, message: "The slug is already in use or a company role is already marked as default. Clear the existing default before choosing another." },
  "23503": { status: 409, message: "This role is assigned to users and cannot be deleted." },
  "23514": { status: 400, message: "Role details do not meet the database requirements." },
};
const roleErrorStatus: Partial<Record<ApplicationErrorCode, number>> = {
  invalid_input: 400, role_not_found: 404, system_role: 403,
  company_default_required: 400, role_changed: 409, role_assigned: 409,
};
export function respond_role_error(error: unknown, res: Response) {
  if (error instanceof PaginationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof RoleError && roleErrorStatus[error.code]) {
    res.status(roleErrorStatus[error.code]!).json({ error: error.message });
    return;
  }
  const code = getDatabaseErrorCode(error);
  const databaseError = Object.hasOwn(roleDatabaseErrors, code)
    ? roleDatabaseErrors[code as keyof typeof roleDatabaseErrors] : undefined;
  if (databaseError) {
    res.status(databaseError.status).json({ error: databaseError.message });
    return;
  }
  console.error("Roles request failed:", error);
  res.status(500).json({ error: "The request could not be completed." });
}
