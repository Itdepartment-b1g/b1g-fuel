"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createReceiving, getReceivingOption, postReceiving, selectReceiving, updateReceiving } from "@/lib/store/receiving-slice";
import type { ReceivingSummary } from "@/types/receiving";

type DraftLine = {
  purchase_order_item_id: string;
  display_name: string;
  unit: string;
  outstanding_qty: string;
  qty: string;
};

export function CreateReceivingDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (row: ReceivingSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { optionsStatus, optionsError, mutationStatus, mutationError } = useAppSelector(selectReceiving);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    const options = dispatch(getReceivingOption());
    return () => options.abort();
  }, [dispatch]);

  useEffect(() => {
    if ([optionsError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [optionsError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-3xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Receive a purchase order</DialogTitle>
          <DialogDescription>Record what arrived at the warehouse. Posting updates the purchase order. A draft does not.</DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? (
          <CreateReceivingFields onCancel={onClose} onSaved={onSaved} />
        ) : optionsError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{optionsError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(getReceivingOption())}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateReceivingFields({
  onSaved,
  onCancel,
}: {
  onSaved: (row: ReceivingSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectReceiving);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = options.purchase_orders.find((order) => order.id === purchaseOrderId);

  function chooseOrder(id: string) {
    const order = options.purchase_orders.find((row) => row.id === id);
    setPurchaseOrderId(id);
    setLines(order?.items.map((item) => ({
      purchase_order_item_id: item.id,
      display_name: item.display_name,
      unit: item.unit.symbol,
      outstanding_qty: item.outstanding_qty,
      qty: item.outstanding_qty,
    })) ?? []);
  }

  function validate() {
    if (!purchaseOrderId) return "Select a purchase order.";
    if (!lines.length) return "This purchase order has nothing left to receive.";
    if (lines.some((line) => !/^\d{1,9}(\.\d{1,3})?$/.test(line.qty.trim()) || Number(line.qty) <= 0))
      return "Enter a received quantity greater than 0.";
    if (lines.some((line) => Number(line.qty) > Number(line.outstanding_qty)))
      return "Received quantity cannot be more than the quantity still outstanding.";
    return null;
  }

  async function save(event: FormEvent, posting = false) {
    event.preventDefault();
    if (busy.current) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setError(null);
    const body = {
      purchase_order_id: purchaseOrderId,
      notes,
      lines: lines.map((line) => ({ purchase_order_item_id: line.purchase_order_item_id, qty: line.qty.trim() })),
    };
    try {
      const saved = savedId
        ? await dispatch(updateReceiving({ id: savedId, ...body })).unwrap()
        : await dispatch(createReceiving(body)).unwrap();
      setSavedId(saved.receiving.id);
      const posted = posting ? await dispatch(postReceiving(saved.receiving.id)).unwrap() : saved;
      toast.success(posting ? "Receipt posted." : "Draft receipt was created.");
      onSaved(posted.receiving);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the receipt."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          Purchase order <span className="text-destructive">*</span>
          <select value={purchaseOrderId} onChange={(event) => chooseOrder(event.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm">
            <option value="">Select</option>
            {options.purchase_orders.map((order) => (
              <option key={order.id} value={order.id}>{order.supplier.name} · {order.location.name}</option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
            <p><span className="font-medium">Supplier. </span>{selected.supplier.name}</p>
            <p>
              <span className="font-medium">Warehouse. </span>
              {selected.location.name}
              {selected.location.address.trim() ? ` · ${selected.location.address.trim()}` : ""}
            </p>
          </div>
        )}
        <label className="block space-y-2 text-sm font-medium">
          Notes
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Optional note" />
        </label>
        <div className="space-y-3">
          <p className="text-sm font-medium">Lines</p>
          {lines.map((line, index) => (
            <div key={line.purchase_order_item_id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="text-sm">
                <p className="font-medium">{line.display_name}</p>
                <p className="text-muted-foreground">Outstanding {line.outstanding_qty} {line.unit}</p>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Qty
                <Input
                  aria-label={`Received quantity ${index + 1}`}
                  value={line.qty}
                  inputMode="decimal"
                  onChange={(event) => setLines((current) => current.map((item) => item.purchase_order_item_id === line.purchase_order_item_id ? { ...item, qty: event.target.value } : item))}
                />
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Save draft
        </Button>
        <Button type="button" disabled={pending} onClick={(event) => void save(event, true)}>Post receipt</Button>
      </div>
    </form>
  );
}
