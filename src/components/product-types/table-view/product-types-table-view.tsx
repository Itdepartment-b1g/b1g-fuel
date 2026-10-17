"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { ProductTypeSummary } from "@/types/product-types";
import { PRODUCT_TYPE_TABLE_COLUMNS } from "./product-type-table-columns";

export function ProductTypesTableView(props: {
  productTypes: ProductTypeSummary[];
  loading: boolean;
  sorting: TableSort | null;
  onSortingChange: (sorting: TableSort | null) => void;
  onEdit: (row: ProductTypeSummary) => void;
  onDelete: (row: ProductTypeSummary) => void;
  disabled: boolean;
}) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.productTypes}
      rowKey={(row) => row.id}
      caption="Product types"
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No product types found"
      emptyDescription="Add New and Refill types, or adjust your search."
      columns={PRODUCT_TYPE_TABLE_COLUMNS}
      actions={(row) => [
        {
          id: "edit",
          label: "Edit",
          icon: <Pencil />,
          disabled: !canPerform(access, "productTypes", "edit", row),
          onSelect: props.onEdit,
        },
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 />,
          destructive: true,
          disabled: !canPerform(access, "productTypes", "delete", row),
          onSelect: props.onDelete,
        },
      ]}
    />
  );
}
