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
import { createHub, getHubOption, selectHub } from "@/lib/store/hubs-slice";
import type { HubSummary } from "@/types/hubs";

type Props = { onClose: () => void; onSaved: (hub: HubSummary) => void };
export function CreateHubDialog({ onClose, onSaved }: Props) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { optionsStatus, optionsError, options, mutationStatus, mutationError } = useAppSelector(selectHub);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = dispatch(getHubOption());
    return () => request.abort();
  }, [dispatch]);
  useEffect(() => {
    if ([optionsError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [optionsError, mutationError, router]);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className={`max-h-[90dvh] overflow-y-auto ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Create hub</DialogTitle>
          <DialogDescription>Add a hub to your company, then assign its staff.</DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? options.companies.length ? (
          <CreateHubFields onSaved={onSaved} onCancel={onClose} />
        ) : <p role="status" className="text-sm text-muted-foreground">No companies are available. Ask an administrator to check your hub access.</p>
        : optionsError ? <div>
          <p role="alert" className="text-sm text-destructive">{optionsError.message}</p>
          <Button variant="outline" className="mt-3" onClick={() => dispatch(getHubOption())}>Try again</Button>
        </div> : <Loading />}
      </DialogContent>
    </Dialog>
  );
}

export function CreateHubFields({ onSaved, onCancel }: { onSaved: Props["onSaved"]; onCancel: () => void }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectHub);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [companyId, setCompanyId] = useState(options.companies.length === 1 ? options.companies[0].id : "");
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || pending) return;
    if (!name.trim() || !companyId) { setError(!name.trim() ? "Enter a hub name." : "Select a company."); return; }
    busy.current = true;
    setError(null);
    try {
      const { hub } = await dispatch(createHub({ name: name.trim(), address: address.trim(), company_id: companyId })).unwrap();
      toast.success(`${hub.name} was created.`);
      onSaved(hub);
    } catch (failure) { toast.error(toastErrorMessage(failure, "Could not create the hub.")); }
    finally { busy.current = false; }
  }
  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        {options.companies.length === 1 ? <div className="text-sm"><p className="font-medium">Company</p><p className="mt-1 text-muted-foreground">{options.companies[0].name}</p></div> : (
          <label className="block space-y-2 text-sm font-medium">Company
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} required className="h-10 w-full rounded-md border bg-white px-3">
              <option value="">Select a company</option>
              {options.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
        )}
        <label className="block space-y-2 text-sm font-medium">Hub name
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="North Hub" required maxLength={160} />
        </label>
        <label className="block space-y-2 text-sm font-medium">Address <span className="font-normal text-muted-foreground">(optional)</span>
          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city" maxLength={160} />
        </label>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending || !options.companies.length}>{pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Creating..." : "Create hub"}</Button>
      </div>
    </form>
  );
}
