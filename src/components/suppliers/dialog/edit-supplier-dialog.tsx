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
import { editSupplier, selectSupplier, updateSupplier } from "@/lib/store/suppliers-slice";
import type { SupplierSummary } from "@/types/suppliers";

const fields = [
  ["name", "Supplier name", "Shell", true],
  ["contact_person", "Contact person", "Ada Lovelace", true],
  ["contact_email", "Email", "ada@example.com", true],
  ["contact_phone", "Phone (Optional)", "555-0100", false],
  ["contact_address", "Address (Optional)", "Manila", false],
] as const;

type Field = (typeof fields)[number][0];

export function EditSupplierDialog({
  supplierId,
  onClose,
  onSaved,
}: {
  supplierId: string;
  onClose: () => void;
  onSaved: (supplier: SupplierSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedSupplier, detailStatus, detailError, mutationStatus, mutationError } = useAppSelector(selectSupplier);
  const pending = mutationStatus === "loading";
  const supplier = selectedSupplier?.id === supplierId ? selectedSupplier : null;
  const ready = detailStatus === "succeeded" && supplier;

  useEffect(() => {
    const request = dispatch(editSupplier(supplierId));
    return () => request.abort();
  }, [dispatch, supplierId]);

  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Edit supplier</DialogTitle>
          <DialogDescription>Save the supplier name and contact details.</DialogDescription>
        </DialogHeader>
        {ready && supplier ? (
          <EditSupplierFields supplier={supplier} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editSupplier(supplierId))}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditSupplierFields({
  supplier,
  onSaved,
  onCancel,
}: {
  supplier: SupplierSummary;
  onSaved: (supplier: SupplierSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectSupplier);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [values, setValues] = useState<Record<Field, string>>({
    name: supplier.name,
    contact_person: supplier.contact_person,
    contact_email: supplier.contact_email,
    contact_phone: supplier.contact_phone,
    contact_address: supplier.contact_address,
  });
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (fields.some(([field, , , required]) => required && !values[field].trim())) {
      setError("Enter the supplier name, contact person, and email.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(updateSupplier({
        id: supplier.id,
        name: values.name.trim(),
        contact_person: values.contact_person.trim(),
        contact_email: values.contact_email.trim(),
        contact_phone: values.contact_phone.trim(),
        contact_address: values.contact_address.trim(),
      })).unwrap();
      toast.success(`${result.supplier.name} was updated successfully.`);
      onSaved(result.supplier);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the supplier."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        {fields.map(([field, label, placeholder, required]) => (
          <label key={field} className="space-y-2 text-sm font-medium">
            {label}
            <Input
              value={values[field]}
              onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
              placeholder={placeholder}
              required={required}
              maxLength={160}
            />
          </label>
        ))}
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
