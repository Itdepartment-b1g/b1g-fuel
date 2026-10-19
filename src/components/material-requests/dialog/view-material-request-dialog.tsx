"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { actionMaterialRequest, getMaterialRequest, getMaterialRequestOptions } from "@/lib/store/material-requests-slice";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableView } from "@/components/common/table/table-view";
import { formatDateTime } from "@/utils/date";
import type { MaterialRequestAction } from "@/types/material-requests";

export function ViewMaterialRequestDialog({ requestId, onClose, onEdit, onChanged }: { requestId: string; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { detail, options, mutation } = useAppSelector((state) => state.materialRequests);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<MaterialRequestAction["action"] | "">("");
  const busy = useRef(false);
  const record = detail.data?.id === requestId && !detail.loading ? detail.data : null;
  useEffect(() => { const request = dispatch(getMaterialRequest(requestId)); return () => request.abort(); }, [dispatch, requestId, revision]);
  useEffect(() => {
    if (!record?.permissions?.review) return;
    const request = dispatch(getMaterialRequestOptions({ supplier_id: record.supplying_company_id }));
    return () => request.abort();
  }, [dispatch, record?.supplying_company_id, record?.permissions?.review]);
  async function perform(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!action || mutation.loading || busy.current) return;
    const form = new FormData(event.currentTarget); busy.current = true;
    try {
      await dispatch(actionMaterialRequest({ id: requestId, action, note: String(form.get("note") ?? ""), ...(action === "approve" ? { supplying_warehouse_id: String(form.get("warehouse")) } : {}) })).unwrap();
      toast.success("Material request updated."); setAction(""); setRevision((value) => value + 1); onChanged();
    } catch (error) { toast.error(toastErrorMessage(error, "Could not update the request.")); }
    finally { busy.current = false; }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.loading) onClose(); }}><DialogContent className={`max-h-[90dvh] overflow-y-auto sm:max-w-4xl ${mutation.loading ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (mutation.loading) event.preventDefault(); }} onPointerDownOutside={(event) => { if (mutation.loading) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{record?.request_no ?? "Material request draft"}</DialogTitle><DialogDescription>Request details and activity timeline</DialogDescription></DialogHeader>
    {detail.error ? <p role="alert">{detail.error.message} <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p> : !record ? <p role="status">Loading request...</p> : <>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Requesting company / hub</dt><dd>{record.requesting_company.name} / {record.requesting_hub.name}</dd></div><div><dt className="text-muted-foreground">Supplying company / warehouse</dt><dd>{record.supplying_company.name} / {record.supplying_warehouse?.name ?? "Awaiting assignment"}</dd></div><div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{record.status}</dd></div><div><dt className="text-muted-foreground">Needed date</dt><dd>{record.needed_at ? formatDateTime(record.needed_at) : "Not specified"}</dd></div></dl>
      {record.notes && <p className="text-sm">{record.notes}</p>}
      <TableView data={record.items} rowKey={(item) => item.id} caption="Requested materials" sortingMode="server" columns={[
        { id: "product", header: "Material", value: (item) => item.product_label }, { id: "unit", header: "Unit", value: (item) => item.unit_label },
        { id: "requested", header: "Requested", value: (item) => item.requested_qty }, { id: "approved", header: "Approved", value: (item) => item.approved_qty ?? "—" },
      ]} />
      <div className="flex flex-wrap gap-2">{record.permissions?.edit && <Button variant="outline" disabled={mutation.loading} onClick={onEdit}>Edit draft</Button>}
        {record.permissions?.submit && <Button disabled={mutation.loading} onClick={() => setAction("submit")}>Submit request</Button>}
        {record.permissions?.review && <><Button disabled={mutation.loading} onClick={() => setAction("approve")}>Approve</Button><Button variant="outline" disabled={mutation.loading} onClick={() => setAction("reject")}>Reject</Button></>}
        {record.permissions?.cancel && <Button variant="outline" disabled={mutation.loading} onClick={() => setAction("cancel")}>Cancel request</Button>}</div>
      {action && <form onSubmit={perform} className="space-y-3 rounded-lg border p-4"><h3 className="font-medium capitalize">Confirm {action}</h3>
        {action === "approve" && <><p className="text-sm text-muted-foreground">Approval accepts all requested quantities. Materials are not dispatched yet.</p><label className="block space-y-2 text-sm">Supplying warehouse<select name="warehouse" required disabled={mutation.loading || options.loading} className="h-10 w-full rounded-md border px-3"><option value="">Select warehouse</option>{options.query?.supplier_id === record.supplying_company_id && options.data?.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>{options.error && <p role="alert">{options.error.message} <Button type="button" variant="outline" onClick={() => dispatch(getMaterialRequestOptions({ supplier_id: record.supplying_company_id }))}>Try again</Button></p>}</>}
        <label className="block space-y-2 text-sm">{action === "reject" ? "Reason (required)" : "Note (optional)"}<Input name="note" maxLength={1000} required={action === "reject"} disabled={mutation.loading} /></label>
        {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={mutation.loading} onClick={() => setAction("")}>Back</Button><Button disabled={mutation.loading}>Confirm</Button></div>
      </form>}
      <section className="space-y-3 border-t pt-4"><h2 className="font-semibold">Timeline</h2><ol className="space-y-3">{record.events.map((event) => <li key={event.id} className="border-l-2 pl-4 text-sm"><p><span className="font-medium">{event.created_by_name ?? "Unavailable user"}</span> <span>{event.kind}</span></p><time className="text-xs text-muted-foreground" dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>{event.note && <p className="mt-1">{event.note}</p>}</li>)}</ol></section>
    </>}
    <div className="flex justify-end"><Button variant="outline" disabled={mutation.loading} onClick={onClose}>Done</Button></div>
  </DialogContent></Dialog>;
}
