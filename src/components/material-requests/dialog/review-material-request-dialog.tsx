"use client";

import { useRef, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { actionMaterialRequest } from "@/lib/store/material-requests-slice";
import type { MaterialRequest } from "@/types/material-requests";

export function ReviewMaterialRequestDialog({ record, action, onClose, onSaved }: {
  record: MaterialRequest;
  action: "approve" | "reject";
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const mutation = useAppSelector((state) => state.materialRequests.mutation);
  const [acknowledged, setAcknowledged] = useState(false);
  const busy = useRef(false);
  const approving = action === "approve";
  const warehouse = record.approval_warehouse;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged || mutation.loading || busy.current || !record.permissions?.review || (approving && !warehouse)) return;
    const form = new FormData(event.currentTarget);
    busy.current = true;
    try {
      await dispatch(actionMaterialRequest({ id: record.id, action, note: String(form.get("note") ?? ""), ...(approving ? { supplying_warehouse_id: warehouse!.id } : {}) })).unwrap();
      toast.success(approving ? "Material request approved." : "Material request rejected.");
      onSaved();
    } catch (error) {
      toast.error(toastErrorMessage(error, "Could not review the request."));
    } finally { busy.current = false; }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.loading) onClose(); }}>
    <DialogContent className={mutation.loading ? "[&>button]:hidden" : ""}
      onEscapeKeyDown={(event) => { if (mutation.loading) event.preventDefault(); }}
      onPointerDownOutside={(event) => { if (mutation.loading) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>Are you sure you want to {action} this request?</DialogTitle>
        <DialogDescription>{approving
          ? "Approval accepts all requested quantities and assigns the supplying warehouse. Materials will be ready for the next fulfillment step; approval does not dispatch materials or change inventory."
          : "Rejection closes this request without approving materials or changing inventory. The requester will need to create a new request to try again."}</DialogDescription>
      </DialogHeader>
      <p className="text-sm font-medium">{record.request_no ?? "Material request"}</p>
      {approving && <p className="text-sm">Supplying warehouse: <span className="font-medium">{warehouse?.name ?? "Unavailable"}</span></p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acknowledged" required checked={acknowledged} disabled={mutation.loading} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
          <span>I have reviewed this MR and understand what will happen when I {action} it.</span>
        </label>
        <label className="block space-y-2 text-sm">Note (optional)<Input name="note" maxLength={1000} disabled={mutation.loading} /></label>
        {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        <div className="flex flex-col-reverse gap-2">
          <Button type="button" variant="outline" disabled={mutation.loading} onClick={onClose}>Back</Button>
          <Button className="w-full" type="submit" variant={approving ? "default" : "destructive"} disabled={mutation.loading || !acknowledged || (approving && !warehouse)}>{mutation.loading ? "Saving..." : approving ? "Approve request" : "Reject request"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
