"use client";

import { ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PurchaseOrderSummary } from "@/types/purchase-orders";
import { PurchaseOrderDetails } from "../table-view/purchase-orders-table-view";

export function ViewPurchaseOrderDialog({
  order,
  onClose,
}: {
  order: PurchaseOrderSummary;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" aria-hidden="true" />
            {order.purchase_order_no}
          </DialogTitle>
          <DialogDescription>Payment, delivery, and product lines for this purchase order.</DialogDescription>
        </DialogHeader>
        <PurchaseOrderDetails order={order} />
      </DialogContent>
    </Dialog>
  );
}
