"use client";

import { useState } from "react";
import { ChevronDown, Pencil, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { BrandSummary } from "@/types/brands";
import { BrandVariants } from "../brand-variants";
import type { BrandActionProps } from "../table-view/brands-table-view";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {brands.map((brand) => (
        <article key={brand.id} className="rounded-xl border p-5">
          <Tag className="mb-4 size-7 text-primary" aria-hidden="true" />
          <h2 className="break-words font-semibold">{brand.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {brand.company?.name ?? "All companies"} · {brand.created_by_name ?? "—"}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {brand.variant_count} {brand.variant_count === 1 ? "variant" : "variants"}
          </p>
          <button
            type="button"
            className="mt-4 flex w-full items-center justify-between text-sm font-medium"
            aria-expanded={expandedId === brand.id}
            onClick={() => setExpandedId((current) => (current === brand.id ? null : brand.id))}
          >
            View variants
            <ChevronDown
              className={`size-4 transition-transform ${expandedId === brand.id ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {expandedId === brand.id && (
            <div className="mt-3">
              <BrandVariants
                brand={brand}
                revision={revision}
                onAdd={onAddVariant}
                onEdit={onEditVariant}
                onDelete={onDeleteVariant}
              />
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || !canPerform(access, "brandsAndVariants", "edit", brand)}
              onClick={() => onEdit(brand)}
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || !canPerform(access, "brandsAndVariants", "delete", brand)}
              onClick={() => onDelete(brand)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
