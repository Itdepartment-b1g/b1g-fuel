"use client";

import { Button } from "@/components/ui/button";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { PURCHASE_ORDER_STATUS_LABEL, type PurchaseOrderSummary } from "@/types/purchase-orders";
import { formatDate } from "@/utils/date";
import { purchaseOrderActions, type PurchaseOrderActionProps } from "../table-view/purchase-orders-table-view";

export function PurchaseOrderCards(props: PurchaseOrderActionProps & {
  purchaseOrders: PurchaseOrderSummary[];
  loading: boolean;
}) {
  const access = useRecordAccess();
  if (props.loading && !props.purchaseOrders.length) {
    return <p role="status" className="p-6 text-sm text-muted-foreground">Loading purchase orders…</p>;
  }
  if (!props.purchaseOrders.length) {
    return <p className="p-6 text-sm text-muted-foreground">No purchase orders found.</p>;
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {props.purchaseOrders.map((order) => {
        const actions = purchaseOrderActions(order, access, props);
        return (
          <article key={order.id} className="flex flex-col rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="min-w-0 font-semibold break-words">{order.purchase_order_no}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {actions.filter((action) => action.inline).map((action) => (
                  <Button key={action.id} size="sm" variant="outline" className={action.className} disabled={props.disabled || Boolean(typeof action.disabled === "function" ? action.disabled(order) : action.disabled)} onClick={() => action.onSelect(order)}>
                    {action.icon}{action.label}
                  </Button>
                ))}
                <CardActionsMenu
                  label={`Actions for ${order.purchase_order_no}`}
                  disabled={props.disabled}
                  items={actions.filter((action) => !action.inline).map((action) => ({
                    id: action.id,
                    label: action.label,
                    icon: action.icon,
                    disabled: typeof action.disabled === "function" ? action.disabled(order) : action.disabled,
                    onSelect: () => action.onSelect(order),
                  }))}
                />
              </div>
            </div>
            <p className="mt-2 text-sm">{PURCHASE_ORDER_STATUS_LABEL[order.status]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{order.supplier.name} · {order.facility.name}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Company</dt>
                <dd className="text-right">{order.company.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Lines</dt>
                <dd>{order.line_count}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Needed date</dt>
                <dd>{order.estimated_delivery_on ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(order.created_at)}</dd>
              </div>
            </dl>
            <div className="mt-auto pt-5">
              <Button variant="outline" size="sm" className="w-full" disabled={props.disabled} onClick={() => props.onView(order)}>View</Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
