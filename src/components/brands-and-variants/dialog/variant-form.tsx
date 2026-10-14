"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createVariant, selectVariant, updateVariant } from "@/lib/store/variants-slice";
import type { VariantSummary } from "@/types/variants";

export function VariantForm({
  variant,
  brandId,
  onSaved,
  onCancel,
}: {
  variant?: VariantSummary;
  brandId?: string;
  onSaved: (variant: VariantSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectVariant);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(variant?.name ?? "");
  const [selectedBrandId, setSelectedBrandId] = useState(variant?.brand_id ?? brandId ?? "");
  const [companyId, setCompanyId] = useState(
    variant?.company_id ?? (options.companies.length === 1 ? options.companies[0].id : ""),
  );
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin) && !variant;
  const chooseCompany = !variant && !shared && options.companies.length > 1;
  const chooseBrand = !variant && !brandId;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a variant name.");
      return;
    }
    if (chooseBrand && !selectedBrandId) {
      setError("Select a brand.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = variant
        ? await dispatch(updateVariant({ id: variant.id, name: name.trim() })).unwrap()
        : await dispatch(
            createVariant({
              brand_id: selectedBrandId,
              ...(shared || !companyId ? {} : { company_id: companyId }),
              name: name.trim(),
            }),
          ).unwrap();
      toast.success(`${result.variant.name} was ${variant ? "updated" : "created"} successfully.`);
      onSaved(result.variant);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the variant."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="space-y-2 text-sm font-medium">
          Variant name
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Diesel"
            required
            maxLength={160}
          />
        </label>
        {chooseBrand && (
          <label className="space-y-2 text-sm font-medium">
            Brand
            <select
              value={selectedBrandId}
              onChange={(event) => setSelectedBrandId(event.target.value)}
              required
              className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="">Select a brand</option>
              {options.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
        )}
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
        <Button
          type="submit"
          disabled={pending || (!variant && !shared && !options.companies.length) || (chooseBrand && !options.brands.length)}
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : variant ? "Save changes" : "Create variant"}
        </Button>
      </div>
    </form>
  );
}
