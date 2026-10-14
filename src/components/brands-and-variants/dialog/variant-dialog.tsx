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
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editVariant, getVariantOption, selectVariant } from "@/lib/store/variants-slice";
import type { VariantSummary } from "@/types/variants";
import { VariantForm } from "./variant-form";

export function VariantDialog({
  variantId,
  brandId,
  onClose,
  onSaved,
}: {
  variantId: string | null;
  brandId?: string;
  onClose: () => void;
  onSaved: (variant: VariantSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const {
    selectedVariant,
    detailStatus,
    detailError,
    optionsStatus,
    optionsError,
    options,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectVariant);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = variantId ? dispatch(editVariant(variantId)) : dispatch(getVariantOption());
    return () => request.abort();
  }, [dispatch, variantId]);
  useEffect(() => {
    if ([detailError, optionsError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);
  const ready = variantId
    ? detailStatus === "succeeded" && selectedVariant?.id === variantId
    : optionsStatus === "succeeded";
  const error = variantId ? detailError : optionsError;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{variantId ? "Edit variant" : "Create a variant"}</DialogTitle>
          <DialogDescription>
            {variantId ? "Update the variant name." : "Add a variant under a brand."}
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          !variantId && !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">
              No companies are available for creating variants. Ask an administrator to check your company access.
            </p>
          ) : (
            <VariantForm
              key={variantId ?? brandId ?? "create"}
              variant={variantId ? selectedVariant! : undefined}
              brandId={brandId}
              onCancel={onClose}
              onSaved={onSaved}
            />
          )
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => (variantId ? dispatch(editVariant(variantId)) : dispatch(getVariantOption()))}
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
