/** Business reasons contain no HTTP status. Controllers decide the response. */
export type ApplicationErrorCode =
  | "invalid_input"
  | "invalid_session"
  | "invalid_credentials"
  | "account_not_provisioned"
  | "super_admin_required"
  | "logout_failed"
  | "company_required"
  | "assignments_unavailable"
  | "email_exists"
  | "invalid_account_details"
  | "auth_creation_failed"
  | "google_start_failed"
  | "google_exchange_failed"
  | "role_not_found"
  | "system_role"
  | "company_default_required"
  | "role_changed"
  | "role_assigned"
  | "company_not_found"
  | "company_has_members";

export class ApplicationError extends Error {
  constructor(public code: ApplicationErrorCode, message: string) { super(message); }
}
export class UserError extends ApplicationError {}
export class RoleError extends ApplicationError {}
export class CompanyError extends ApplicationError {}

// Drizzle wraps node-postgres errors in a query error; expose only its code to callers.
export function getDatabaseErrorCode(error: unknown): string {
  const visited = new Set<unknown>();
  while (error && typeof error === "object" && !visited.has(error)) {
    visited.add(error);
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : undefined;
  }
  return "";
}
