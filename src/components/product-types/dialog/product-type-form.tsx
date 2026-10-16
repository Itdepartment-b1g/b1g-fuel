"use client";

import { useRef, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  createProductType,
  selectProductType,
  updateProductType,
} from "@/lib/store/product-types-slice";
import type { ProductTypeSummary } from "@/types/product-types";

export function ProductTypeForm({
  productType,
  onSaved,
  onCancel,
}: {
  productType?: ProductTypeSummary;
  onSaved: (row: ProductTypeSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } =
    useAppSelector(selectProductType);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(productType?.name ?? "");
  const [key, setKey] = useState(productType?.key ?? "");
  const [companyId, setCompanyId] = useState(
    productType?.company_id ??
      (options.companies.length === 1 ? options.companies[0].id : ""),
  );
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin) && !productType;
  const chooseCompany = !productType && !shared && options.companies.length > 1;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a product type name.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = productType
        ? await dispatch(
            updateProductType({
              id: productType.id,
              name: name.trim(),
              key: key.trim() || name.trim(),
            }),
          ).unwrap()
        : await dispatch(
            createProductType({
              name: name.trim(),
              key: key.trim() || name.trim(),
              ...(shared || !companyId ? {} : { company_id: companyId }),
            }),
          ).unwrap();
      toast.success(
        `${result.product_type.name} was ${productType ? "updated" : "created"} successfully.`,
      );
      onSaved(result.product_type);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the product type."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="block space-y-2 text-sm font-medium">
          Name <span className="text-destructive">*</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New"
            required
            maxLength={160}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Key
          <Input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="new (optional — derived from name)"
            maxLength={64}
          />
        </label>
        {chooseCompany && (
          <label className="block space-y-2 text-sm font-medium">
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
          disabled={
            pending || (!productType && !shared && !options.companies.length)
          }
        >
          {pending && (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          )}
          {pending
            ? "Saving…"
            : productType
              ? "Save changes"
              : "Create product type"}
        </Button>
      </div>
    </form>
  );
}
