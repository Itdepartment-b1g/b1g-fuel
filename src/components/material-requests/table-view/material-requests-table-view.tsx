import { CircleCheck, CircleX, Eye, History, PackageCheck, Truck } from "lucide-react";
import { TableView, type TableAction } from "@/components/common/table/table-view";
import type { MaterialRequest } from "@/types/material-requests";
import { MaterialRequestDetails } from "./material-request-details";
import { MATERIAL_REQUEST_TABLE_COLUMNS } from "./material-requests-table-columns";
import type { TableSort } from "@/types/table-views";

export type MaterialRequestActionProps = {
  onView: (row: MaterialRequest) => void;
  onApprove: (row: MaterialRequest) => void;
  onReject: (row: MaterialRequest) => void;
  onDispatch: (row: MaterialRequest) => void;
  onReceive: (row: MaterialRequest) => void;
  onTimeline: (row: MaterialRequest) => void;
  disabled?: boolean;
};

export function materialRequestActions(row: MaterialRequest, props: MaterialRequestActionProps): TableAction<MaterialRequest>[] {
  return [
    ...(row.permissions?.review ? [
      { id: "approve", label: "Approve", inline: true, icon: <CircleCheck className="text-emerald-600" />, className: "border-emerald-200 text-emerald-700", onSelect: props.onApprove },
      { id: "reject", label: "Reject", inline: true, icon: <CircleX className="text-rose-600" />, className: "border-rose-200 text-rose-700", onSelect: props.onReject },
    ] : []),
    ...(row.permissions?.dispatch ? [
      { id: "dispatch", label: "Dispatch", inline: true, icon: <Truck className="text-amber-600" />, className: "border-amber-200 text-amber-700", onSelect: props.onDispatch },
    ] : []),
    ...(row.permissions?.receive ? [
      { id: "receive", label: "Receive", inline: true, icon: <PackageCheck className="text-sky-600" />, className: "border-sky-200 text-sky-700", onSelect: props.onReceive },
    ] : []),
    { id: "view", label: row.status === "draft" ? "View draft" : "View", icon: <Eye className="text-violet-600" />, onSelect: props.onView },
    { id: "timeline", label: "Timeline", icon: <History className="text-amber-600" />, onSelect: props.onTimeline },
  ];
}

export function MaterialRequestsTableView(props: MaterialRequestActionProps & { rows: MaterialRequest[]; loading: boolean; sorting?: TableSort | null; onSortingChange?: (next: TableSort | null) => void }) {
  return <TableView data={props.rows} columns={MATERIAL_REQUEST_TABLE_COLUMNS} rowKey={(row) => row.id} loading={props.loading} caption="Material requests" sortingMode="server" sorting={props.sorting} onSortingChange={props.onSortingChange} multipleFrozenColumns actionsDisabled={props.disabled} actionsMenu actionsLabel={(row) => `Actions for ${row.request_no ?? "draft request"}`} expandedRow={(row) => <MaterialRequestDetails record={row} />} emptyTitle="No material requests" emptyDescription="Create a draft or change your search." actions={(row) => materialRequestActions(row, props)} />;
}
