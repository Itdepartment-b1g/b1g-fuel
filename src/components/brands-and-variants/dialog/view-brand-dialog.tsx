"use client";

import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BrandSummary } from "@/types/brands";
import type { VariantSummary } from "@/types/variants";
import { BrandVariants } from "../brand-variants";

export function ViewBrandDialog({
  brand,
  revision,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: {
  brand: BrandSummary;
  revision: number;
  onAdd: (brand: BrandSummary) => void;
  onEdit: (variant: VariantSummary) => void;
  onDelete: (variant: VariantSummary) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5" aria-hidden="true" />
            {brand.name}
          </DialogTitle>
          <DialogDescription>Variants for this brand.</DialogDescription>
        </DialogHeader>
        <BrandVariants brand={brand} revision={revision} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
      </DialogContent>
    </Dialog>
  );
}
