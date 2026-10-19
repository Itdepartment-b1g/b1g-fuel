"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createMaterialRequest, getMaterialRequestOptions } from "@/lib/store/material-requests-slice";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestProductPicker, type SelectedMaterial } from "../request-product-picker";

export function CreateMaterialRequestDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutation } = useAppSelector((state) => state.materialRequests);
  const [hubId, setHubId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<SelectedMaterial[]>([]);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  useEffect(() => { const request = dispatch(getMaterialRequestOptions({ hub_id: hubId })); return () => request.abort(); }, [dispatch, hubId, revision]);
  const choices = options.query?.hub_id === hubId ? options.data : null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || mutation.loading || !items.length) return;
    const form = new FormData(event.currentTarget);
    busy.current = true;
    try {
      await dispatch(createMaterialRequest({ requesting_hub_id: hubId, supplying_company_id: supplierId, notes: String(form.get("notes") ?? ""), needed_at: String(form.get("needed_at") ?? "") || null, items: items.map(({ product_id, requested_qty }) => ({ product_id, requested_qty })) })).unwrap();
      toast.success("Material request draft created."); onSaved();
    } catch (error) { toast.error(toastErrorMessage(error, "Could not create the request.")); }
    finally { busy.current = false; }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.loading) onClose(); }}><DialogContent className={`max-h-[90dvh] overflow-y-auto sm:max-w-3xl ${mutation.loading ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (mutation.loading) event.preventDefault(); }} onPointerDownOutside={(event) => { if (mutation.loading) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>Create material request</DialogTitle><DialogDescription>Save a draft, then submit it to receive a request number.</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <label className="block space-y-2 text-sm">Requesting hub<select className="h-10 w-full rounded-md border px-3" required value={hubId} disabled={mutation.loading || !choices} onChange={(event) => { setHubId(event.target.value); setSupplierId(""); setItems([]); }}><option value="">Select hub</option>{choices?.hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.company.name} / {hub.name}</option>)}</select></label>
      <label className="block space-y-2 text-sm">Supplying company<select className="h-10 w-full rounded-md border px-3" required value={supplierId} disabled={mutation.loading || !choices || !hubId} onChange={(event) => { setSupplierId(event.target.value); setItems([]); }}><option value="">Select supplier</option>{choices?.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      {options.error && <p role="alert">{options.error.message} <Button type="button" variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p>}
      {choices && hubId && !choices.suppliers.length && <p className="text-sm text-muted-foreground">No active supplier links. Ask Super Admin to configure supply links for this company.</p>}
      <label className="block space-y-2 text-sm">Needed date<Input type="date" name="needed_at" disabled={mutation.loading} /></label>
      <label className="block space-y-2 text-sm">Notes<Input name="notes" maxLength={1000} disabled={mutation.loading} /></label>
      {hubId && supplierId && <RequestProductPicker key={`${hubId}-${supplierId}`} hubId={hubId} supplierId={supplierId} items={items} onChange={setItems} disabled={mutation.loading} />}
      {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.loading} onClick={onClose}>Cancel</Button><Button disabled={mutation.loading || !choices || !items.length}>Save draft</Button></div>
    </form>
  </DialogContent></Dialog>;
}
