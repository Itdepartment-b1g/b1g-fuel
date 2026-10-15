"use client";

import { Pencil, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { SupplierSummary } from "@/types/suppliers";
import { type SupplierActionProps } from "../table-view/suppliers-table-view";

export function SuppliersCards({
  suppliers,
  disabled,
  onEdit,
  onDelete,
}: SupplierActionProps & { suppliers: SupplierSummary[] }) {
  const access = useRecordAccess();
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {suppliers.map((supplier) => (
        <article key={supplier.id} className="rounded-xl border p-5">
          <Truck className="mb-4 size-7 text-primary" aria-hidden="true" />
          <h2 className="break-words font-semibold">{supplier.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{supplier.company?.name ?? "All companies"}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div><dt className="sr-only">Contact</dt><dd>{supplier.contact_person}</dd></div>
            <div><dt className="sr-only">Email</dt><dd className="text-muted-foreground">{supplier.contact_email}</dd></div>
            <div><dt className="sr-only">Phone</dt><dd className="text-muted-foreground">{supplier.contact_phone || "—"}</dd></div>
            <div><dt className="sr-only">Address</dt><dd className="text-muted-foreground">{supplier.contact_address || "—"}</dd></div>
          </dl>
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "suppliers", "edit", supplier)} onClick={() => onEdit(supplier)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "suppliers", "delete", supplier)} onClick={() => onDelete(supplier)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
