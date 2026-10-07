import type { UserSummary } from "@/lib/users";
import { UserCard } from "./user-card";

export function UsersCards({ users }: { users: UserSummary[] }) {
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">{users.map((user) => <UserCard key={user.id} user={user} />)}</div>;
}
