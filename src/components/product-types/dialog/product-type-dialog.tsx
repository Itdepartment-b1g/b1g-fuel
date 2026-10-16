"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  editProductType,
  getProductTypeOption,
  selectProductType,
} from "@/lib/store/product-types-slice";
import type { ProductTypeSummary } from "@/types/product-types";
import { ProductTypeForm } from "./product-type-form";

export function ProductTypeDialog({
  productTypeId,
  onClose,
  onSaved,
}: {
  productTypeId: string | null;
  onClose: () => void;
  onSaved: (row: ProductTypeSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    selectedProductType,
    detailStatus,
    detailError,
    optionsStatus,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectProductType);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = productTypeId
      ? dispatch(editProductType(productTypeId))
      : dispatch(getProductTypeOption());
    return () => request.abort();
  }, [dispatch, productTypeId]);
  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [detailError, mutationError, router]);
  const ready = productTypeId
    ? detailStatus === "succeeded" &&
      selectedProductType?.id === productTypeId
    : optionsStatus === "succeeded";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`w-[calc(100%_-_2rem)] ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {productTypeId ? "Edit product type" : "Create product type"}
          </DialogTitle>
          <DialogDescription>
            Types such as New and Refill are used when creating products.
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <ProductTypeForm
            key={productTypeId ?? "create"}
            productType={productTypeId ? selectedProductType! : undefined}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {detailError.message}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => dispatch(editProductType(productTypeId!))}
            >
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
