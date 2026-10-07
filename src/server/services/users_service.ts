import type { CreateUserInput } from "@/lib/users";
import type { UserFilters, UserFilterOptions } from "@/lib/users-filters";
import { USER_FILTER_FIELDS, USER_STATUS_OPTIONS, USER_ADDITIONAL_FILTERS } from "@/lib/users-filters";
import { createAdminClient } from "@/server/auth/admin";
import { usersRepository } from "@/server/repositories/users_repository";
import type { Pagination } from "@/server/utils/pagination";
import { UserError } from "@/server/utils/errors";
import { buildUserFilter } from "@/server/utils/user_filter";

export function createUserService(repository = usersRepository, admin = () => createAdminClient().auth.admin) {
  return {
    listUser(pagination: Pagination, search: string, filters?: UserFilters) {
      const searchWhere = search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {};
      return repository.listUser(pagination, { AND: [searchWhere, buildUserFilter(filters)] });
    },
    getUserOption() { return repository.getUserOption(); },
    async getUserFilterOption(): Promise<UserFilterOptions> {
      const { names, emails, companies, roles, total, assigned, members } = await repository.getUserFilterData();
      const values = {
        name: names.map(row => ({ value: row.name, label: row.name, count: row._count._all })),
        email: emails.flatMap(row => row.email === null ? [] : [{ value: row.email, label: row.email, count: row._count._all }]),
        company: companies.map(row => ({ value: row.id, label: row.name, count: row._count.user_companies })),
        role: roles.map(row => ({ value: row.id, label: `${row.name} (${row.scope})` })),
      };
      return {
        fields: USER_FILTER_FIELDS.map(field => ({ ...field, options: values[field.key as keyof typeof values] })),
        statusOptions: USER_STATUS_OPTIONS.map(option => ({ ...option, count: option.value === "all" ? total : option.value === "assigned" ? assigned : total - assigned })),
        additionalFilters: USER_ADDITIONAL_FILTERS.map(filter => ({ ...filter, options: filter.options.map(option => ({ ...option, count: option.value === "all" ? total : option.value === "assigned" ? members : total - members })) })),
      };
    },
    async createUser(input: CreateUserInput) {
      const roleIds = input.role_ids ?? [];
      if (roleIds.length && input.company_id === undefined) throw new UserError(400, "Select a company when assigning company roles.");
      const assignments = await repository.getUserAssignment(input);
      if (assignments.existingUser) throw new UserError(409, "An account with that email already exists.");
      if (input.company_id !== undefined && (!assignments.company || assignments.roleCount !== roleIds.length)) throw new UserError(400, "Company or company roles are no longer available.");
      const client = admin();
      const { data, error } = await client.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.name } });
      if (error) {
        if (["email_exists", "user_already_exists"].includes(error.code ?? "")) throw new UserError(409, "An account with that email already exists.");
        if (["weak_password", "validation_failed"].includes(error.code ?? "")) throw new UserError(400, "The account details do not meet the authentication requirements.");
        throw new UserError(502, "Unable to create the authentication account.");
      }
      if (!data.user) throw new UserError(502, "Unable to create the authentication account.");
      try { return await repository.createUser(data.user.id, input); }
      catch (error) {
        try { const cleanup = await client.deleteUser(data.user.id); if (cleanup.error) console.error("User creation cleanup failed", { user_id: data.user.id }); }
        catch { console.error("User creation cleanup failed", { user_id: data.user.id }); }
        // Controllers translate persistence errors after the service finishes compensation.
        throw error;
      }
    },
  };
}
export const userService = createUserService();
