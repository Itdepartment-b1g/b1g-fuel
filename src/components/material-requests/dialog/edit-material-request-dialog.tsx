"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { getMaterialRequest, updateMaterialRequest } from "@/lib/store/material-requests-slice";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MaterialRequest } from "@/types/material-requests";
import { RequestProductPicker, type SelectedMaterial } from "../request-product-picker";

export function EditMaterialRequestDialog({ requestId, onClose, onSaved }: { requestId: string; onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const { detail, mutation } = useAppSelector((state) => state.materialRequests);
  const [revision, setRevision] = useState(0);
  useEffect(() => { const request = dispatch(getMaterialRequest(requestId)); return () => request.abort(); }, [dispatch, requestId, revision]);
  const record = detail.data?.id === requestId && !detail.loading ? detail.data : null;
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.loading) onClose(); }}><DialogContent className={`max-h-[90dvh] overflow-y-auto sm:max-w-3xl ${mutation.loading ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (mutation.loading) event.preventDefault(); }} onPointerDownOutside={(event) => { if (mutation.loading) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>Edit material request draft</DialogTitle><DialogDescription>Update materials, quantities, notes, and the needed date.</DialogDescription></DialogHeader>
    {detail.error ? <p role="alert">{detail.error.message} <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p> : !record ? <p role="status">Loading request...</p> : !record.permissions?.edit ? <p>This request cannot be edited.</p> : <EditMaterialRequestFields key={record.updated_at} record={record} onClose={onClose} onSaved={onSaved} />}
  </DialogContent></Dialog>;
}
function EditMaterialRequestFields({ record, onClose, onSaved }: { record: MaterialRequest; onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const mutation = useAppSelector((state) => state.materialRequests.mutation);
  const busy = useRef(false);
  const [items, setItems] = useState<SelectedMaterial[]>(() => record.items.map((item) => ({ product_id: item.product_id, label: item.product_label, unit_label: item.unit_label, requested_qty: item.requested_qty })));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || mutation.loading || !items.length) return;
    busy.current = true;
    const form = new FormData(event.currentTarget);
    try {
      await dispatch(updateMaterialRequest({ id: record.id, input: { requesting_hub_id: record.requesting_hub_id, supplying_company_id: record.supplying_company_id, notes: String(form.get("notes") ?? ""), needed_at: String(form.get("needed_at") ?? "") || null, items: items.map(({ product_id, requested_qty }) => ({ product_id, requested_qty })) } })).unwrap();
      toast.success("Material request draft updated."); onSaved();
    } catch (error) { toast.error(toastErrorMessage(error, "Could not update the draft.")); }
    finally { busy.current = false; }
  }
  const neededDate = record.needed_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(record.needed_at)) : "";
  return <form className="space-y-4" onSubmit={save}>
    <p className="text-sm">{record.requesting_hub.name} → {record.supplying_company.name}</p>
    <label className="block space-y-2 text-sm">Needed date<Input type="date" name="needed_at" defaultValue={neededDate} disabled={mutation.loading} /></label>
    <label className="block space-y-2 text-sm">Notes<Input name="notes" defaultValue={record.notes} maxLength={1000} disabled={mutation.loading} /></label>
    <RequestProductPicker hubId={record.requesting_hub_id} supplierId={record.supplying_company_id} items={items} onChange={setItems} disabled={mutation.loading} />
    {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.loading} onClick={onClose}>Cancel</Button><Button disabled={mutation.loading || !items.length}>Save changes</Button></div>
  </form>;
}
