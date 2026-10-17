"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loading } from "@/components/common/loading";
import { useRecordAccess } from "@/components/providers/access-provider";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createMeasurement, getMeasurementOption, selectMeasurement } from "@/lib/store/measurements-slice";
import { prepareMeasurementEntries } from "@/utils/measurement-form";
import type { MeasurementSummary, MeasurementUnitInput } from "@/types/measurements";

type UnitRow = MeasurementUnitInput & { rowId: string };

export function CreateMeasurementDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (measurement: MeasurementSummary) => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const access = useRecordAccess();
  const { optionsStatus, optionsError, options, mutationStatus, mutationError } = useAppSelector(selectMeasurement);
  const pending = mutationStatus === "loading";

  useEffect(() => {
    const request = dispatch(getMeasurementOption());
    return () => request.abort();
  }, [dispatch]);

  useEffect(() => {
    if ([optionsError, mutationError].some((error) => error?.status === 401)) router.replace("/login");
  }, [optionsError, mutationError, router]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className={`max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto sm:max-w-3xl ${pending ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Create a measurement</DialogTitle>
          <DialogDescription>Name the measurement and add the units people can choose.</DialogDescription>
        </DialogHeader>
        {optionsStatus === "succeeded" ? (
          !options.companies.length && !access?.superAdmin ? (
            <p role="status" className="text-sm text-muted-foreground">
              No companies are available for creating measurements. Ask an administrator to check your company access.
            </p>
          ) : (
            <CreateMeasurementFields onCancel={onClose} onSaved={onSaved} />
          )
        ) : optionsError ? (
          <div>
            <p role="alert" className="text-sm text-destructive">{optionsError.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => dispatch(getMeasurementOption())}>Try again</Button>
          </div>
        ) : (
          <Loading />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CreateMeasurementFields({
  onSaved,
  onCancel,
}: {
  onSaved: (measurement: MeasurementSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const access = useRecordAccess();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectMeasurement);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const nextId = useRef(1);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(options.companies.length === 1 ? options.companies[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([{ rowId: "initial-unit", key: "", name: "", symbol: "" }]);
  const shared = Boolean(access?.superAdmin);
  const chooseCompany = !shared && options.companies.length > 1;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter a measurement name.");
      return;
    }
    if (chooseCompany && !companyId) {
      setError("Select a company.");
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
      const result = await dispatch(createMeasurement({
        ...(shared || !companyId ? {} : { company_id: companyId }),
        name: name.trim(),
        units: prepareMeasurementEntries(units.map((unit) => ({ key: unit.key, name: unit.name.trim(), symbol: unit.symbol.trim() }))),
      })).unwrap();
      toast.success(`${result.measurement.name} was created successfully.`);
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
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove unit ${index + 1}`} disabled={units.length === 1} onClick={() => setUnits((rows) => rows.filter((row) => row.rowId !== unit.rowId))}>
                <X className="size-4" />
              </Button>
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
        <Button type="submit" disabled={pending || (!shared && !options.companies.length)}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Create measurement"}
        </Button>
      </div>
    </form>
  );
}
