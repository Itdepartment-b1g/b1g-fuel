import { Building2, Mail } from "lucide-react";
import type { UserSummary } from "@/lib/users";
import { UserAssignments, UserAvatar } from "../user-details";

export function UserCard({ user }: { user: UserSummary }) {
  return <article className="rounded-xl border bg-white p-5">
    <div className="mb-5 flex items-center gap-3"><UserAvatar name={user.name} /><h2 className="min-w-0 truncate font-semibold" title={user.name}>{user.name}</h2></div>
    <p className="mb-3 flex items-start gap-2 text-sm text-muted-foreground"><Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="break-all">{user.email ?? "No email"}</span></p>
    <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground"><Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{user.companies.map((company) => company.name).join(", ") || "No company assigned"}</span></p>
    <UserAssignments user={user} />
  </article>;
}
