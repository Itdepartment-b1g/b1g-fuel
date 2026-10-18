"use client";
import { Pencil, Power, UserPlus } from "lucide-react";
import { TableView } from "@/components/common/table/table-view";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { canManageHubStaff } from "@/utils/hub-access";
import type { HubSummary } from "@/types/hubs";
import type { TableSort } from "@/types/table-views";
import { HubDetails } from "../hub-details";
import { HUB_TABLE_COLUMNS } from "./hub-table-columns";

export type HubActionProps = {
  onEdit: (hub: HubSummary) => void;
  onDeactivate: (hub: HubSummary) => void;
  onAssign: (hub: HubSummary) => void;
  disabled: boolean;
};
export function HubsTableView(props: HubActionProps & { hubs: HubSummary[]; loading: boolean; sorting: TableSort | null; onSortingChange: (sort: TableSort | null) => void }) {
  const access = useRecordAccess();
  return <TableView data={props.hubs} rowKey={(hub) => hub.id} caption="Company hubs" columns={HUB_TABLE_COLUMNS}
    loading={props.loading} sortingMode="server" sorting={props.sorting} onSortingChange={props.onSortingChange}
    multipleFrozenColumns actionsDisabled={props.disabled} expandedRow={(hub) => <HubDetails hub={hub} />}
    emptyTitle="No hubs found" emptyDescription="Create a hub or adjust your search and filters."
    actions={(hub) => [
      { id: "edit", label: "Edit", icon: <Pencil />, disabled: !canPerform(access, "hubs", "edit", hub), onSelect: props.onEdit },
      { id: "assign", label: "Assign staff", icon: <UserPlus />, disabled: !canManageHubStaff(access, hub), onSelect: props.onAssign },
      { id: "deactivate", label: "Deactivate", icon: <Power />, destructive: true, disabled: !hub.is_active || !canPerform(access, "hubs", "delete", hub), onSelect: props.onDeactivate },
    ]} />;
}
