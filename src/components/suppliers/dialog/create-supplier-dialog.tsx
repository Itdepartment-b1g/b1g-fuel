"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createSupplier, getSupplierOption, selectSupplier } from "@/lib/store/suppliers-slice";
import type { SupplierSummary } from "@/types/suppliers";

const fields = [
  ["name", "Supplier name", "Shell", true],
  ["contact_person", "Contact person", "Ada Lovelace", true],
  ["contact_email", "Email", "ada@example.com", true],
  ["contact_phone", "Phone (Optional)", "555-0100", false],
  ["contact_address", "Address (Optional)", "Manila", false],
] as const;

type Field = (typeof fields)[number][0];

export function CreateSupplierDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (supplier: SupplierSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const { optionsStatus, optionsError, options, mutationStatus, mutationError } = useAppSelector(selectSupplier);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    const request = dispatch(getSupplierOption());
    return () => request.abort();
  }, [dispatch]);

  useEffect(() => {
    if ([optionsError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [optionsError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Create a supplier</DialogTitle>
          <DialogDescription>Save the supplier name and contact details.</DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? (
          !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">No companies are available for creating suppliers. Ask an administrator to check your company access.</p>
          ) : (
            <CreateSupplierFields onCancel={onClose} onSaved={onSaved} />
          )
        ) : optionsError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{optionsError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(getSupplierOption())}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateSupplierFields({
  onSaved,
  onCancel,
}: {
  onSaved: (supplier: SupplierSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectSupplier);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    contact_person: "",
    contact_email: "",
    contact_phone: "",
    contact_address: "",
  });
  const [companyId, setCompanyId] = useState(options.companies.length === 1 ? options.companies[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin);
  const chooseCompany = !shared && options.companies.length > 1;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (fields.some(([field, , , required]) => required && !values[field].trim())) {
      setError("Enter the supplier name, contact person, and email.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(createSupplier({
        ...(shared || !companyId ? {} : { company_id: companyId }),
        name: values.name.trim(),
        contact_person: values.contact_person.trim(),
        contact_email: values.contact_email.trim(),
        contact_phone: values.contact_phone.trim(),
        contact_address: values.contact_address.trim(),
      })).unwrap();
      toast.success(`${result.supplier.name} was created successfully.`);
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
        {chooseCompany && (
          <label className="space-y-2 text-sm font-medium">
            Company
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Select a company</option>
              {options.companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending || (!shared && !options.companies.length)}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Create supplier"}
        </Button>
      </div>
    </form>
  );
}
