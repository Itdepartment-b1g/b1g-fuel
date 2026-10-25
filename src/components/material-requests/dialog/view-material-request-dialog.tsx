"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { actionMaterialRequest, getMaterialRequest, getMaterialRequestOptions } from "@/lib/store/material-requests-slice";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialRequestDetails } from "../table-view/material-request-details";
import type { MaterialRequestAction } from "@/types/material-requests";

export function ViewMaterialRequestDialog({ requestId, initialAction = "", onClose, onEdit, onChanged }: { requestId: string; initialAction?: "approve" | "reject" | ""; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { detail, options, mutation } = useAppSelector((state) => state.materialRequests);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<MaterialRequestAction["action"] | "">(initialAction);
  const busy = useRef(false);
  const record = detail.data?.id === requestId && !detail.loading ? detail.data : null;
  const canAct = action && record?.permissions?.[action === "approve" || action === "reject" ? "review" : action];
  const warehouses = !options.loading && !options.error && options.query?.supplier_id === record?.supplying_company_id ? options.data?.warehouses ?? [] : [];
  useEffect(() => { const request = dispatch(getMaterialRequest(requestId)); return () => request.abort(); }, [dispatch, requestId, revision]);
  useEffect(() => {
    if (!record?.permissions?.review) return;
    const request = dispatch(getMaterialRequestOptions({ supplier_id: record.supplying_company_id }));
    return () => request.abort();
  }, [dispatch, record?.supplying_company_id, record?.permissions?.review]);
  async function perform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!action || !canAct || mutation.loading || busy.current) return;
    const form = new FormData(event.currentTarget);
    if (action === "approve" && !warehouses.some((warehouse) => warehouse.id === form.get("warehouse"))) {
      toast.error("Select a supplying warehouse before approving."); return;
    }
    busy.current = true;
    try {
      await dispatch(actionMaterialRequest({ id: requestId, action, note: String(form.get("note") ?? ""), ...(action === "approve" ? { supplying_warehouse_id: String(form.get("warehouse")) } : {}) })).unwrap();
      toast.success("Material request updated."); setAction(""); setRevision((value) => value + 1); onChanged();
    } catch (error) { toast.error(toastErrorMessage(error, "Could not update the request.")); }
    finally { busy.current = false; }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.loading) onClose(); }}><DialogContent className={`max-h-[90dvh] overflow-y-auto sm:max-w-4xl ${mutation.loading ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (mutation.loading) event.preventDefault(); }} onPointerDownOutside={(event) => { if (mutation.loading) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{record?.request_no ?? "Material request draft"}</DialogTitle><DialogDescription>Request details and activity timeline</DialogDescription></DialogHeader>
    {detail.error ? <p role="alert">{detail.error.message} <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p> : !record ? <p role="status">Loading request...</p> : <>
      <MaterialRequestDetails record={record} />
      <div className="flex flex-wrap gap-2">{record.permissions?.edit && <Button variant="outline" disabled={mutation.loading} onClick={onEdit}>Edit draft</Button>}
        {record.permissions?.submit && <Button disabled={mutation.loading} onClick={() => setAction("submit")}>Submit request</Button>}
        {record.permissions?.review && <><Button disabled={mutation.loading} onClick={() => setAction("approve")}>Approve</Button><Button variant="outline" disabled={mutation.loading} onClick={() => setAction("reject")}>Reject</Button></>}
        {record.permissions?.cancel && <Button variant="outline" disabled={mutation.loading} onClick={() => setAction("cancel")}>Cancel request</Button>}</div>
      {action && !canAct && <p role="alert">This request can no longer be {action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "submit" ? "submitted" : "cancelled"} with your current access.</p>}
      {action && canAct && <form key={action} onSubmit={perform} className="space-y-3 rounded-lg border p-4"><h3 className="font-medium capitalize">Confirm {action}</h3>
        {action === "approve" && <><p className="text-sm text-muted-foreground">Approval accepts all requested quantities. Materials are not dispatched yet.</p><label className="block space-y-2 text-sm">Supplying warehouse<select name="warehouse" required disabled={mutation.loading || options.loading} className="h-10 w-full rounded-md border px-3"><option value="">Select warehouse</option>{options.query?.supplier_id === record.supplying_company_id && options.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>{options.error && <p role="alert">{options.error.message} <Button type="button" variant="outline" onClick={() => dispatch(getMaterialRequestOptions({ supplier_id: record.supplying_company_id }))}>Try again</Button></p>}</>}
        <label className="block space-y-2 text-sm">Note (optional)<Input name="note" maxLength={1000} disabled={mutation.loading} /></label>
        {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={mutation.loading} onClick={() => setAction("")}>Back</Button><Button disabled={mutation.loading || (action === "approve" && !warehouses.length)}>Confirm {action}</Button></div>
      </form>}
    </>}
    <div className="flex justify-end"><Button variant="outline" disabled={mutation.loading} onClick={onClose}>Done</Button></div>
  </DialogContent></Dialog>;
}
