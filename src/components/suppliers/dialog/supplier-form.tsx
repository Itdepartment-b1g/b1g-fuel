"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createSupplier, selectSupplier, updateSupplier } from "@/lib/store/suppliers-slice";
import type { SupplierSummary } from "@/types/suppliers";

const fields = [
  ["name", "Supplier name", "Shell", true],
  ["contact_person", "Contact person", "Ada Lovelace", true],
  ["contact_email", "Email", "ada@example.com", true],
  ["contact_phone", "Phone (Optional)", "555-0100", false],
  ["contact_address", "Address (Optional)", "Manila", false],
] as const;

type Field = (typeof fields)[number][0];

export function SupplierForm({
  supplier,
  onSaved,
  onCancel,
}: {
  supplier?: SupplierSummary;
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
    name: supplier?.name ?? "",
    contact_person: supplier?.contact_person ?? "",
    contact_email: supplier?.contact_email ?? "",
    contact_phone: supplier?.contact_phone ?? "",
    contact_address: supplier?.contact_address ?? "",
  });
  const [companyId, setCompanyId] = useState(supplier?.company_id ?? (options.companies.length === 1 ? options.companies[0].id : ""));
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin) && !supplier;
  const chooseCompany = !supplier && !shared && options.companies.length > 1;

  function setField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

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
    const details = {
      name: values.name.trim(),
      contact_person: values.contact_person.trim(),
      contact_email: values.contact_email.trim(),
      contact_phone: values.contact_phone.trim(),
      contact_address: values.contact_address.trim(),
    };
    try {
      const result = supplier
        ? await dispatch(updateSupplier({ id: supplier.id, ...details })).unwrap()
        : await dispatch(createSupplier({ ...(shared || !companyId ? {} : { company_id: companyId }), ...details })).unwrap();
      toast.success(`${result.supplier.name} was ${supplier ? "updated" : "created"} successfully.`);
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
            <Input value={values[field]} onChange={(event) => setField(field, event.target.value)} placeholder={placeholder} required={required} maxLength={160} />
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
        <Button type="submit" disabled={pending || (!supplier && !shared && !options.companies.length)}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : supplier ? "Save changes" : "Create supplier"}
        </Button>
      </div>
    </form>
  );
}
