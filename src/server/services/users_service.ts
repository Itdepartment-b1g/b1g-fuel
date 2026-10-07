import type { CreateUserInput } from "@/lib/users";
import { createAdminClient } from "@/server/auth/admin";
import { usersRepository } from "@/server/repositories/users_repository";

export class UsersError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseCreateUser(body: unknown): CreateUserInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new UsersError(400, "Provide user details.");
  const { name, email, password, company_id, role_ids } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 250) throw new UsersError(400, "Provide a name between 1 and 250 characters.");
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new UsersError(400, "Provide a valid email.");
  if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new UsersError(400, "Provide a password between 8 and 128 characters.");
  if (company_id !== undefined && (typeof company_id !== "string" || !uuid.test(company_id))) throw new UsersError(400, "Select a valid company or omit company_id.");
  const roleIds = role_ids === undefined ? [] : role_ids;
  if (!Array.isArray(roleIds) || roleIds.length > 50 || roleIds.some((id) => typeof id !== "string" || !uuid.test(id)) || new Set(roleIds).size !== roleIds.length) throw new UsersError(400, "Provide distinct company roles (maximum 50) or omit role_ids.");
  if (roleIds.length && company_id === undefined) throw new UsersError(400, "Select a company when assigning company roles.");
  // Never accept global role assignments or caller-supplied account IDs.
  if (Object.keys(body).some((key) => !["name", "email", "password", "company_id", "role_ids"].includes(key))) throw new UsersError(400, "Unknown user field.");
  return { name: name.trim(), email: email.trim().toLowerCase(), password, company_id, role_ids: roleIds };
}

export function createUsersService(repository = usersRepository, admin = () => createAdminClient().auth.admin) {
  return {
    async create(input: CreateUserInput) {
      const assignments = await repository.validateAssignments(input);
      if (assignments.duplicate) throw new UsersError(409, "An account with that email already exists.");
      if (!assignments.valid) throw new UsersError(400, "Company or company roles are no longer available.");
      const client = admin();
      const { data, error } = await client.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: { full_name: input.name } });
      if (error) {
        if (["email_exists", "user_already_exists"].includes(error.code ?? "")) throw new UsersError(409, "An account with that email already exists.");
        if (["weak_password", "validation_failed"].includes(error.code ?? "")) throw new UsersError(400, "The account details do not meet the authentication requirements.");
        throw new UsersError(502, "Unable to create the authentication account.");
      }
      if (!data.user) throw new UsersError(502, "Unable to create the authentication account.");
      try { return await repository.create(data.user.id, input); }
      catch (failure) {
        try {
          const cleanup = await client.deleteUser(data.user.id);
          if (cleanup.error) console.error("User creation cleanup failed", { user_id: data.user.id });
        } catch { console.error("User creation cleanup failed", { user_id: data.user.id }); }
        const code = failure && typeof failure === "object" && "code" in failure ? failure.code : undefined;
        if (code === "P2002") throw new UsersError(409, "An account with that email already exists.");
        if (code === "P2003") throw new UsersError(400, "Company or company roles are no longer available.");
        throw new UsersError(500, "Unable to save the user. Please try again.");
      }
    },
  };
}
