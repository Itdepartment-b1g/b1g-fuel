export const ACCESS_SCOPES = ["all", "company", "own"] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];
export const STAFF_ACCESS_SCOPES = ["company", "own"] as const;
export const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
  all: "All",
  company: "My company",
  own: "Only me",
};
const SCOPE_RANK: Record<AccessScope, number> = { own: 0, company: 1, all: 2 };

/** Scopes no broader than the one the current user already has. */
export function scopesWithin(scope: AccessScope) {
  return ACCESS_SCOPES.filter((item) => SCOPE_RANK[item] <= SCOPE_RANK[scope]);
}
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
  resource:
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
    | "hubs",
  action: string,
  record?: {
    id: string;
    created_by: string | null;
    company_id?: string | null;
    companies?: { id: string }[];
    assigned_user_ids?: string[];
  },
) {
  if (!access) return false;
  if (access.superAdmin) return true;
  if (
    (resource === "measurements" ||
      resource === "brandsAndVariants" ||
      resource === "suppliers" ||
      resource === "productTypes") &&
    record?.company_id === null &&
    (action === "edit" || action === "delete")
  )
    return false;
  if (resource === "roles" && action !== "view") return false;
  return access.grants.some((grant) => {
    if (grant.permission !== `${resource}.${action}`) return false;
    if (!record || action === "add") return true;
    if (grant.scope === "all" && !grant.companyId) return true;
    if (resource === "hubs" && grant.scope === "own") {
      const ids = grant.companyId ? [grant.companyId] : access.companyIds;
      return Boolean(record.company_id && ids.includes(record.company_id) && record.assigned_user_ids?.includes(access.userId));
    }
    if (grant.scope === "own") return record.created_by === access.userId;
    const companyIds = grant.companyId ? [grant.companyId] : access.companyIds;
    return resource === "companies"
      ? companyIds.includes(record.id)
      : resource === "roles" ||
          resource === "measurements" ||
          resource === "brandsAndVariants" ||
          resource === "suppliers" ||
          resource === "productTypes" ||
          resource === "products" ||
          resource === "purchaseOrders" ||
          resource === "receiving" ||
          resource === "hubs"
        ? Boolean(record.company_id && companyIds.includes(record.company_id))
        : Boolean(
            record.companies?.some((company) =>
              companyIds.includes(company.id),
            ),
          );
  });
}
