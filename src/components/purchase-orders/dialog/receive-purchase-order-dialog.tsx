"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearReceivingMutation, createReceiving, postReceiving, selectReceiving } from "@/lib/store/receiving-slice";
import { PURCHASE_ORDER_STATUS_LABEL, type PurchaseOrderSummary } from "@/types/purchase-orders";

type DraftLine = {
  purchase_order_item_id: string;
  display_name: string;
  unit: string;
  ordered_qty: string;
  received_qty: string;
  outstanding_qty: string;
  qty: string;
};

function outstanding(ordered: string, received: string) {
  const left = Number(ordered) - Number(received);
  return left > 0 ? String(left) : "";
}

export function ReceivePurchaseOrderDialog({
  order,
  onClose,
  onSaved,
}: {
  order: PurchaseOrderSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectReceiving);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order.items.flatMap((item) => {
      const left = outstanding(item.ordered_qty, item.received_qty);
      if (!left) return [];
      return [{
        purchase_order_item_id: item.id,
        display_name: item.display_name,
        unit: item.unit.symbol,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        outstanding_qty: left,
        qty: "",
      }];
    }),
  );

  useEffect(() => {
    dispatch(clearReceivingMutation());
  }, [dispatch]);

  useEffect(() => {
    if (mutationError?.status === 401) router.replace("/login");
  }, [mutationError, router]);

  async function receive() {
    if (busy.current) return;
    const entered = lines.filter((line) => line.qty.trim());
    if (!entered.length) {
      setError("Enter the quantity received.");
      return;
    }
    if (entered.some((line) => !/^\d{1,9}(\.\d{1,3})?$/.test(line.qty.trim()) || Number(line.qty) <= 0)) {
      setError("Enter a received quantity greater than 0.");
      return;
    }
    if (entered.some((line) => Number(line.qty) > Number(line.outstanding_qty))) {
      setError("Received quantity cannot be more than the quantity still outstanding.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const saved = await dispatch(
        createReceiving({
          purchase_order_id: order.id,
          lines: entered.map((line) => ({
            purchase_order_item_id: line.purchase_order_item_id,
            qty: line.qty.trim(),
          })),
        }),
      ).unwrap();
      const posted = await dispatch(postReceiving(saved.receiving.id)).unwrap();
      const status = posted.receiving.purchase_order_status;
      toast.success(
        status === "received"
          ? "Order received."
          : "Order partially received.",
      );
      onSaved();
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not receive the purchase order."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-2xl ${pending ? "[&>button]:hidden" : ""}`}>
        <DialogHeader>
          <DialogTitle>Receive order</DialogTitle>
          <DialogDescription>
            {order.supplier.name} · {order.location.name}. Enter the quantity that arrived. The order status updates when this receipt is posted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current status: {PURCHASE_ORDER_STATUS_LABEL[order.status]}
          </p>
          {lines.map((line, index) => (
            <div key={line.purchase_order_item_id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="text-sm">
                <p className="font-medium">{line.display_name}</p>
                <p className="text-muted-foreground">
                  Ordered {line.ordered_qty} {line.unit} · Received {line.received_qty} {line.unit} · Outstanding {line.outstanding_qty} {line.unit}
                </p>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Qty received
                <Input
                  aria-label={`Received quantity ${index + 1}`}
                  value={line.qty}
                  inputMode="decimal"
                  disabled={pending}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item) =>
                        item.purchase_order_item_id === line.purchase_order_item_id
                          ? { ...item, qty: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
          {!lines.length && <p className="text-sm text-muted-foreground">This order has nothing left to receive.</p>}
        </div>
        {(error || mutationError) && (
          <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={pending || !lines.length} onClick={() => void receive()}>
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            Receive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
