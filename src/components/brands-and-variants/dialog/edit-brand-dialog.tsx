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
import { editBrand, getBrandOption, selectBrand, updateBrand } from "@/lib/store/brands-slice";
import type { BrandSummary } from "@/types/brands";

export function EditBrandDialog({
  brandId,
  onClose,
  onSaved,
}: {
  brandId: string;
  onClose: () => void;
  onSaved: (brand: BrandSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedBrand, detailStatus, detailError, mutationStatus, mutationError } = useAppSelector(selectBrand);
  const pending = mutationStatus === "loading";
  const brand = selectedBrand?.id === brandId ? selectedBrand : null;
  const ready = detailStatus === "succeeded" && brand;

  useEffect(() => {
    const request = dispatch(editBrand(brandId));
    const options = dispatch(getBrandOption());
    return () => {
      request.abort();
      options.abort();
    };
  }, [dispatch, brandId]);

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
          <DialogTitle>Edit brand</DialogTitle>
          <DialogDescription>Update the brand name and the supplier that sells it.</DialogDescription>
        </DialogHeader>
        {ready && brand ? (
          <EditBrandFields brand={brand} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editBrand(brandId))}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditBrandFields({
  brand,
  onSaved,
  onCancel,
}: {
  brand: BrandSummary;
  onSaved: (brand: BrandSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectBrand);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(brand.name);
  const [supplierId, setSupplierId] = useState(brand.supplier_id ?? "");
  const suppliers = options.suppliers.filter((supplier) => !supplier.company_id || supplier.company_id === brand.company_id);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a brand name.");
      return;
    }
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(updateBrand({ id: brand.id, name: name.trim(), supplier_id: supplierId })).unwrap();
      toast.success(`${result.brand.name} was updated successfully.`);
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
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Shell" required maxLength={160} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Supplier
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
            <option value="">Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </label>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
