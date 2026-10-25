"use client";

import { useRecordAccess } from "@/components/providers/access-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canPerform } from "@/lib/auth/access-scope";
import type { PurchaseOrderSummary } from "@/types/purchase-orders";
import { PurchaseOrderDetails } from "../table-view/purchase-orders-table-view";

export function ViewPurchaseOrderDialog({
  order,
  disabled = false,
  onClose,
  onEdit,
  onReceive,
  onCloseOrder,
}: {
  order: PurchaseOrderSummary;
  disabled?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReceive: () => void;
  onCloseOrder: () => void;
}) {
  const access = useRecordAccess();
  const openForReceipt = order.status === "awaiting_receipt" || order.status === "partially_received";
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{order.purchase_order_no}</DialogTitle>
          <DialogDescription>Order details and ordered materials</DialogDescription>
        </DialogHeader>
        <PurchaseOrderDetails order={order} fit />
        <div className="flex flex-wrap gap-2">
          {order.status === "draft" && canPerform(access, "purchaseOrders", "edit", order) && (
            <Button variant="outline" disabled={disabled} onClick={onEdit}>Edit draft</Button>
          )}
          {openForReceipt && canPerform(access, "receiving", "add", order) && (
            <Button variant="outline" disabled={disabled} onClick={onReceive}>Receive</Button>
          )}
          {openForReceipt && canPerform(access, "purchaseOrders", "edit", order) && (
            <Button variant="outline" disabled={disabled} onClick={onCloseOrder}>Close order</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
