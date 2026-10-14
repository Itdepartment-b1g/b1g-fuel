"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { BrandSummary } from "@/types/brands";
import type { VariantSummary } from "@/types/variants";
import { BrandVariants } from "../brand-variants";

export type BrandActionProps = {
  onEdit: (brand: BrandSummary) => void;
  onDelete: (brand: BrandSummary) => void;
  onAddVariant: (brand: BrandSummary) => void;
  onEditVariant: (variant: VariantSummary) => void;
  onDeleteVariant: (variant: VariantSummary) => void;
  disabled: boolean;
  revision: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

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
      columns={[
        {
          id: "name",
          header: "Brand",
          sortable: true,
          freezable: true,
          value: (brand) => brand.name,
          className: "font-semibold",
        },
        {
          id: "company",
          header: "Company",
          freezable: true,
          cell: (brand) => brand.company?.name ?? "All companies",
        },
        {
          id: "variants",
          header: "Variants",
          cell: (brand) => brand.variant_count,
        },
        {
          id: "created_by",
          header: "Created by",
          freezable: true,
          cell: (brand) => brand.created_by_name ?? "—",
        },
        {
          id: "created_at",
          header: "Created",
          sortable: true,
          freezable: true,
          cell: (brand) => (
            <time dateTime={brand.created_at}>{formatDate(brand.created_at)}</time>
          ),
        },
      ]}
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
