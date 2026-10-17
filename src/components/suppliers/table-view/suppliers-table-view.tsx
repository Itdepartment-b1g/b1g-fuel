"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { SupplierSummary } from "@/types/suppliers";
import { formatDate } from "@/utils/date";

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
      columns={[
        { id: "name", header: "Supplier", sortable: true, freezable: true, value: (supplier) => supplier.name, className: "font-semibold" },
        { id: "company", header: "Company", freezable: true, cell: (supplier) => supplier.company?.name ?? "All companies" },
        { id: "contact_person", header: "Contact", value: (supplier) => supplier.contact_person },
        { id: "contact_email", header: "Email", value: (supplier) => supplier.contact_email },
        { id: "contact_phone", header: "Phone", cell: (supplier) => supplier.contact_phone || "—" },
        { id: "contact_address", header: "Address", cell: (supplier) => supplier.contact_address || "—" },
        { id: "created_by", header: "Created by", freezable: true, cell: (supplier) => supplier.created_by_name || "—" },
        {
          id: "created_at",
          header: "Created",
          sortable: true,
          freezable: true,
          cell: (supplier) => <time dateTime={supplier.created_at}>{formatDate(supplier.created_at)}</time>,
        },
      ]}
      actions={(supplier) => [
        { id: "edit", label: "Edit", icon: <Pencil />, disabled: !canPerform(access, "suppliers", "edit", supplier), onSelect: props.onEdit },
        { id: "delete", label: "Delete", icon: <Trash2 />, destructive: true, disabled: !canPerform(access, "suppliers", "delete", supplier), onSelect: props.onDelete },
      ]}
    />
  );
}
