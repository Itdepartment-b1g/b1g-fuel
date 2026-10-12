import type { Sorting } from "@/server/lib/sorting";
import type { CreateUserInput } from "@/server/schema/users_schema";
import type { UserFilters, UserFilterOptions } from "@/lib/users-filters";
import {
  USER_FILTER_FIELDS,
  USER_STATUS_OPTIONS,
  USER_ADDITIONAL_FILTERS,
} from "@/lib/users-filters";
import { createAdminClient } from "@/server/auth/admin";
import * as usersRepository from "@/server/repositories/users_repository";
import type { Pagination } from "@/server/lib/pagination";

export async function list_user(
  pagination: Pagination,
  search: string,
  filters?: UserFilters,
  sorting?: Sorting,
  repository = usersRepository,
) {
  return repository.list_user(pagination, search, filters, sorting);
}

export async function get_user_option(repository = usersRepository) {
  return repository.get_user_option();
}

export async function get_user_filter_option(
  repository = usersRepository,
): Promise<UserFilterOptions> {
  const { names, emails, companies, roles, total, assigned, members } =
    await repository.get_user_filter_data();
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

export async function create_user(
  input: CreateUserInput,
  repository = usersRepository,
  admin = () => createAdminClient().auth.admin,
) {
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
    return await repository.create_user(data.user.id, input);
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

export type UserErrorCode = "invalid_input" | "invalid_session" | "invalid_credentials" | "account_not_provisioned" | "super_admin_required" | "logout_failed" | "company_required" | "assignments_unavailable" | "email_exists" | "invalid_account_details" | "auth_creation_failed" | "google_start_failed" | "google_exchange_failed";

export class UserError extends Error {
  constructor(public code: UserErrorCode, message: string) { super(message); }
}
