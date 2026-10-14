"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createBrand, selectBrand, updateBrand } from "@/lib/store/brands-slice";
import type { BrandSummary } from "@/types/brands";

export function BrandForm({
  brand,
  onSaved,
  onCancel,
}: {
  brand?: BrandSummary;
  onSaved: (brand: BrandSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectBrand);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(brand?.name ?? "");
  const [companyId, setCompanyId] = useState(
    brand?.company_id ?? (options.companies.length === 1 ? options.companies[0].id : ""),
  );
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin) && !brand;
  const chooseCompany = !brand && !shared && options.companies.length > 1;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a brand name.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = brand
        ? await dispatch(updateBrand({ id: brand.id, name: name.trim() })).unwrap()
        : await dispatch(
            createBrand({
              ...(shared || !companyId ? {} : { company_id: companyId }),
              name: name.trim(),
            }),
          ).unwrap();
      toast.success(`${result.brand.name} was ${brand ? "updated" : "created"} successfully.`);
      onSaved(result.brand);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the brand."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="space-y-2 text-sm font-medium">
          Brand name
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Shell"
            required
            maxLength={160}
          />
        </label>
        {chooseCompany && (
          <label className="space-y-2 text-sm font-medium">
            Company
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="">Select a company</option>
              {options.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {(error || mutationError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? mutationError?.message}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || (!brand && !shared && !options.companies.length)}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : brand ? "Save changes" : "Create brand"}
        </Button>
      </div>
    </form>
  );
}
