"use client";

import { FilePlus, PackageCheck } from "lucide-react";
import { TimelineDialog } from "@/components/common/timeline/timeline-dialog";
import { TimelineLegend, type TimelineEntry } from "@/components/common/timeline/timeline";
import type { ReceivingSummary } from "@/types/receiving";
import { PurchaseOrderReceivingDetails } from "../table-view/purchase-order-receiving-details";

function receiptEntries(receipt: ReceivingSummary): TimelineEntry[] {
  const created: TimelineEntry = {
    id: `${receipt.id}-created`,
    title: "Receipt created",
    occurredAt: receipt.created_at,
    actorName: receipt.created_by_name,
    note: receipt.notes,
    icon: <FilePlus />,
    tone: "info",
    content: receipt.posted_at ? undefined : <PurchaseOrderReceivingDetails receipt={receipt} />,
  };
  if (!receipt.posted_at) return [created];
  return [created, {
    id: `${receipt.id}-posted`,
    title: "Receipt posted",
    occurredAt: receipt.posted_at,
    actorName: receipt.posted_by_name,
    icon: <PackageCheck />,
    tone: "success",
    content: <PurchaseOrderReceivingDetails receipt={receipt} />,
  }];
}

export function TimelinePurchaseOrderReceivingDialog({ receipt, onClose }: { receipt: ReceivingSummary; onClose: () => void }) {
  const entries = receiptEntries(receipt);
  return (
    <TimelineDialog
      title="Receipt timeline"
      description={`${receipt.receiving_no ?? "Draft"} · ${receipt.supplier.name} · ${receipt.location.name}`}
      entries={entries}
      onClose={onClose}
    >
      <TimelineLegend entries={entries} />
    </TimelineDialog>
  );
}
