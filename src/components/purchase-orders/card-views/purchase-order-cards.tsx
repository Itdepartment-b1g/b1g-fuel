"use client";

import { useState } from "react";
import { CircleX, ClipboardList, Eye, History, PackageCheck, Pencil } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import { PURCHASE_ORDER_STATUS_LABEL, type PurchaseOrderSummary } from "@/types/purchase-orders";
import { formatDate } from "@/utils/date";
import { ViewPurchaseOrderDialog } from "../dialog/view-purchase-order-dialog";

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
  const [viewing, setViewing] = useState<PurchaseOrderSummary | null>(null);
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
            <div className="mb-4 flex items-start justify-between gap-2">
              <ClipboardList className="size-7 text-primary" aria-hidden="true" />
              <CardActionsMenu
                label={`Actions for ${order.purchase_order_no}`}
                items={[
                  { id: "view", label: "View", icon: <Eye />, onSelect: () => setViewing(order) },
                  ...(order.status === "draft"
                    ? [{
                        id: "edit",
                        label: "Edit",
                        icon: <Pencil />,
                        disabled: disabled || !canPerform(access, "purchaseOrders", "edit", order),
                        onSelect: () => onEdit(order),
                      }]
                    : []),
                  ...(openForReceipt
                    ? [{
                        id: "close",
                        label: "Close",
                        icon: <CircleX />,
                        disabled: disabled || !canPerform(access, "purchaseOrders", "edit", order),
                        onSelect: () => onCloseOrder(order),
                      }, {
                        id: "receive",
                        label: "Receive",
                        icon: <PackageCheck />,
                        disabled: disabled || !canPerform(access, "receiving", "add", order),
                        onSelect: () => onReceive(order),
                      }]
                    : []),
                  {
                    id: "timeline",
                    label: "Timeline",
                    icon: <History />,
                    disabled: disabled || !canPerform(access, "purchaseOrders", "view", order),
                    onSelect: () => onTimeline(order),
                  },
                ]}
              />
            </div>
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
          </article>
        );
      })}
      {viewing && <ViewPurchaseOrderDialog order={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
