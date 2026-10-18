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
import { editHub, selectHub, updateHub } from "@/lib/store/hubs-slice";
import type { HubSummary } from "@/types/hubs";

export function EditHubDialog({ hubId, onClose, onSaved }: { hubId: string; onClose: () => void; onSaved: (hub: HubSummary) => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedHub, detailStatus, detailError, mutationStatus, mutationError } = useAppSelector(selectHub);
  const pending = mutationStatus === "loading";
  const hub = detailStatus === "succeeded" && selectedHub?.id === hubId ? selectedHub : null;
  useEffect(() => {
    const request = dispatch(editHub(hubId));
    return () => request.abort();
  }, [dispatch, hubId]);
  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, router]);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Edit hub</DialogTitle><DialogDescription>Update the hub details and active status.</DialogDescription></DialogHeader>
        {hub ? <EditHubFields key={hub.id} hub={hub} onCancel={onClose} onSaved={onSaved} /> : detailError ? (
          <div><p role="alert" className="text-sm text-destructive">{detailError.message}</p><Button variant="outline" className="mt-3" onClick={() => dispatch(editHub(hubId))}>Try again</Button></div>
        ) : <Loading />}
      </DialogContent>
    </Dialog>
  );
}

export function EditHubFields({ hub, onSaved, onCancel }: { hub: HubSummary; onSaved: (hub: HubSummary) => void; onCancel: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectHub);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(hub.name);
  const [address, setAddress] = useState(hub.address);
  const [active, setActive] = useState(hub.is_active);
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || pending) return;
    if (!name.trim()) { setError("Enter a hub name."); return; }
    busy.current = true;
    setError(null);
    try {
      const { hub: saved } = await dispatch(updateHub({ id: hub.id, name: name.trim(), address: address.trim(), is_active: active })).unwrap();
      toast.success(`${saved.name} was updated.`);
      onSaved(saved);
    } catch (failure) { toast.error(toastErrorMessage(failure, "Could not update the hub.")); }
    finally { busy.current = false; }
  }
  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <div className="text-sm"><p className="font-medium">Company</p><p className="mt-1 text-muted-foreground">{hub.company.name}</p></div>
        <label className="block space-y-2 text-sm font-medium">Hub name<Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} /></label>
        <label className="block space-y-2 text-sm font-medium">Address<Input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={160} /></label>
        <label className="block space-y-2 text-sm font-medium">Status
          <select value={active ? "active" : "inactive"} onChange={(event) => setActive(event.target.value === "active")} className="h-10 w-full rounded-md border bg-white px-3">
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Inactive hubs keep their staff assignments and cannot receive new assignments.</p>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Saving..." : "Save changes"}</Button>
      </div>
    </form>
  );
}
