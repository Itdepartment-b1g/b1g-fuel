"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { ReceivingSummary } from "@/types/receiving";
import { formatDateTime } from "@/utils/date";

const STATUS_LABEL = { draft: "Draft", posted: "Posted" };

export function ReceivingTableView(props: {
  receivings: ReceivingSummary[];
  loading: boolean;
  sorting: TableSort | null;
  onSortingChange: (sorting: TableSort | null) => void;
  onEdit: (row: ReceivingSummary) => void;
  onDelete: (row: ReceivingSummary) => void;
  disabled: boolean;
}) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.receivings}
      rowKey={(row) => row.id}
      caption="Receiving"
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No receipts found"
      emptyDescription="Record what arrived against a purchase order."
      columns={[
        {
          id: "receiving_no",
          header: "Receiving no.",
          sortable: true,
          freezable: true,
          value: (row) => row.receiving_no ?? "—",
          className: "font-semibold",
        },
        {
          id: "supplier",
          header: "Supplier",
          freezable: true,
          value: (row) => row.supplier.name,
          className: "font-semibold",
        },
        {
          id: "location",
          header: "Warehouse",
          value: (row) => row.location.name,
        },
        {
          id: "company",
          header: "Company",
          value: (row) => row.company.name,
        },
        {
          id: "status",
          header: "Status",
          sortable: true,
          value: (row) => STATUS_LABEL[row.status],
        },
        {
          id: "line_count",
          header: "Lines",
          value: (row) => String(row.line_count),
        },
        {
          id: "posted_at",
          header: "Posted",
          sortable: true,
          cell: (row) => formatDateTime(row.posted_at),
        },
      ]}
      actions={(row) => [
        {
          id: "edit",
          label: row.status === "draft" ? "Edit" : "View",
          icon: <Pencil />,
          disabled: !canPerform(access, "receiving", "view", row),
          onSelect: props.onEdit,
        },
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 />,
          destructive: true,
          disabled: row.status !== "draft" || !canPerform(access, "receiving", "delete", row),
          onSelect: props.onDelete,
        },
      ]}
    />
  );
}
