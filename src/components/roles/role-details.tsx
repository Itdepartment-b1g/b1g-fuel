import { ACCESS_SCOPE_LABELS } from "@/lib/auth/access-scope";
import { PAGE_CATALOG } from "@/lib/auth/catalog";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import type { RoleSummary } from "@/types/roles";
import { RoleAssignments } from "./role-assignments";

export function RoleDetails({ role }: { role: RoleSummary }) {
  const fullAccess = role.slug === "super_admin";
  const pages = [...new Set(role.pages)];

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Access and assignments for {role.name}</caption>
        <thead className="border-b bg-gray-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">Access</th>
            <th scope="col" className="px-4 py-3">Pages and permissions</th>
            <th scope="col" className="px-4 py-3">Assignments</th>
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            <td className="px-4 py-3">
              <p className="font-medium">{fullAccess ? "Full dashboard access" : role.scope === "global" ? "Global" : "Company"}</p>
              {role.company && <p className="mt-1 text-xs text-muted-foreground">{role.company.name}</p>}
              {!fullAccess && <p className="mt-1 text-xs text-muted-foreground">{role.pages.length} pages · {role.permissions.length} permissions</p>}
            </td>
            <td className="px-4 py-3">
              {fullAccess ? (
                <p>All pages and permissions</p>
              ) : pages.length ? (
                <ul className="space-y-2">
                  {pages.map((page) => {
                    const label = PAGE_CATALOG.find((item) => item.key === page)?.label ?? page;
                    const permissions = PERMISSION_CATALOG.filter((item) => item.page_key === page && role.permissions.includes(item.key));
                    return (
                      <li key={page} className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="font-medium uppercase">{label}</span>
                        <span aria-hidden="true">—</span>
                        {permissions.length ? permissions.map((permission, index) => (
                          <span key={permission.key}>
                            <span title={permission.action === "add" ? "Creates records as the signed-in user" : `Access: ${ACCESS_SCOPE_LABELS[role.permission_scopes[permission.key] ?? "company"]}`}>
                              {permission.label}
                            </span>
                            {index < permissions.length - 1 ? "," : ""}
                          </span>
                        )) : <span className="text-muted-foreground">No permissions</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-muted-foreground">No pages assigned</p>}
            </td>
            <td className="px-4 py-3 tabular-nums">
              <RoleAssignments key={role.id} roleId={role.id} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
