import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UserSummary } from "@/lib/users";
import { UserAssignments, UserAvatar } from "../user-details";

export function UsersTable({ users }: { users: UserSummary[] }) {
  return <Table>
    <caption className="sr-only">Organization users and their assignments</caption>
    <TableHeader><TableRow className="bg-slate-50 hover:bg-slate-50"><TableHead>User</TableHead><TableHead>Company</TableHead><TableHead>Roles</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
    <TableBody>{users.map((user) => <TableRow key={user.id}>
      <TableCell><div className="flex items-center gap-3"><UserAvatar name={user.name} /><div><p className="font-medium">{user.name}</p><p className="mt-0.5 text-muted-foreground">{user.email ?? "No email"}</p></div></div></TableCell>
      <TableCell className="min-w-40">{user.companies.length ? user.companies.map((company) => company.name).join(", ") : <span className="text-muted-foreground">Not assigned</span>}</TableCell>
      <TableCell className="min-w-56"><UserAssignments user={user} /></TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground"><time dateTime={user.created_at}>{new Date(user.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}</time></TableCell>
    </TableRow>)}</TableBody>
  </Table>;
}
