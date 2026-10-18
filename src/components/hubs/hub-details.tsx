import type { HubSummary } from "@/types/hubs";
import { formatDate } from "@/utils/date";

export function HubStatus({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{active ? "Active" : "Inactive"}</span>;
}
export function HubDetails({ hub }: { hub: HubSummary }) {
  const fields = [
    ["Company", hub.company.name], ["Address", hub.address || "No address added"],
    ["Assigned staff", String(hub.staff_count)], ["Created by", hub.created_by_name ?? "Unavailable"],
    ["Created", formatDate(hub.created_at)], ["Last updated", formatDate(hub.updated_at)],
  ];
  return <div className="space-y-4 p-4"><HubStatus active={hub.is_active} /><dl className="grid gap-4 text-sm sm:grid-cols-2">
    {fields.map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
  </dl></div>;
}
