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
import {
  editMeasurement,
  getMeasurementOption,
  selectMeasurement,
} from "@/lib/store/measurements-slice";
import type { MeasurementSummary } from "@/types/measurements";
import { MeasurementForm } from "./measurement-form";

export function MeasurementDialog({
  measurementId,
  onClose,
  onSaved,
}: {
  measurementId: string | null;
  onClose: () => void;
  onSaved: (measurement: MeasurementSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const {
    selectedMeasurement,
    detailStatus,
    detailError,
    optionsStatus,
    optionsError,
    options,
    mutationStatus,
    mutationError,
  } = useAppSelector(selectMeasurement);
  const pending = mutationStatus === "loading";
  useEffect(() => {
    const request = measurementId
      ? dispatch(editMeasurement(measurementId))
      : dispatch(getMeasurementOption());
    return () => request.abort();
  }, [dispatch, measurementId]);
  useEffect(() => {
    if (
      [detailError, optionsError, mutationError].some(
        (error) => error?.status === 401,
      )
    )
      router.replace("/login");
  }, [detailError, optionsError, mutationError, router]);
  const ready = measurementId
    ? detailStatus === "succeeded" && selectedMeasurement?.id === measurementId
    : optionsStatus === "succeeded";
  const error = measurementId ? detailError : optionsError;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-3xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {measurementId ? "Edit measurement" : "Create a measurement"}
          </DialogTitle>
          <DialogDescription>
            Name the measurement and add the units people can choose.
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          !measurementId && !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">
              No companies are available for creating measurements. Ask an
              administrator to check your company access.
            </p>
          ) : (
            <MeasurementForm
              key={measurementId ?? "create"}
              measurement={measurementId ? selectedMeasurement! : undefined}
              onCancel={onClose}
              onSaved={onSaved}
            />
          )
        ) : error ? (
          <div>
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() =>
                measurementId
                  ? dispatch(editMeasurement(measurementId))
                  : dispatch(getMeasurementOption())
              }
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
