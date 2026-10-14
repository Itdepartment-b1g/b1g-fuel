export const ACCESS_SCOPES = ["all", "company", "own"] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];
export const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
  all: "All",
  company: "My company",
  own: "Only me",
};
export type AccessGrant = {
  permission: string;
  scope: AccessScope;
  companyId: string | null;
};
export type RecordAccess = {
  userId: string;
  superAdmin: boolean;
  companyIds: string[];
  pages: string[];
  grants: AccessGrant[];
};

export function canPerform(
  access: RecordAccess | null,
  resource: "users" | "roles" | "companies" | "measurements",
  action: string,
  record?: {
    id: string;
    created_by: string | null;
    company_id?: string | null;
    companies?: { id: string }[];
  },
) {
  if (!access) return false;
  if (access.superAdmin) return true;
  if (resource === "roles" && action !== "view") return false;
  return access.grants.some((grant) => {
    if (grant.permission !== `${resource}.${action}`) return false;
    if (!record || action === "add") return true;
    if (grant.scope === "all" && !grant.companyId) return true;
    if (grant.scope === "own") return record.created_by === access.userId;
    const companyIds = grant.companyId ? [grant.companyId] : access.companyIds;
    return resource === "companies"
      ? companyIds.includes(record.id)
      : resource === "roles" || resource === "measurements"
        ? Boolean(record.company_id && companyIds.includes(record.company_id))
        : Boolean(
            record.companies?.some((company) =>
              companyIds.includes(company.id),
            ),
          );
  });
}
