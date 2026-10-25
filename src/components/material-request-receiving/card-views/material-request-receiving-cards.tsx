"use client";

import { History } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import type { MaterialRequestReceipt } from "@/types/material-requests";
import { formatDateTime } from "@/utils/date";
import { materialRequestReceiptSkuCount, materialRequestReceiptTotalQty } from "../table-view/material-request-receiving-table-columns";

export function MaterialRequestReceivingCards({ receipts, onTimeline }: { receipts: MaterialRequestReceipt[]; onTimeline: (row: MaterialRequestReceipt) => void }) {
  if (!receipts.length) return <p className="p-6 text-sm text-muted-foreground">Receipts appear here after a hub confirms materials from a material request.</p>;
  return <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
    {receipts.map((row) => <article key={row.id} className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 font-semibold break-words">{row.receiving_no ?? "Receipt"}</h2>
        <CardActionsMenu label={`Actions for ${row.receiving_no ?? "receipt"}`} items={[{ id: "timeline", label: "Timeline", icon: <History className="text-amber-600" />, onSelect: () => onTimeline(row) }]} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{row.request_no ?? "Request"}</p>
      <dl className="mt-4 space-y-3 text-sm">
        <div><dt className="text-muted-foreground">Requesting hub</dt><dd className="break-words">{row.requesting_company_name} / {row.requesting_hub_name}</dd></div>
        <div><dt className="text-muted-foreground">Supplier</dt><dd className="break-words">{row.supplying_company_name}</dd></div>
        <div><dt className="text-muted-foreground">Total SKUs</dt><dd>{materialRequestReceiptSkuCount(row)}</dd></div>
        <div><dt className="text-muted-foreground">Total Qty</dt><dd>{materialRequestReceiptTotalQty(row)}</dd></div>
        <div><dt className="text-muted-foreground">Received by</dt><dd>{row.posted_by_name ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Received at</dt><dd>{row.posted_at ? formatDateTime(row.posted_at) : "—"}</dd></div>
      </dl>
    </article>)}
  </div>;
}
