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
import { createVariant, getVariantOption, selectVariant } from "@/lib/store/variants-slice";
import type { VariantSummary } from "@/types/variants";

export function CreateVariantDialog({
  brandId,
  onClose,
  onSaved,
}: {
  brandId?: string;
  onClose: () => void;
  onSaved: (variant: VariantSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const { optionsStatus, optionsError, options, mutationStatus, mutationError } = useAppSelector(selectVariant);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    const request = dispatch(getVariantOption());
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
          <DialogTitle>Create a variant</DialogTitle>
          <DialogDescription>Add a variant under a brand.</DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? (
          !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">
              No companies are available for creating variants. Ask an administrator to check your company access.
            </p>
          ) : (
            <CreateVariantFields brandId={brandId} onCancel={onClose} onSaved={onSaved} />
          )
        ) : optionsError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{optionsError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(getVariantOption())}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateVariantFields({
  brandId,
  onSaved,
  onCancel,
}: {
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
  const [name, setName] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState(brandId ?? "");
  const [companyId, setCompanyId] = useState(options.companies.length === 1 ? options.companies[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const shared = Boolean(access?.superAdmin);
  const chooseCompany = !shared && options.companies.length > 1;
  const chooseBrand = !brandId;

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
      const result = await dispatch(createVariant({
        brand_id: selectedBrandId,
        ...(shared || !companyId ? {} : { company_id: companyId }),
        name: name.trim(),
      })).unwrap();
      toast.success(`${result.variant.name} was created successfully.`);
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
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Diesel" required maxLength={160} />
        </label>
        {chooseBrand && (
          <label className="space-y-2 text-sm font-medium">
            Brand
            <select value={selectedBrandId} onChange={(event) => setSelectedBrandId(event.target.value)} required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">Select a brand</option>
              {options.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </label>
        )}
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
        <Button type="submit" disabled={pending || (!shared && !options.companies.length) || (chooseBrand && !options.brands.length)}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Create variant"}
        </Button>
      </div>
    </form>
  );
}
