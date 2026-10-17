"use client";

import { PackageCheck, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { ReceivingSummary } from "@/types/receiving";
import { formatDateTime } from "@/utils/date";

const STATUS_LABEL = { draft: "Draft", posted: "Posted" };

export function ReceivingCards({
  receivings,
  disabled,
  onEdit,
  onDelete,
}: {
  receivings: ReceivingSummary[];
  disabled: boolean;
  onEdit: (row: ReceivingSummary) => void;
  onDelete: (row: ReceivingSummary) => void;
}) {
  const access = useRecordAccess();
  if (!receivings.length) {
    return <p className="p-6 text-sm text-muted-foreground">No receipts found.</p>;
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {receivings.map((receipt) => (
        <article key={receipt.id} className="rounded-xl border p-5">
          <PackageCheck className="mb-4 size-7 text-primary" aria-hidden="true" />
          <h2 className="break-words font-semibold">{receipt.supplier.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {receipt.location.name} · {receipt.company.name}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{STATUS_LABEL[receipt.status]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Lines</dt>
              <dd>{receipt.line_count}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Posted</dt>
              <dd>
                {formatDateTime(receipt.posted_at)}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || !canPerform(access, "receiving", "view", receipt)}
              onClick={() => onEdit(receipt)}
            >
              <Pencil className="size-4" /> {receipt.status === "draft" ? "Edit" : "View"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || receipt.status !== "draft" || !canPerform(access, "receiving", "delete", receipt)}
              onClick={() => onDelete(receipt)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
