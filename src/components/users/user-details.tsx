import type { UserSummary } from "@/server/schema/users_schema";

export function UserAssignments({ user }: { user: UserSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.global_roles.map((role) => (
        <span
          key={role.id}
          className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
        >
          {role.name}
        </span>
      ))}
      {user.companies.flatMap((company) =>
        company.roles.map((role) => (
          <span
            key={`${company.id}-${role.id}`}
            title={company.name}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
          >
            {role.name} · {company.name}
          </span>
        )),
      )}
      {!user.global_roles.length &&
        !user.companies.some((company) => company.roles.length) && (
          <span className="text-sm text-muted-foreground">
            No roles assigned
          </span>
        )}
    </div>
  );
}

export function userInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}
export function UserAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
    >
      {userInitials(name)}
    </span>
  );
}
