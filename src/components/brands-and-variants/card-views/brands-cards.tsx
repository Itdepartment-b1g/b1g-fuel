"use client";

import { useState } from "react";
import { Eye, Pencil, Tag, Trash2 } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { BrandSummary } from "@/types/brands";
import type { BrandActionProps } from "../table-view/brands-table-view";
import { ViewBrandDialog } from "../dialog/view-brand-dialog";

export function BrandsCards({
  brands,
  disabled,
  revision,
  onEdit,
  onDelete,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
}: BrandActionProps & { brands: BrandSummary[] }) {
  const access = useRecordAccess();
  const [viewing, setViewing] = useState<BrandSummary | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {brands.map((brand) => (
        <article key={brand.id} className="rounded-xl border p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <Tag className="size-7 text-primary" aria-hidden="true" />
            <CardActionsMenu
              label={`Actions for ${brand.name}`}
              items={[
                { id: "view", label: "View", icon: <Eye />, onSelect: () => setViewing(brand) },
                {
                  id: "edit",
                  label: "Edit",
                  icon: <Pencil />,
                  disabled: disabled || !canPerform(access, "brandsAndVariants", "edit", brand),
                  onSelect: () => onEdit(brand),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  disabled: disabled || !canPerform(access, "brandsAndVariants", "delete", brand),
                  onSelect: () => onDelete(brand),
                },
              ]}
            />
          </div>
          <h2 className="break-words font-semibold">{brand.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {brand.company?.name ?? "All companies"} · {brand.created_by_name ?? "—"}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {brand.variant_count} {brand.variant_count === 1 ? "variant" : "variants"}
          </p>
        </article>
      ))}
      {viewing && (
        <ViewBrandDialog
          brand={viewing}
          revision={revision}
          onAdd={onAddVariant}
          onEdit={onEditVariant}
          onDelete={onDeleteVariant}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
