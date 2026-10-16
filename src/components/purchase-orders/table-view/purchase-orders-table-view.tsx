"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { PurchaseOrderSummary } from "@/types/purchase-orders";

const STATUS_LABEL = { draft: "Draft", open: "Open", closed: "Closed" };

export function PurchaseOrdersTableView(props: {
  purchaseOrders: PurchaseOrderSummary[];
  loading: boolean;
  sorting: TableSort | null;
  onSortingChange: (sorting: TableSort | null) => void;
  onEdit: (row: PurchaseOrderSummary) => void;
  onDelete: (row: PurchaseOrderSummary) => void;
  disabled: boolean;
}) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.purchaseOrders}
      rowKey={(row) => row.id}
      caption="Purchase orders"
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No purchase orders found"
      emptyDescription="Create a draft order for a supplier warehouse delivery."
      columns={[
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
          freezable: true,
          value: (row) => row.location.name,
        },
        {
          id: "company",
          header: "Company",
          freezable: true,
          value: (row) => row.company.name,
        },
        {
          id: "status",
          header: "Status",
          sortable: true,
          freezable: true,
          value: (row) => STATUS_LABEL[row.status],
        },
        {
          id: "line_count",
          header: "Lines",
          value: (row) => String(row.line_count),
        },
        {
          id: "estimated_delivery_at",
          header: "Expected",
          sortable: true,
          cell: (row) => row.estimated_delivery_on ?? "—",
        },
        {
          id: "created_at",
          header: "Created",
          sortable: true,
          cell: (row) =>
            new Date(row.created_at).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "Asia/Manila",
            }),
        },
      ]}
      actions={(row) => [
        {
          id: "edit",
          label: row.status === "draft" ? "Edit" : "View",
          icon: <Pencil />,
          disabled: !canPerform(access, "purchaseOrders", "view", row),
          onSelect: props.onEdit,
        },
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 />,
          destructive: true,
          disabled:
            row.status !== "draft" || !canPerform(access, "purchaseOrders", "delete", row),
          onSelect: props.onDelete,
        },
      ]}
    />
  );
}
