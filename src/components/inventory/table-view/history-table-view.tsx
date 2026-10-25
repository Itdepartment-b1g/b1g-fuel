"use client";

import { TableView, type TableColumn } from "@/components/common/table/table-view";
import { Button } from "@/components/ui/button";
import type { InventoryMovement } from "@/types/inventory";
import type { TableSort } from "@/types/table-views";
import { formatDateTime } from "@/utils/date";
import { formatQuantity, MovementQuantity } from "../quantity";
import { TRANSACTION_LABELS } from "../dialog/movement-details-dialog";

export function HistoryTableView({ movements, loading, unit, onView, sorting, onSortingChange }: { movements: InventoryMovement[]; loading: boolean; unit: string; onView: (movement: InventoryMovement) => void; sorting?: TableSort | null; onSortingChange?: (sorting: TableSort | null) => void }) {
  const columns: TableColumn<InventoryMovement>[] = [
    { id: "date", header: "Date & Time", sortable: true, sortField: "created_at", freezable: true, value: (row) => formatDateTime(row.created_at) },
    { id: "reference", header: "Reference No.", freezable: true, cell: (row) => <button className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onView(row)}>{row.reference_no}</button> },
    { id: "direction", header: "Movement Type", sortable: true, freezable: true, value: (row) => row.direction === "in" ? "Stock In" : "Stock Out" },
    { id: "transaction", header: "Transaction Type", freezable: true, value: (row) => TRANSACTION_LABELS[row.type] },
    { id: "unit", header: "Unit of Measure", freezable: true, value: () => unit },
    { id: "qty", header: "Movement Qty", sortable: true, freezable: true, align: "right", className: "text-right", cell: (row) => <MovementQuantity value={`${row.direction === "out" ? "-" : ""}${row.qty}`} /> },
    { id: "balance", header: "Balance After", sortable: true, sortField: "balance_after", freezable: true, align: "right", className: "text-right tabular-nums", cell: (row) => row.balance_after === null ? <span className="text-muted-foreground" title="No balance snapshot exists for this historical movement">Unavailable</span> : formatQuantity(row.balance_after) },
    { id: "actor", header: "Processed By", freezable: true, value: (row) => row.created_by_name ?? "Unknown user" },
    { id: "details", header: "Details", cell: (row) => <Button variant="ghost" size="sm" onClick={() => onView(row)} aria-label={`View movement ${row.reference_no}`}>View</Button> },
  ];
  return <><div className="hidden sm:block"><TableView data={movements} columns={columns} rowKey={(row) => row.id} caption="Stock movement history" loading={loading} sortingMode="server" sorting={sorting} onSortingChange={onSortingChange} defaultSorting={{ field: "created_at", direction: "desc" }} emptyTitle="No movements found" emptyDescription="No stock movements match the selected filters." /></div>
    <div className="divide-y sm:hidden">{loading ? <p role="status" className="py-6 text-sm text-muted-foreground">Loading stock movements…</p> : !movements.length ? <p className="py-6 text-sm text-muted-foreground">No stock movements match the selected filters.</p> : movements.map((row) => <button key={row.id} onClick={() => onView(row)} className="w-full space-y-2 py-4 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary" aria-label={`View details for ${row.reference_no}`}>
      <div className="flex items-start justify-between gap-3"><span className="font-medium">{TRANSACTION_LABELS[row.type]}</span><MovementQuantity value={`${row.direction === "out" ? "-" : ""}${row.qty}`} unit={unit} /></div>
      <p className="break-all text-primary">{row.reference_no}</p><p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)} · {row.created_by_name ?? "Unknown user"}</p>
      <p className="text-xs text-muted-foreground">Balance After: {row.balance_after === null ? "Unavailable" : `${formatQuantity(row.balance_after)} ${unit}`}</p>
    </button>)}</div></>;
}
