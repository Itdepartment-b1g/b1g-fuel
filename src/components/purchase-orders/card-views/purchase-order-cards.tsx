"use client";

import { useState } from "react";
import { ChevronDown, CircleX, ClipboardList, History, PackageCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { PURCHASE_ORDER_STATUS_LABEL, type PurchaseOrderSummary } from "@/types/purchase-orders";
import { formatDate } from "@/utils/date";
import { PurchaseOrderDetails } from "../table-view/purchase-orders-table-view";

export function PurchaseOrderCards({
  purchaseOrders,
  loading,
  disabled,
  onEdit,
  onCloseOrder,
  onReceive,
  onTimeline,
}: {
  purchaseOrders: PurchaseOrderSummary[];
  loading: boolean;
  disabled: boolean;
  onEdit: (row: PurchaseOrderSummary) => void;
  onCloseOrder: (row: PurchaseOrderSummary) => void;
  onReceive: (row: PurchaseOrderSummary) => void;
  onTimeline: (row: PurchaseOrderSummary) => void;
}) {
  const access = useRecordAccess();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (loading && !purchaseOrders.length) {
    return <p role="status" className="p-6 text-sm text-muted-foreground">Loading purchase orders…</p>;
  }
  if (!purchaseOrders.length) {
    return <p className="p-6 text-sm text-muted-foreground">No purchase orders found.</p>;
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {purchaseOrders.map((order) => {
        const openForReceipt = order.status === "awaiting_receipt" || order.status === "partially_received";
        return (
          <article key={order.id} className="rounded-xl border p-5">
            <ClipboardList className="mb-4 size-7 text-primary" aria-hidden="true" />
            <h2 className="break-words font-semibold">{order.purchase_order_no}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.supplier.name} · {order.location.name}
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Company</dt>
                <dd className="text-right">{order.company.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{PURCHASE_ORDER_STATUS_LABEL[order.status]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Lines</dt>
                <dd>{order.line_count}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Expected</dt>
                <dd>{order.estimated_delivery_on ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(order.created_at)}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between text-sm font-medium"
              aria-expanded={expandedId === order.id}
              onClick={() => setExpandedId((current) => (current === order.id ? null : order.id))}
            >
              View lines
              <ChevronDown className={`size-4 transition-transform ${expandedId === order.id ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {expandedId === order.id && (
              <div className="mt-3">
                <PurchaseOrderDetails order={order} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-3">
              {order.status === "draft" && (
                <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "purchaseOrders", "edit", order)} onClick={() => onEdit(order)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
              {openForReceipt && (
                <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "purchaseOrders", "edit", order)} onClick={() => onCloseOrder(order)}>
                  <CircleX className="size-4" /> Close
                </Button>
              )}
              {openForReceipt && (
                <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "receiving", "add", order)} onClick={() => onReceive(order)}>
                  <PackageCheck className="size-4" /> Receive
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "purchaseOrders", "view", order)} onClick={() => onTimeline(order)}>
                <History className="size-4" /> Timeline
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
