"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearMaterialRequestMutation, receiveMaterialRequest } from "@/lib/store/material-requests-slice";
import type { MaterialRequest } from "@/types/material-requests";

type DraftLine = {
  material_request_item_id: string;
  product_label: string;
  unit_label: string;
  requested_qty: string;
  dispatched_qty: string;
  received_qty: string;
  outstanding_qty: string;
  qty: string;
};

function outstanding(dispatched: string, received: string) {
  const left = Math.round((Number(dispatched) - Number(received)) * 1000) / 1000;
  return left > 0 ? String(left) : "";
}

export function ReceiveMaterialRequestDialog({ request, onClose, onSaved }: { request: MaterialRequest; onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();
  const pending = useAppSelector((state) => state.materialRequests.mutation.loading);
  const mutationError = useAppSelector((state) => state.materialRequests.mutation.error);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>(() => request.items.flatMap((item) => {
    const left = outstanding(item.dispatched_qty ?? "0", item.received_qty ?? "0");
    if (!left) return [];
    return [{ material_request_item_id: item.id, product_label: item.product_label, unit_label: item.unit_label, requested_qty: item.requested_qty, dispatched_qty: item.dispatched_qty ?? "0", received_qty: item.received_qty ?? "0", outstanding_qty: left, qty: "" }];
  }));

  useEffect(() => { dispatch(clearMaterialRequestMutation()); }, [dispatch]);
  useEffect(() => { if (mutationError?.status === 401) router.replace("/login"); }, [mutationError, router]);

  async function receive() {
    if (busy.current) return;
    const entered = lines.filter((line) => line.qty.trim());
    if (!entered.length) { setError("Enter the quantity received."); return; }
    if (entered.some((line) => !/^\d{1,11}(\.\d{1,3})?$/.test(line.qty.trim()) || Number(line.qty) <= 0)) { setError("Enter a received quantity greater than 0."); return; }
    if (entered.some((line) => Number(line.qty) > Number(line.outstanding_qty))) { setError("Received quantity cannot be more than the quantity still outstanding."); return; }
    busy.current = true;
    setError(null);
    try {
      const saved = await dispatch(receiveMaterialRequest({ id: request.id, lines: entered.map((line) => ({ material_request_item_id: line.material_request_item_id, qty: line.qty.trim() })) })).unwrap();
      toast.success(saved.status === "received" ? `Receipt ${saved.receiving_no} posted. The request is fully received.` : `Receipt ${saved.receiving_no} posted. The request is partially received.`);
      onSaved();
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not receive the material request."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-2xl [&>*]:min-w-0 ${pending ? "[&>button]:hidden" : ""}`}>
        <DialogHeader>
          <DialogTitle>Receive materials</DialogTitle>
          <DialogDescription>
            {request.request_no} · {request.requesting_hub.name}. Enter the quantity that arrived. A receive number is assigned when this receipt posts.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          {lines.map((line, index) => (
            <div key={line.material_request_item_id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="min-w-0 text-sm">
                <p className="font-medium break-words">{line.product_label}</p>
                <p className="text-muted-foreground">Requested {line.requested_qty} {line.unit_label} · Dispatched {line.dispatched_qty} {line.unit_label} · Received {line.received_qty} {line.unit_label} · Left to receive {line.outstanding_qty} {line.unit_label}</p>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Qty received
                <Input aria-label={`Received quantity ${index + 1}`} value={line.qty} inputMode="decimal" disabled={pending} onChange={(event) => setLines((current) => current.map((item) => item.material_request_item_id === line.material_request_item_id ? { ...item, qty: event.target.value } : item))} />
              </label>
            </div>
          ))}
          {!lines.length && <p className="text-sm text-muted-foreground">This request has nothing left to receive.</p>}
        </div>
        {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
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
