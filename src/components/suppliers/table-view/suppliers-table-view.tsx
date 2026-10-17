"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { SupplierSummary } from "@/types/suppliers";
import { SUPPLIER_TABLE_COLUMNS } from "./supplier-table-columns";

export type SupplierActionProps = {
  onEdit: (supplier: SupplierSummary) => void;
  onDelete: (supplier: SupplierSummary) => void;
  disabled: boolean;
};

export function SuppliersTableView(
  props: SupplierActionProps & {
    suppliers: SupplierSummary[];
    loading: boolean;
    sorting: TableSort | null;
    onSortingChange: (sorting: TableSort | null) => void;
  },
) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.suppliers}
      rowKey={(supplier) => supplier.id}
      caption="Suppliers"
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No suppliers found"
      emptyDescription="Add a supplier or adjust your search."
      columns={SUPPLIER_TABLE_COLUMNS}
      actions={(supplier) => [
        { id: "edit", label: "Edit", icon: <Pencil />, disabled: !canPerform(access, "suppliers", "edit", supplier), onSelect: props.onEdit },
        { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true, disabled: !canPerform(access, "suppliers", "delete", supplier), onSelect: props.onDelete },
      ]}
    />
  );
}
