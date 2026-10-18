import { canPerform, type RecordAccess } from "@/lib/auth/access-scope";
import type { HubSummary } from "@/types/hubs";

export function canManageHubStaff(access: RecordAccess | null, hub: HubSummary) {
  return Boolean(access && canPerform({
    ...access, grants: access.grants.filter((grant) => grant.scope !== "own"),
  }, "hubs", "edit", hub));
}
