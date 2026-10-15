"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editSupplier, getSupplierOption, selectSupplier } from "@/lib/store/suppliers-slice";
import type { SupplierSummary } from "@/types/suppliers";
import { SupplierForm } from "./supplier-form";

export function SupplierDialog({
  supplierId,
  onClose,
  onSaved,
}: {
  supplierId: string | null;
  onClose: () => void;
  onSaved: (supplier: SupplierSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const { selectedSupplier, detailStatus, detailError, optionsStatus, optionsError, options, mutationStatus, mutationError } = useAppSelector(selectSupplier);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = supplierId ? dispatch(editSupplier(supplierId)) : dispatch(getSupplierOption());
    return () => request.abort();
  }, [dispatch, supplierId]);
  useEffect(() => {
    if ([detailError, optionsError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);
  const ready = supplierId ? detailStatus === "succeeded" && selectedSupplier?.id === supplierId : optionsStatus === "succeeded";
  const error = supplierId ? detailError : optionsError;
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-lg ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{supplierId ? "Edit supplier" : "Create a supplier"}</DialogTitle>
          <DialogDescription>Save the supplier name and contact details.</DialogDescription>
        </DialogHeader>
        {ready ? (
          !supplierId && !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">No companies are available for creating suppliers. Ask an administrator to check your company access.</p>
          ) : (
            <SupplierForm key={supplierId ?? "create"} supplier={supplierId ? selectedSupplier! : undefined} onCancel={onClose} onSaved={onSaved} />
          )
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{error.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => supplierId ? dispatch(editSupplier(supplierId)) : dispatch(getSupplierOption())}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}
