"use client";

import { History } from "lucide-react";
import { TableView } from "@/components/common/table/table-view";
import type { TableSort } from "@/types/table-views";
import type { MaterialRequestReceipt } from "@/types/material-requests";
import { MATERIAL_REQUEST_RECEIVING_COLUMNS } from "./material-request-receiving-table-columns";
import { MaterialRequestReceivingDetails } from "./material-request-receiving-details";

export function MaterialRequestReceivingTableView({ receipts, loading, sorting, onSortingChange, onTimeline }: { receipts: MaterialRequestReceipt[]; loading: boolean; sorting: TableSort | null; onSortingChange: (sorting: TableSort | null) => void; onTimeline: (row: MaterialRequestReceipt) => void }) {
  return <TableView data={receipts} rowKey={(row) => row.id} caption="Material request receiving" loading={loading} columns={MATERIAL_REQUEST_RECEIVING_COLUMNS} sortingMode="server" sorting={sorting} onSortingChange={onSortingChange} multipleFrozenColumns expandedRow={(row) => <MaterialRequestReceivingDetails receipt={row} />} actionsMenu actionsLabel={(row) => `Actions for ${row.receiving_no ?? "receipt"}`} actions={() => [{ id: "timeline", label: "Timeline", icon: <History className="text-amber-600" />, onSelect: onTimeline }]} emptyTitle="No receipts yet" emptyDescription="Receipts appear here after a hub confirms materials from a material request." />;
}
