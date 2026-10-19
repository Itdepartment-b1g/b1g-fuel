"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createCompany, selectCompany } from "@/lib/store/companies-slice";
import type { CompanySummary } from "@/types/companies";

export function CreateCompanyDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (company: CompanySummary, detail?: { locationName?: string }) => void;
}) {
  const router = useRouter();
  const { mutationStatus, mutationError } = useAppSelector(selectCompany);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    if (mutationError?.status === 401) router.replace("/login");
  }, [mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Create a company</DialogTitle>
          <DialogDescription>
            Add a company. The warehouse name and address only create a warehouse location for that company. They are not fields on the company record.
          </DialogDescription>
        </DialogHeader>
        <CreateCompanyFields onCancel={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function CreateCompanyFields({
  onSaved,
  onCancel,
}: {
  onSaved: (company: CompanySummary, detail?: { locationName?: string }) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectCompany);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [withWarehouse, setWithWarehouse] = useState(false);

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const location_name = String(form.get("location_name") ?? "").trim();
    const location_address = String(form.get("location_address") ?? "").trim();
    if (!name) {
      setError("Enter a company name.");
      return;
    }
    if (withWarehouse && !location_name) {
      setError("Enter a warehouse name.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(
        createCompany({
          name,
          ...(form.get("code") ? { code: String(form.get("code")).trim().toUpperCase() } : {}),
          ...(withWarehouse && location_name ? { location_name, location_address } : {}),
        }),
      ).unwrap();
      onSaved(result.company, { locationName: result.location?.name });
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not create the company."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={saveCompany} className="space-y-5" aria-busy={pending}>
      <label className="block space-y-2 text-sm font-medium">Company code
        <Input name="code" placeholder="BFW" maxLength={16} pattern="[A-Za-z][A-Za-z0-9]{1,15}" disabled={pending} />
        <span className="block text-xs text-muted-foreground">Unique code used in material request numbers. Required before submitting requests.</span>
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Company name <span className="text-destructive">*</span>
        <Input name="name" maxLength={160} required placeholder="B1G Fuel Manila" disabled={pending} />
      </label>
      <p className="text-xs text-muted-foreground">
        Use the name your team recognizes. Memberships can be assigned when creating users.
      </p>
      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border"
            checked={withWarehouse}
            disabled={pending}
            onChange={(event) => {
              setWithWarehouse(event.target.checked);
              setError(null);
            }}
          />
          <span>
            Does this company need a warehouse?
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Check this only when this company needs a warehouse. It adds a warehouse location. The company itself stays the company record.
            </span>
          </span>
        </label>
        {withWarehouse && (
          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Warehouse location</legend>
            <p className="text-xs text-muted-foreground">
              Saved as a location with type warehouse, linked to this company.
            </p>
            <label className="block space-y-2 text-sm font-medium">
              Warehouse name <span className="text-destructive">*</span>
              <Input name="location_name" maxLength={160} required placeholder="Central Warehouse" disabled={pending} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Warehouse address
              <Input name="location_address" maxLength={160} placeholder="Optional address" disabled={pending} />
            </label>
          </fieldset>
        )}
      </div>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button variant="outline" type="button" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Create company"}
        </Button>
      </div>
    </form>
  );
}
