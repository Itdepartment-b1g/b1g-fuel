"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { BrandSummary } from "@/types/brands";
import type { VariantSummary } from "@/types/variants";
import { BrandVariants } from "../brand-variants";
import { BRAND_TABLE_COLUMNS } from "./brand-table-columns";

export type BrandActionProps = {
  onEdit: (brand: BrandSummary) => void;
  onDelete: (brand: BrandSummary) => void;
  onAddVariant: (brand: BrandSummary) => void;
  onEditVariant: (variant: VariantSummary) => void;
  onDeleteVariant: (variant: VariantSummary) => void;
  disabled: boolean;
  revision: number;
};

export function BrandsTableView(
  props: BrandActionProps & {
    brands: BrandSummary[];
    loading: boolean;
    sorting: TableSort | null;
    onSortingChange: (sorting: TableSort | null) => void;
  },
) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.brands}
      rowKey={(brand) => brand.id}
      caption="Brands and their variants"
      expandedRow={(brand) => (
        <BrandVariants
          key={`${brand.id}-${props.revision}`}
          brand={brand}
          revision={props.revision}
          onAdd={props.onAddVariant}
          onEdit={props.onEditVariant}
          onDelete={props.onDeleteVariant}
        />
      )}
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No brands found"
      emptyDescription="Add a brand or adjust your search."
      columns={BRAND_TABLE_COLUMNS}
      actions={(brand) => [
        {
          id: "edit",
          label: "Edit",
          icon: <Pencil />,
          disabled: !canPerform(access, "brandsAndVariants", "edit", brand),
          onSelect: props.onEdit,
        },
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 />,
          destructive: true,
          disabled: !canPerform(access, "brandsAndVariants", "delete", brand),
          onSelect: props.onDelete,
        },
      ]}
    />
  );
}
