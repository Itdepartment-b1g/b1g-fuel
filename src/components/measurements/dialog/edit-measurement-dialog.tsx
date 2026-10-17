"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { editMeasurement, selectMeasurement, updateMeasurement } from "@/lib/store/measurements-slice";
import { prepareMeasurementEntries } from "@/utils/measurement-form";
import type { MeasurementSummary, MeasurementUnitInput } from "@/types/measurements";

type UnitRow = MeasurementUnitInput & { rowId: string };

export function EditMeasurementDialog({
  measurementId,
  onClose,
  onSaved,
}: {
  measurementId: string;
  onClose: () => void;
  onSaved: (measurement: MeasurementSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { selectedMeasurement, detailStatus, detailError, mutationStatus, mutationError } = useAppSelector(selectMeasurement);
  const pending = mutationStatus === "loading";
  const measurement = selectedMeasurement?.id === measurementId ? selectedMeasurement : null;
  const ready = detailStatus === "succeeded" && measurement;

  useEffect(() => {
    const request = dispatch(editMeasurement(measurementId));
    return () => request.abort();
  }, [dispatch, measurementId]);

  useEffect(() => {
    if ([detailError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [detailError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-3xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Edit measurement</DialogTitle>
          <DialogDescription>Name the measurement and add the units people can choose.</DialogDescription>
        </DialogHeader>
        {ready && measurement ? (
          <EditMeasurementFields measurement={measurement} onCancel={onClose} onSaved={onSaved} />
        ) : detailError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{detailError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(editMeasurement(measurementId))}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EditMeasurementFields({
  measurement,
  onSaved,
  onCancel,
}: {
  measurement: MeasurementSummary;
  onSaved: (measurement: MeasurementSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { mutationStatus, mutationError } = useAppSelector(selectMeasurement);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const nextId = useRef(1);
  const [name, setName] = useState(measurement.name);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitRow[]>(
    measurement.units.length
      ? measurement.units.map((unit) => ({ ...unit, rowId: unit.id }))
      : [{ rowId: "initial-unit", key: "", name: "", symbol: "" }],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a measurement name.");
      return;
    }
    if (units.some((unit) => !unit.name.trim() || !unit.symbol.trim())) {
      setError("Complete each unit name and symbol.");
      return;
    }
    if (new Set(units.map((unit) => unit.symbol.trim().toLowerCase())).size !== units.length) {
      setError("Each unit needs a unique symbol.");
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const result = await dispatch(updateMeasurement({
        id: measurement.id,
        name: name.trim(),
        units: prepareMeasurementEntries(units.map((unit) => ({ key: unit.key, name: unit.name.trim(), symbol: unit.symbol.trim() }))),
      })).unwrap();
      toast.success(`${result.measurement.name} was updated successfully.`);
      onSaved(result.measurement);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the measurement."));
    } finally {
      busy.current = false;
    }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <label className="space-y-2 text-sm font-medium">
          Measurement name
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Weight" required maxLength={160} />
        </label>
        <fieldset className="space-y-3">
          {units.map((unit, index) => (
            <div key={unit.rowId} className="flex flex-wrap items-end gap-3">
              <label className="min-w-40 flex-1 space-y-1 text-xs">
                Unit name
                <Input value={unit.name} placeholder="Kilogram" required maxLength={100} onChange={(event) => setUnits((rows) => rows.map((row) => row.rowId === unit.rowId ? { ...row, name: event.target.value } : row))} />
              </label>
              <label className="w-28 space-y-1 text-xs">
                Symbol
                <Input value={unit.symbol} placeholder="kg" required maxLength={20} onChange={(event) => setUnits((rows) => rows.map((row) => row.rowId === unit.rowId ? { ...row, symbol: event.target.value } : row))} />
              </label>
              {!unit.key && (
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove unit ${index + 1}`} disabled={units.length === 1} onClick={() => setUnits((rows) => rows.filter((row) => row.rowId !== unit.rowId))}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={units.length >= 30} onClick={() => setUnits((rows) => [...rows, { rowId: `new-unit-${nextId.current++}`, key: "", name: "", symbol: "" }])}>
            <Plus className="size-4" /> Add unit
          </Button>
        </fieldset>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
