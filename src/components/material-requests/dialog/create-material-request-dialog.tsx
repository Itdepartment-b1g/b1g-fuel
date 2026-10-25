"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createMaterialRequest, getMaterialRequestOptions } from "@/lib/store/material-requests-slice";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequestProductPicker, type SelectedMaterial } from "../request-product-picker";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";

export function CreateMaterialRequestDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const access = useRecordAccess();
  const { options, mutation } = useAppSelector((state) => state.materialRequests);
  const [hubId, setHubId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<SelectedMaterial[]>([]);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  useEffect(() => { const request = dispatch(getMaterialRequestOptions({ hub_id: hubId })); return () => request.abort(); }, [dispatch, hubId, revision]);
  const choices = options.query?.hub_id === hubId ? options.data : null;
  const assignedHubs = choices?.hubs ?? [];
  const onlyHubId = assignedHubs.length === 1 ? assignedHubs[0].id : "";
  useEffect(() => { if (onlyHubId && hubId !== onlyHubId) setHubId(onlyHubId); }, [onlyHubId, hubId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || mutation.loading || !items.length) return;
    const form = new FormData(event.currentTarget);
    const submit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "submit";
    busy.current = true;
    try {
      await dispatch(createMaterialRequest({ requesting_hub_id: hubId, supplying_company_id: supplierId, submit, notes: String(form.get("notes") ?? ""), needed_at: String(form.get("needed_at") ?? "") || null, items: items.map(({ product_id, requested_qty }) => ({ product_id, requested_qty })) })).unwrap();
      toast.success(submit ? "Material request submitted." : "Material request draft saved."); onSaved();
    } catch (error) { toast.error(toastErrorMessage(error, "Could not create the request.")); }
    finally { busy.current = false; }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.loading) onClose(); }}><DialogContent className={`max-h-[90dvh] overflow-x-hidden overflow-y-auto sm:max-w-3xl [&>*]:min-w-0 ${mutation.loading ? "[&>button]:hidden" : ""}`} onEscapeKeyDown={(event) => { if (mutation.loading) event.preventDefault(); }} onPointerDownOutside={(event) => { if (mutation.loading) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>Create material request</DialogTitle><DialogDescription>Save as draft to continue later, or submit now for review and receive a request number.</DialogDescription></DialogHeader>
    <form onSubmit={save} className="min-w-0 space-y-4">
      <div className="space-y-1 text-sm">{assignedHubs.length === 1 ? <><p className="font-medium">Your currently assigned hub</p><p>{assignedHubs[0].company.name} / {assignedHubs[0].name}</p><p className="text-muted-foreground">This request uses the hub you are assigned to.</p></> : assignedHubs.length > 1 ? <><p className="font-medium">Your currently assigned hubs</p><p className="text-muted-foreground">Choose one of the hubs you are assigned to.</p><select className="h-10 w-full rounded-md border px-3" required aria-label="Your assigned hubs" value={hubId} disabled={mutation.loading} onChange={(event) => { setHubId(event.target.value); setSupplierId(""); setItems([]); }}><option value="">Select your hub</option>{assignedHubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.company.name} / {hub.name}</option>)}</select></> : choices ? <p>You are not assigned to a hub. Ask an administrator to assign you before creating a request.</p> : <p role="status">Loading your hub...</p>}</div>
      <label className="block space-y-2 text-sm">Supplying company<select className="h-10 w-full rounded-md border px-3" required value={supplierId} disabled={mutation.loading || !choices || !hubId} onChange={(event) => { setSupplierId(event.target.value); setItems([]); }}><option value="">Select supplier</option>{choices?.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      {options.error && <p role="alert">{options.error.message} <Button type="button" variant="outline" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p>}
      {choices && hubId && !choices.suppliers.length && <p className="text-sm text-muted-foreground">No active supplier links. Ask Super Admin to configure supply links for this company.</p>}
      <label className="block space-y-2 text-sm">Needed date<Input type="date" name="needed_at" disabled={mutation.loading} /></label>
      <label className="block space-y-2 text-sm">Notes<Input name="notes" maxLength={1000} disabled={mutation.loading} /></label>
      {hubId && supplierId && <RequestProductPicker key={`${hubId}-${supplierId}`} hubId={hubId} supplierId={supplierId} items={items} onChange={setItems} disabled={mutation.loading} />}
      {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.loading} onClick={onClose}>Cancel</Button><Button type="submit" name="intent" value="draft" variant="outline" disabled={mutation.loading || !choices || !items.length}>Save as draft</Button><Button type="submit" name="intent" value="submit" disabled={mutation.loading || !choices || !items.length || !canPerform(access, "materialRequests", "edit")}>Submit request</Button></div>
    </form>
  </DialogContent></Dialog>;
}
