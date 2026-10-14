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
import { editBrand, getBrandOption, selectBrand } from "@/lib/store/brands-slice";
import type { BrandSummary } from "@/types/brands";
import { BrandForm } from "./brand-form";

export function BrandDialog({
  brandId,
  onClose,
  onSaved,
}: {
  brandId: string | null;
  onClose: () => void;
  onSaved: (brand: BrandSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const {
    selectedBrand,
    detailStatus,
    detailError,
    optionsStatus,
    optionsError,
    options,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectBrand);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = brandId ? dispatch(editBrand(brandId)) : dispatch(getBrandOption());
    return () => request.abort();
  }, [dispatch, brandId]);
  useEffect(() => {
    if ([detailError, optionsError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);
  const ready = brandId
    ? detailStatus === "succeeded" && selectedBrand?.id === brandId
    : optionsStatus === "succeeded";
  const error = brandId ? detailError : optionsError;
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
          <DialogTitle>{brandId ? "Edit brand" : "Create a brand"}</DialogTitle>
          <DialogDescription>
            {brandId ? "Update the brand name." : "Name the brand people will use for variants."}
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          !brandId && !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">
              No companies are available for creating brands. Ask an administrator to check your company access.
            </p>
          ) : (
            <BrandForm
              key={brandId ?? "create"}
              brand={brandId ? selectedBrand! : undefined}
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
              onClick={() => (brandId ? dispatch(editBrand(brandId)) : dispatch(getBrandOption()))}
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
