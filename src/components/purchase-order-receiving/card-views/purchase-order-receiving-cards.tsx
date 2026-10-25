"use client";

import { History, PackageCheck, Pencil, Trash2 } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { ReceivingSummary } from "@/types/receiving";
import { formatDateTime } from "@/utils/date";
import { purchaseOrderReceiptSkuCount, purchaseOrderReceiptTotalQty } from "../table-view/purchase-order-receiving-table-columns";

const STATUS_LABEL = { draft: "Draft", posted: "Posted" };

export function ReceivingCards({
  receivings,
  disabled,
  onEdit,
  onDelete,
  onTimeline,
}: {
  receivings: ReceivingSummary[];
  disabled: boolean;
  onEdit: (row: ReceivingSummary) => void;
  onDelete: (row: ReceivingSummary) => void;
  onTimeline: (row: ReceivingSummary) => void;
}) {
  const access = useRecordAccess();
  if (!receivings.length) {
    return <p className="p-6 text-sm text-muted-foreground">No receipts found.</p>;
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {receivings.map((receipt) => (
        <article key={receipt.id} className="rounded-xl border p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <PackageCheck className="size-7 text-primary" aria-hidden="true" />
            <CardActionsMenu
              label={`Actions for ${receipt.supplier.name}`}
              items={[
                {
                  id: "edit",
                  label: receipt.status === "draft" ? "Edit" : "View",
                  icon: <Pencil />,
                  disabled: disabled || !canPerform(access, "receiving", "view", receipt),
                  onSelect: () => onEdit(receipt),
                },
                {
                  id: "timeline",
                  label: "Timeline",
                  icon: <History className="text-amber-600" />,
                  disabled,
                  onSelect: () => onTimeline(receipt),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  disabled: disabled || receipt.status !== "draft" || !canPerform(access, "receiving", "delete", receipt),
                  onSelect: () => onDelete(receipt),
                },
              ]}
            />
          </div>
          <h2 className="break-words font-semibold">{receipt.supplier.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {receipt.facility.name} · {receipt.company.name}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{STATUS_LABEL[receipt.status]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total SKUs</dt>
              <dd>{purchaseOrderReceiptSkuCount(receipt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total Qty</dt>
              <dd>{purchaseOrderReceiptTotalQty(receipt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Posted</dt>
              <dd>
                {formatDateTime(receipt.posted_at)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
