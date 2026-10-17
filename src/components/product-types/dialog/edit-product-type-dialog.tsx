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
import { editProductType, selectProductType, updateProductType } from "@/lib/store/product-types-slice";
import type { ProductTypeSummary } from "@/types/product-types";

export function EditProductTypeDialog({
  productTypeId,
  onClose,
  onSaved,
}: {
  productTypeId: string;
  onClose: () => void;
  onSaved: (row: ProductTypeSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedProductType, detailStatus, detailError, mutationStatus, mutationError } = useAppSelector(selectProductType);
  const pending = mutationStatus === "loading";
  const productType = selectedProductType?.id === productTypeId ? selectedProductType : null;
  const ready = detailStatus === "succeeded" && productType;

  useEffect(() => {
    const request = dispatch(editProductType(productTypeId));
    return () => request.abort();
  }, [dispatch, productTypeId]);

  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Edit product type</DialogTitle>
          <DialogDescription>Types such as New and Refill are used when creating products.</DialogDescription>
        </DialogHeader>
        {ready && productType ? (
          <EditProductTypeFields productType={productType} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editProductType(productTypeId))}>
              Try again
            </Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditProductTypeFields({
  productType,
  onSaved,
  onCancel,
}: {
  productType: ProductTypeSummary;
  onSaved: (row: ProductTypeSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectProductType);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const [name, setName] = useState(productType.name);
  const [key, setKey] = useState(productType.key);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a product type name.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(updateProductType({
        id: productType.id,
        name: name.trim(),
        key: key.trim() || name.trim(),
      })).unwrap();
      toast.success(`${result.product_type.name} was updated successfully.`);
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
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New" required maxLength={160} />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Key
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="new (optional — derived from name)" maxLength={64} />
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
