import type { RecordAccess } from "@/server/auth/record-access";
import { ACCESS_SCOPES, scopesWithin, type AccessScope } from "@/lib/auth/access-scope";
import { staff_role_slug_candidates } from "@/lib/auth/role-slug";
import type { Sorting } from "@/server/lib/sorting";
import type { CreateUserInput } from "@/server/schema/users_schema";
import type { UserFilters, UserFilterOptions } from "@/types/users-filters";
import {
  USER_FILTER_FIELDS,
  USER_STATUS_OPTIONS,
  USER_ADDITIONAL_FILTERS,
} from "@/utils/users-filters";
import { createAdminClient } from "@/server/auth/admin";
import * as usersRepository from "@/server/repositories/users_repository";
import type { Pagination } from "@/server/lib/pagination";

export async function list_user(
  pagination: Pagination,
  search: string,
  filters?: UserFilters,
  sorting?: Sorting,
  repository = usersRepository,
  access?: RecordAccess,
) {
  return repository.list_user(pagination, search, filters, sorting, access);
}

export async function get_user_option(repository = usersRepository, access?: RecordAccess) {
  return repository.get_user_option(access);
}

export async function get_user_filter_option(
  repository = usersRepository,
  access?: RecordAccess,
): Promise<UserFilterOptions> {
  const { names, emails, companies, roles, total, assigned, members } =
    await repository.get_user_filter_data(access);
  const values = {
    name: names.map((row) => ({
      value: row.name,
      label: row.name,
      count: row.count,
    })),
    email: emails.flatMap((row) =>
      row.email === null
        ? []
        : [{ value: row.email, label: row.email, count: row.count }],
    ),
    company: companies.map((row) => ({
      value: row.id,
      label: row.name,
      count: row.count,
    })),
    role: roles.map((row) => ({
      value: row.id,
      label: `${row.name} (${row.scope})`,
    })),
  };
  return {
    fields: USER_FILTER_FIELDS.map((field) => ({
      ...field,
      options: values[field.key as keyof typeof values],
    })),
    statusOptions: USER_STATUS_OPTIONS.map((option) => ({
      ...option,
      count:
        option.value === "all"
          ? total
          : option.value === "assigned"
            ? assigned
            : total - assigned,
    })),
    additionalFilters: USER_ADDITIONAL_FILTERS.map((filter) => ({
      ...filter,
      options: filter.options.map((option) => ({
        ...option,
        count:
          option.value === "all"
            ? total
            : option.value === "assigned"
              ? members
              : total - members,
      })),
    })),
  };
}

const PAGE_KEY = /^[A-Za-z][A-Za-z0-9]{0,119}$/;

/** Dashboards a supervisor may check: on the staff role, already on the supervisor, and not Users. */
export function allowed_staff_pages(actorPages: string[], rolePageKeys: string[], pageKeys: string[]) {
  const ceiling = new Set(rolePageKeys.filter((key) => key !== "users" && actorPages.includes(key)));
  if (pageKeys.some((key) => !ceiling.has(key)))
    throw new UserError("invalid_input", "Select dashboards from the staff role that you already have.");
}

/** Keep the actions a supervisor checked, and reject anything broader than their own grant. */
export function selected_staff_permissions(
  actorPages: string[],
  grants: { permission: string; scope: string; companyId?: string | null }[],
  companyId: string,
  pageKeys: string[],
  permissions: string[],
  scopes: Record<string, string | undefined>,
) {
  const ceiling = new Set(actorPages.filter((key) => key !== "users"));
  if (pageKeys.some((key) => !ceiling.has(key)))
    throw new UserError("invalid_input", "Select dashboards you already have.");
  const actor = new Map<string, string>();
  for (const grant of grants.filter((item) => !item.companyId || item.companyId === companyId)) {
    const page = grant.permission.split(".")[0];
    if (!ceiling.has(page) || actor.has(grant.permission)) continue;
    actor.set(grant.permission, grant.scope);
  }
  const rows = permissions.map((key) => {
    const page = key.split(".")[0];
    const action = key.split(".")[1];
    if (!pageKeys.includes(page))
      throw new UserError("invalid_input", "Choose permissions for a selected dashboard.");
    const actorScope = actor.get(key);
    if (!actorScope || !ACCESS_SCOPES.includes(actorScope as AccessScope))
      throw new UserError("invalid_input", "Choose permissions you already have.");
    const scope = action === "add" ? actorScope : scopes[key] ?? (actorScope === "all" ? "company" : actorScope);
    if (action !== "add" && scope === "all")
      throw new UserError("invalid_input", "Choose My company or Only me.");
    if (!ACCESS_SCOPES.includes(scope as AccessScope))
      throw new UserError("invalid_input", "Choose My company or Only me.");
    if (!scopesWithin(actorScope as AccessScope).includes(scope as AccessScope))
      throw new UserError("invalid_input", "Choose a permission no broader than your own.");
    return { permission_key: key, access_scope: scope };
  });
  return { pages: pageKeys, permissions: rows };
}

const PERMISSION_KEY = /^[A-Za-z][A-Za-z0-9]*\.(view|edit|add|delete)$/;

export function parse_staff_permissions(permissions: unknown, scopes: unknown) {
  if (
    !Array.isArray(permissions) ||
    permissions.length > 200 ||
    permissions.some((key) => typeof key !== "string" || !PERMISSION_KEY.test(key) || key.startsWith("users.")) ||
    new Set(permissions).size !== permissions.length
  )
    throw new UserError("invalid_input", "Choose the actions for this staff member.");
  if (scopes !== undefined && (!scopes || typeof scopes !== "object" || Array.isArray(scopes)))
    throw new UserError("invalid_input", "Choose All, My company, or Only me.");
  const scopeMap = (scopes ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(scopeMap)) {
    if (!permissions.includes(key) || (value !== "all" && value !== "company" && value !== "own"))
      throw new UserError("invalid_input", "Choose All, My company, or Only me.");
  }
  return {
    permissions: permissions as string[],
    permission_scopes: scopeMap as Partial<Record<string, AccessScope>>,
  };
}

export function parse_page_keys(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((key) => typeof key !== "string" || !PAGE_KEY.test(key)) ||
    new Set(value).size !== value.length
  )
    throw new UserError("invalid_input", "Select the dashboards for this staff member.");
  if (value.includes("users"))
    throw new UserError("invalid_input", "The Users page stays with the supervisor.");
  return value as string[];
}

export async function create_user(
  input: CreateUserInput,
  repository = usersRepository,
  admin = () => createAdminClient().auth.admin,
  createdBy?: string,
  actorPages: string[] = [],
  actorGrants: { permission: string; scope: string; companyId?: string | null }[] = [],
) {
  if (input.role_id) {
    if (!input.company_id)
      throw new UserError("company_required", "Select a company when assigning company roles.");
    const preview = await repository.assignable_user({ ...input, role_ids: [] });
    if (preview.existingUser)
      throw new UserError("email_exists", "An account with that email already exists.");
    if (!preview.company)
      throw new UserError("assignments_unavailable", "Company or company roles are no longer available.");
    const companyId = input.company_id;
    const roleId = input.role_id;
    const available = await repository.available_assignment(companyId, [roleId]);
    if (available.roleCount !== 1 || available.companyIds.some((id) => id !== companyId))
      throw new UserError("assignments_unavailable", "Select a role from this company.");
    if (available.pageKeys.includes("users"))
      throw new UserError("invalid_input", "The Users page stays with the supervisor.");
    const grant = selected_staff_permissions(
      actorPages,
      actorGrants,
      companyId,
      input.page_keys ?? [],
      input.permissions ?? [],
      input.permission_scopes ?? {},
    );
    if (grant.permissions.some((permission) => !available.permissionKeys.includes(permission.permission_key)))
      throw new UserError("invalid_input", "Choose an action this role already has.");
    input = { ...input, role_ids: [roleId], role_id: undefined, permission_rows: grant.permissions };
  }
  if (input.role_name) {
    if (!input.company_id)
      throw new UserError("company_required", "Select a company when assigning company roles.");
    const slugs = staff_role_slug_candidates(input.role_name, input.company_id);
    if (!slugs)
      throw new UserError("invalid_input", "Enter a role name using letters or numbers.");
    const preview = await repository.assignable_user({ ...input, role_ids: [] });
    if (preview.existingUser)
      throw new UserError("email_exists", "An account with that email already exists.");
    if (!preview.company)
      throw new UserError("assignments_unavailable", "Company or company roles are no longer available.");
    const companyId = input.company_id;
    const roleName = input.role_name;
    const grant = selected_staff_permissions(
      actorPages,
      actorGrants,
      companyId,
      input.page_keys ?? [],
      input.permissions ?? [],
      input.permission_scopes ?? {},
    );
    input = { ...input, permission_rows: grant.permissions };
    const role = await repository.ensure_staff_role({
      companyId,
      name: roleName,
      slugs,
      pages: grant.pages,
      permissions: grant.permissions,
      createdBy,
    });
    if (!role)
      throw new UserError("assignments_unavailable", "That role name is already in use. Try another name.");
    input = { ...input, role_ids: [role.id], role_name: undefined };
    if (input.page_keys)
      allowed_staff_pages(actorPages, role.pages, input.page_keys);
  }
  const roleIds = input.role_ids ?? [];
  if (roleIds.length && input.company_id === undefined)
    throw new UserError(
      "company_required",
      "Select a company when assigning company roles.",
    );
  const assignments = await repository.assignable_user(input);
  if (assignments.existingUser)
    throw new UserError(
      "email_exists",
      "An account with that email already exists.",
    );
  if (
    input.company_id !== undefined &&
    (!assignments.company || assignments.roleCount !== roleIds.length)
  )
    throw new UserError(
      "assignments_unavailable",
      "Company or company roles are no longer available.",
    );
  if (input.page_keys)
    allowed_staff_pages(actorPages, assignments.pageKeys, input.page_keys);
  const client = admin();
  const { data, error } = await client.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.name },
  });
  if (error) {
    if (["email_exists", "user_already_exists"].includes(error.code ?? ""))
      throw new UserError(
        "email_exists",
        "An account with that email already exists.",
      );
    if (["weak_password", "validation_failed"].includes(error.code ?? ""))
      throw new UserError(
        "invalid_account_details",
        "The account details do not meet the authentication requirements.",
      );
    throw new UserError(
      "auth_creation_failed",
      "Unable to create the authentication account.",
    );
  }
  if (!data.user)
    throw new UserError(
      "auth_creation_failed",
      "Unable to create the authentication account.",
    );
  try {
    return await repository.create_user(data.user.id, input, createdBy);
  } catch (error) {
    try {
      const cleanup = await client.deleteUser(data.user.id);
      if (cleanup.error)
        console.error("User creation cleanup failed", {
          user_id: data.user.id,
        });
    } catch {
      console.error("User creation cleanup failed", {
        user_id: data.user.id,
      });
    }
    // Controllers translate persistence errors after the service finishes compensation.
    throw error;
  }
}

/** Attach a user to a company and replace that membership's company roles. Shared role templates apply to any company. */
export async function assign_user(
  userId: string,
  companyId: string,
  roleIds: string[],
  grant: {
    mode: "role_pages" | "assigned_pages";
    pageKeys: string[];
    permissions?: { permission_key: string; access_scope: string }[];
  } = {
    mode: "role_pages",
    pageKeys: [],
  },
  actorPages: string[] = [],
  actorGrants: { permission: string; scope: string; companyId?: string | null }[] = [],
  repository = usersRepository,
) {
  if (!roleIds.length)
    throw new UserError("company_required", "Select a company and at least one role.");
  const available = await repository.available_assignment(companyId, roleIds);
  if (!available.company || available.roleCount !== roleIds.length)
    throw new UserError("assignments_unavailable", "Company or company roles are no longer available.");
  if (grant.mode === "assigned_pages") {
    if (available.companyIds.some((id) => id !== companyId))
      throw new UserError("assignments_unavailable", "Select a role from your company.");
    allowed_staff_pages(actorPages, available.pageKeys, grant.pageKeys);
    const selected = selected_staff_permissions(
      actorPages,
      actorGrants,
      companyId,
      grant.pageKeys,
      (grant.permissions ?? []).map((item) => item.permission_key),
      Object.fromEntries((grant.permissions ?? []).map((item) => [item.permission_key, item.access_scope])),
    );
    if (selected.permissions.some((row) => !available.permissionKeys.includes(row.permission_key)))
      throw new UserError("invalid_input", "Choose permissions on the selected role.");
    grant = { ...grant, permissions: selected.permissions };
  }
  const user = await repository.assign_user(userId, companyId, roleIds, grant);
  if (!user) throw new UserError("user_not_found", "User not found.");
  return user;
}

export type UserErrorCode = "invalid_input" | "invalid_session" | "invalid_credentials" | "account_not_provisioned" | "super_admin_required" | "logout_failed" | "company_required" | "assignments_unavailable" | "email_exists" | "invalid_account_details" | "auth_creation_failed" | "google_start_failed" | "google_exchange_failed" | "user_not_found";

export class UserError extends Error {
  constructor(public code: UserErrorCode, message: string) { super(message); }
}
