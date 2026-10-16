"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  editPurchaseOrder,
  getPurchaseOrderOption,
  selectPurchaseOrder,
} from "@/lib/store/purchase-orders-slice";
import type { PurchaseOrderSummary } from "@/types/purchase-orders";
import { PurchaseOrderForm } from "./purchase-order-form";

export function PurchaseOrderDialog({
  purchaseOrderId,
  onClose,
  onSaved,
}: {
  purchaseOrderId: string | null;
  onClose: () => void;
  onSaved: (order: PurchaseOrderSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    selectedPurchaseOrder,
    detailStatus,
    detailError,
    optionsStatus,
    optionsError,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectPurchaseOrder);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const options = dispatch(getPurchaseOrderOption());
    const detail = purchaseOrderId ? dispatch(editPurchaseOrder(purchaseOrderId)) : null;
    return () => {
      options.abort();
      detail?.abort();
    };
  }, [dispatch, purchaseOrderId]);
  useEffect(() => {
    if ([detailError, optionsError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);
  const ready =
    optionsStatus === "succeeded" &&
    (purchaseOrderId
      ? detailStatus === "succeeded" && selectedPurchaseOrder?.id === purchaseOrderId
      : true);
  const error = optionsError ?? (purchaseOrderId ? detailError : null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-4xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>
            {purchaseOrderId ? "Purchase order" : "Create a purchase order"}
          </DialogTitle>
          <DialogDescription>
            Order from a supplier into the company's warehouse. Saving a line creates the product. Stock does not change until receiving.
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <PurchaseOrderForm
            key={purchaseOrderId ?? "create"}
            order={purchaseOrderId ? selectedPurchaseOrder! : undefined}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                dispatch(getPurchaseOrderOption());
                if (purchaseOrderId) dispatch(editPurchaseOrder(purchaseOrderId));
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}
