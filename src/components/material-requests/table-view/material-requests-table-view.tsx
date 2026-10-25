import { TableView, type TableAction } from "@/components/common/table/table-view";
import type { MaterialRequest } from "@/types/material-requests";
import { MaterialRequestDetails } from "./material-request-details";
import { MATERIAL_REQUEST_TABLE_COLUMNS } from "./material-requests-table-columns";
import type { TableSort } from "@/types/table-views";

export type MaterialRequestActionProps = {
  onView: (row: MaterialRequest) => void;
  onApprove: (row: MaterialRequest) => void;
  onReject: (row: MaterialRequest) => void;
  onTimeline: (row: MaterialRequest) => void;
  disabled?: boolean;
};

export function materialRequestActions(row: MaterialRequest, props: MaterialRequestActionProps): TableAction<MaterialRequest>[] {
  return [
    ...(row.permissions?.review ? [{ id: "approve", label: "Approve", onSelect: props.onApprove }, { id: "reject", label: "Reject", onSelect: props.onReject }] : []),
    { id: "view", label: row.status === "draft" ? "View draft" : "View", onSelect: props.onView },
    { id: "timeline", label: "Timeline", onSelect: props.onTimeline },
  ];
}

export function MaterialRequestsTableView(props: MaterialRequestActionProps & { rows: MaterialRequest[]; loading: boolean; sorting?: TableSort | null; onSortingChange?: (next: TableSort | null) => void }) {
  return <TableView data={props.rows} columns={MATERIAL_REQUEST_TABLE_COLUMNS} rowKey={(row) => row.id} loading={props.loading} caption="Material requests" sortingMode="server" sorting={props.sorting} onSortingChange={props.onSortingChange} multipleFrozenColumns actionsDisabled={props.disabled} expandedRow={(row) => <MaterialRequestDetails record={row} />} emptyTitle="No material requests" emptyDescription="Create a draft or change your search." actions={(row) => materialRequestActions(row, props)} />;
}
