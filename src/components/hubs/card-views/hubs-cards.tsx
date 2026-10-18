"use client";
import { useState } from "react";
import { Building2, Eye, MapPin, Pencil, Power, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { canManageHubStaff } from "@/utils/hub-access";
import type { HubSummary } from "@/types/hubs";
import type { HubActionProps } from "../table-view/hubs-table-view";
import { ViewHubDialog } from "../dialog/view-hub-dialog";
import { HubStatus } from "../hub-details";

export function HubsCards({ hubs, disabled, onEdit, onDeactivate, onAssign, revision }: HubActionProps & { hubs: HubSummary[] }) {
  const access = useRecordAccess();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewing = hubs.find((hub) => hub.id === viewingId);
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
    {hubs.map((hub) => <article key={hub.id} className="flex flex-col rounded-xl border p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <Building2 className="size-7 text-primary" aria-hidden="true" />
        <CardActionsMenu label={`Actions for ${hub.name}`} disabled={disabled} items={[
          { id: "view", label: "View", icon: <Eye />, disabled: !canPerform(access, "hubs", "view", hub), onSelect: () => setViewingId(hub.id) },
          { id: "edit", label: "Edit", icon: <Pencil />, disabled: !canPerform(access, "hubs", "edit", hub), onSelect: () => onEdit(hub) },
          { id: "assign", label: "Assign staff", icon: <UserPlus />, disabled: !canManageHubStaff(access, hub), onSelect: () => onAssign(hub) },
          { id: "deactivate", label: "Deactivate", icon: <Power />, destructive: true, disabled: !hub.is_active || !canPerform(access, "hubs", "delete", hub), onSelect: () => onDeactivate(hub) },
        ]} />
      </div>
      <h2 className="break-words font-semibold">{hub.name}</h2>
      <p className="mt-1 break-words text-xs text-muted-foreground">{hub.company.name}</p>
      <div className="mt-3"><HubStatus active={hub.is_active} /></div>
      <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="break-words">{hub.address || "No address added"}</span></div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><UsersRound className="size-4" aria-hidden="true" />{hub.staff_count} assigned staff</p>
      <p className="mt-3 break-words text-xs text-muted-foreground">Created by {hub.created_by_name ?? "Unavailable"}</p>
      <div className="mt-auto pt-5"><Button variant="outline" size="sm" className="w-full" disabled={disabled || !canPerform(access, "hubs", "view", hub)} onClick={() => setViewingId(hub.id)}>View hub</Button></div>
    </article>)}
    {viewing && <ViewHubDialog hub={viewing} revision={revision} onClose={() => setViewingId(null)} />}
  </div>;
}
