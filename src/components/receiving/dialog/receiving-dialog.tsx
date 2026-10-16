"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editReceiving, getReceivingOption, selectReceiving } from "@/lib/store/receiving-slice";
import type { ReceivingSummary } from "@/types/receiving";
import { ReceivingForm } from "./receiving-form";

export function ReceivingDialog({
  receivingId,
  onClose,
  onSaved,
}: {
  receivingId: string | null;
  onClose: () => void;
  onSaved: (row: ReceivingSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedReceiving, detailStatus, detailError, optionsStatus, optionsError, mutationStatus, mutationError } =
    useAppSelector(selectReceiving);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const options = dispatch(getReceivingOption());
    const detail = receivingId ? dispatch(editReceiving(receivingId)) : null;
    return () => {
      options.abort();
      detail?.abort();
    };
  }, [dispatch, receivingId]);
  useEffect(() => {
    if ([detailError, optionsError, mutationError].some((error) => error?.status === 401))
      router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);
  const ready =
    optionsStatus === "succeeded" &&
    (receivingId ? detailStatus === "succeeded" && selectedReceiving?.id === receivingId : true);
  const error = optionsError ?? (receivingId ? detailError : null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-3xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{receivingId ? "Receipt" : "Receive a purchase order"}</DialogTitle>
          <DialogDescription>
            Record what arrived at the warehouse. Posting updates the purchase order. A draft does not.
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <ReceivingForm
            key={receivingId ?? "create"}
            receipt={receivingId ? selectedReceiving! : undefined}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                dispatch(getReceivingOption());
                if (receivingId) dispatch(editReceiving(receivingId));
              }}
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
