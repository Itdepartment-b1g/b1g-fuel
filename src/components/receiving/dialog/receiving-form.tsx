"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createReceiving, postReceiving, selectReceiving, updateReceiving } from "@/lib/store/receiving-slice";
import type { ReceivingSummary } from "@/types/receiving";

type DraftLine = {
  purchase_order_item_id: string;
  display_name: string;
  unit: string;
  outstanding_qty: string;
  qty: string;
};

export function ReceivingForm({
  receipt,
  onSaved,
  onCancel,
}: {
  receipt?: ReceivingSummary;
  onSaved: (row: ReceivingSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectReceiving);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const locked = Boolean(receipt && receipt.status !== "draft");
  const [purchaseOrderId, setPurchaseOrderId] = useState(receipt?.purchase_order_id ?? "");
  const [notes, setNotes] = useState(receipt?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    receipt?.items.map((item) => ({
      purchase_order_item_id: item.purchase_order_item_id,
      display_name: item.display_name,
      unit: item.unit.symbol,
      outstanding_qty: item.outstanding_qty,
      qty: item.qty,
    })) ?? [],
  );
  const [savedId, setSavedId] = useState(receipt?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const selected = options.purchase_orders.find((order) => order.id === purchaseOrderId);

  function chooseOrder(id: string) {
    const order = options.purchase_orders.find((row) => row.id === id);
    setPurchaseOrderId(id);
    setLines(
      order?.items.map((item) => ({
        purchase_order_item_id: item.id,
        display_name: item.display_name,
        unit: item.unit.symbol,
        outstanding_qty: item.outstanding_qty,
        qty: item.outstanding_qty,
      })) ?? [],
    );
  }

  function payload() {
    return {
      purchase_order_id: purchaseOrderId,
      notes,
      lines: lines.map((line) => ({ purchase_order_item_id: line.purchase_order_item_id, qty: line.qty.trim() })),
    };
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
    if (busy.current || locked) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const body = payload();
      const saved = savedId
        ? await dispatch(updateReceiving({ id: savedId, ...body })).unwrap()
        : await dispatch(createReceiving(body)).unwrap();
      setSavedId(saved.receiving.id);
      const posted = posting ? await dispatch(postReceiving(saved.receiving.id)).unwrap() : saved;
      toast.success(posting ? "Receipt posted." : `Draft receipt was ${receipt ? "updated" : "created"}.`);
      onSaved(posted.receiving);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the receipt."));
    } finally {
      busy.current = false;
    }
  }

  const warehouse = receipt?.location ?? selected?.location;
  const supplier = receipt?.supplier ?? selected?.supplier;

  return (
    <form onSubmit={(event) => void save(event)} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending || locked} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          Purchase order <span className="text-destructive">*</span>
          <select
            value={purchaseOrderId}
            disabled={Boolean(receipt)}
            onChange={(event) => chooseOrder(event.target.value)}
            className="h-10 w-full rounded-md border bg-white px-3 text-sm"
          >
            <option value="">Select</option>
            {receipt && !options.purchase_orders.some((order) => order.id === receipt.purchase_order_id) && (
              <option value={receipt.purchase_order_id}>
                {receipt.supplier.name} · {receipt.location.name}
              </option>
            )}
            {options.purchase_orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.supplier.name} · {order.location.name}
              </option>
            ))}
          </select>
        </label>
        {supplier && warehouse && (
          <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
            <p><span className="font-medium">Supplier. </span>{supplier.name}</p>
            <p>
              <span className="font-medium">Warehouse. </span>
              {warehouse.name}
              {warehouse.address.trim() ? ` · ${warehouse.address.trim()}` : ""}
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
        </div>
      </fieldset>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>
      )}
      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          {locked ? "Done" : "Cancel"}
        </Button>
        {!locked && (
          <>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              Save draft
            </Button>
            <Button type="button" disabled={pending} onClick={(event) => void save(event, true)}>
              Post receipt
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
