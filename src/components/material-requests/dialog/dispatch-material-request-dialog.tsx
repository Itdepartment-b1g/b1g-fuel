"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { clearMaterialRequestMutation, dispatchMaterialRequest, getMaterialRequest } from "@/lib/store/material-requests-slice";

type DraftLine = {
  material_request_item_id: string;
  product_label: string;
  unit_label: string;
  requested_qty: string;
  dispatched_qty: string;
  available_qty: string;
  outstanding_qty: string;
  qty: string;
};

function left(total: string, done: string) {
  const value = Math.round((Number(total) - Number(done)) * 1000) / 1000;
  return value > 0 ? String(value) : "";
}

export function DispatchMaterialRequestDialog({ requestId, onClose, onSaved }: { requestId: string; onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();
  const detail = useAppSelector((state) => state.materialRequests.detail);
  const pending = useAppSelector((state) => state.materialRequests.mutation.loading);
  const mutationError = useAppSelector((state) => state.materialRequests.mutation.error);
  const request = detail.data?.id === requestId && !detail.loading ? detail.data : null;
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    dispatch(clearMaterialRequestMutation());
    const load = dispatch(getMaterialRequest(requestId));
    return () => load.abort();
  }, [dispatch, requestId]);
  useEffect(() => {
    if (detail.error?.status === 401 || mutationError?.status === 401) router.replace("/login");
  }, [detail.error, mutationError, router]);
  useEffect(() => {
    if (!request) return;
    setLines(request.items.flatMap((item) => {
      const outstanding = left(item.requested_qty, item.dispatched_qty ?? "0");
      if (!outstanding) return [];
      return [{ material_request_item_id: item.id, product_label: item.product_label, unit_label: item.unit_label, requested_qty: item.requested_qty, dispatched_qty: item.dispatched_qty ?? "0", available_qty: item.available_qty ?? "0", outstanding_qty: outstanding, qty: "" }];
    }));
  }, [request]);

  async function send() {
    if (busy.current) return;
    const entered = lines.filter((line) => line.qty.trim());
    if (!entered.length) { setError("Enter the quantity to dispatch."); return; }
    if (entered.some((line) => !/^\d{1,11}(\.\d{1,3})?$/.test(line.qty.trim()) || Number(line.qty) <= 0)) { setError("Enter a dispatched quantity greater than 0."); return; }
    if (entered.some((line) => Number(line.qty) > Number(line.outstanding_qty))) { setError("Dispatched quantity cannot be more than the quantity still to dispatch."); return; }
    busy.current = true;
    setError(null);
    try {
      const saved = await dispatch(dispatchMaterialRequest({ id: requestId, lines: entered.map((line) => ({ material_request_item_id: line.material_request_item_id, qty: line.qty.trim() })) })).unwrap();
      toast.success(`Dispatch ${saved.dispatch_no} posted.`);
      onSaved();
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not dispatch the material request."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-2xl [&>*]:min-w-0 ${pending ? "[&>button]:hidden" : ""}`}>
        <DialogHeader>
          <DialogTitle>Dispatch materials</DialogTitle>
          <DialogDescription>Dispatch part or all of the quantity still to send. The request stays open until the rest is dispatched.</DialogDescription>
        </DialogHeader>
        {!request && !detail.error && <Loading />}
        {detail.error && <p role="alert" className="text-sm text-destructive">{detail.error.message}</p>}
        {request && <div className="min-w-0 space-y-3">
          {lines.map((line, index) => (
            <div key={line.material_request_item_id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="min-w-0 text-sm">
                <p className="font-medium break-words">{line.product_label}</p>
                <p className="text-muted-foreground">Requested {line.requested_qty} {line.unit_label} · Dispatched {line.dispatched_qty} {line.unit_label} · Available {line.available_qty} {line.unit_label} · Left to dispatch {line.outstanding_qty} {line.unit_label}</p>
              </div>
              <label className="block space-y-2 text-sm font-medium">
                Qty dispatched
                <Input aria-label={`Dispatched quantity ${index + 1}`} value={line.qty} inputMode="decimal" disabled={pending} onChange={(event) => setLines((current) => current.map((item) => item.material_request_item_id === line.material_request_item_id ? { ...item, qty: event.target.value } : item))} />
              </label>
            </div>
          ))}
          {!lines.length && <p className="text-sm text-muted-foreground">This request has nothing left to dispatch.</p>}
        </div>}
        {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={pending || !lines.length} onClick={() => void send()}>
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            Dispatch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
