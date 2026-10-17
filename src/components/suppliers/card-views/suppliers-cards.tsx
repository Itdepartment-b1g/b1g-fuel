"use client";

import { Pencil, Trash2, Truck } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
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
          <div className="mb-4 flex items-start justify-between gap-2">
            <Truck className="size-7 text-primary" aria-hidden="true" />
            <CardActionsMenu
              label={`Actions for ${supplier.name}`}
              items={[
                {
                  id: "edit",
                  label: "Edit",
                  icon: <Pencil />,
                  disabled: disabled || !canPerform(access, "suppliers", "edit", supplier),
                  onSelect: () => onEdit(supplier),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  disabled: disabled || !canPerform(access, "suppliers", "delete", supplier),
                  onSelect: () => onDelete(supplier),
                },
              ]}
            />
          </div>
          <h2 className="break-words font-semibold">{supplier.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{supplier.company?.name ?? "All companies"} · {supplier.created_by_name || "—"}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div><dt className="sr-only">Contact</dt><dd>{supplier.contact_person}</dd></div>
            <div><dt className="sr-only">Email</dt><dd className="text-muted-foreground">{supplier.contact_email}</dd></div>
            <div><dt className="sr-only">Phone</dt><dd className="text-muted-foreground">{supplier.contact_phone || "—"}</dd></div>
            <div><dt className="sr-only">Address</dt><dd className="text-muted-foreground">{supplier.contact_address || "—"}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}
