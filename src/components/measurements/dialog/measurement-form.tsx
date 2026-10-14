"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast, toastErrorMessage } from "@/components/providers/toast-provider";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createMeasurement, updateMeasurement, selectMeasurement } from "@/lib/store/measurements-slice";
import { moveMeasurementEntry, prepareMeasurementEntries } from "@/lib/measurement-form";
import type { MeasurementFieldInput, MeasurementSummary, MeasurementUnitInput } from "@/types/measurements";

type FieldRow = MeasurementFieldInput & { rowId: string };
type UnitRow = MeasurementUnitInput & { rowId: string };

export function MeasurementForm({ measurement, onSaved, onCancel }: {
  measurement?: MeasurementSummary;
  onSaved: (measurement: MeasurementSummary) => void;
  onCancel: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { options, mutationStatus, mutationError } = useAppSelector(selectMeasurement);
  const pending = mutationStatus === "loading";
  const busy = useRef(false);
  const nextId = useRef(1);
  const [name, setName] = useState(measurement?.name ?? "");
  const [companyId, setCompanyId] = useState(measurement?.company_id ?? (options.companies.length === 1 ? options.companies[0].id : ""));
  const [active, setActive] = useState(measurement?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldRow[]>(() => measurement ? measurement.fields.map((field) => ({ ...field, rowId: field.id })) : [{ rowId: "initial-field", key: "", label: "", required: true, is_active: true, position: 0 }]);
  const [units, setUnits] = useState<UnitRow[]>(() => measurement ? measurement.units.map((unit) => ({ ...unit, rowId: unit.id })) : [{ rowId: "initial-unit", key: "", name: "", symbol: "", is_active: true, position: 0 }]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim() || !companyId) { setError("Enter a measurement name and select a company."); return; }
    if (!fields.some((field) => field.is_active) || !units.some((unit) => unit.is_active)) { setError("Keep at least one active input field and unit."); return; }
    if (fields.some((field) => !field.label.trim()) || units.some((unit) => !unit.name.trim() || !unit.symbol.trim())) { setError("Complete the field labels, unit names, and symbols."); return; }
    if (new Set(units.map((unit) => unit.symbol.trim().toLowerCase())).size !== units.length) { setError("Each unit needs a unique symbol."); return; }
    const inputFields = prepareMeasurementEntries(fields.map((field) => ({ key: field.key, label: field.label.trim(), required: field.required, is_active: field.is_active, position: field.position })));
    const inputUnits = prepareMeasurementEntries(units.map((unit) => ({ key: unit.key, name: unit.name.trim(), symbol: unit.symbol.trim(), is_active: unit.is_active, position: unit.position })));
    busy.current = true;
    setError(null);
    try {
      const result = measurement
        ? await dispatch(updateMeasurement({ id: measurement.id, name: name.trim(), is_active: active, fields: inputFields, units: inputUnits })).unwrap()
        : await dispatch(createMeasurement({ company_id: companyId, name: name.trim(), fields: inputFields, units: inputUnits })).unwrap();
      toast.success(`${result.measurement.name} was ${measurement ? "updated" : "created"} successfully.`);
      onSaved(result.measurement);
    } catch (failure) {
      toast.error(toastErrorMessage(failure, "Could not save the measurement."));
    } finally { busy.current = false; }
  }

  return (
    <form onSubmit={save} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">Measurement name
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Dimensions" required maxLength={160} />
          </label>
          <label className="space-y-2 text-sm font-medium">Company
            {measurement ? <Input value={measurement.company.name} disabled /> : (
              <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} required className="h-10 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">Select a company</option>
                {options.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            )}
          </label>
        </div>
        {measurement && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Measurement active</label>}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Input fields</legend>
          <p className="text-xs text-muted-foreground">Add the numbers users will enter, such as Length, Width, and Height. Use the arrows to set their display order.</p>
          {fields.map((field, index) => (
            <div key={field.rowId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <label className="min-w-40 flex-1 space-y-1 text-xs">Field label
                <Input value={field.label} placeholder="Length" required maxLength={100} onChange={(event) => setFields((rows) => rows.map((row) => row.rowId === field.rowId ? { ...row, label: event.target.value } : row))} />
              </label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={field.required} onChange={(event) => setFields((rows) => rows.map((row) => row.rowId === field.rowId ? { ...row, required: event.target.checked } : row))} /> Required</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={field.is_active} onChange={(event) => setFields((rows) => rows.map((row) => row.rowId === field.rowId ? { ...row, is_active: event.target.checked } : row))} /> Active</label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={`Move field ${index + 1} up`} disabled={index === 0} onClick={() => setFields((rows) => moveMeasurementEntry(rows, index, -1))}><ArrowUp className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Move field ${index + 1} down`} disabled={index === fields.length - 1} onClick={() => setFields((rows) => moveMeasurementEntry(rows, index, 1))}><ArrowDown className="size-4" /></Button>
                {!field.key && <Button type="button" variant="ghost" size="icon" aria-label={`Remove field ${index + 1}`} disabled={fields.length === 1} onClick={() => setFields((rows) => rows.filter((row) => row.rowId !== field.rowId))}><X className="size-4" /></Button>}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={fields.length >= 30} onClick={() => setFields((rows) => [...rows, { rowId: `new-field-${nextId.current++}`, key: "", label: "", required: true, is_active: true, position: rows.length }])}><Plus className="size-4" /> Add field</Button>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Allowed units</legend>
          <p className="text-xs text-muted-foreground">All fields in a selected measurement use the same unit. Deactivate saved entries to preserve existing references.</p>
          {units.map((unit, index) => (
            <div key={unit.rowId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <label className="min-w-40 flex-1 space-y-1 text-xs">Unit name
                <Input value={unit.name} placeholder="Centimeter" required maxLength={100} onChange={(event) => setUnits((rows) => rows.map((row) => row.rowId === unit.rowId ? { ...row, name: event.target.value } : row))} />
              </label>
              <label className="w-24 space-y-1 text-xs">Symbol
                <Input value={unit.symbol} placeholder="cm" required maxLength={20} onChange={(event) => setUnits((rows) => rows.map((row) => row.rowId === unit.rowId ? { ...row, symbol: event.target.value } : row))} />
              </label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={unit.is_active} onChange={(event) => setUnits((rows) => rows.map((row) => row.rowId === unit.rowId ? { ...row, is_active: event.target.checked } : row))} /> Active</label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={`Move unit ${index + 1} up`} disabled={index === 0} onClick={() => setUnits((rows) => moveMeasurementEntry(rows, index, -1))}><ArrowUp className="size-4" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Move unit ${index + 1} down`} disabled={index === units.length - 1} onClick={() => setUnits((rows) => moveMeasurementEntry(rows, index, 1))}><ArrowDown className="size-4" /></Button>
                {!unit.key && <Button type="button" variant="ghost" size="icon" aria-label={`Remove unit ${index + 1}`} disabled={units.length === 1} onClick={() => setUnits((rows) => rows.filter((row) => row.rowId !== unit.rowId))}><X className="size-4" /></Button>}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={units.length >= 30} onClick={() => setUnits((rows) => [...rows, { rowId: `new-unit-${nextId.current++}`, key: "", name: "", symbol: "", is_active: true, position: rows.length }])}><Plus className="size-4" /> Add unit</Button>
        </fieldset>
      </fieldset>
      {(error || mutationError) && <p role="alert" className="text-sm text-destructive">{error ?? mutationError?.message}</p>}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending || (!measurement && !options.companies.length)}>{pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{pending ? "Saving…" : measurement ? "Save changes" : "Create measurement"}</Button>
      </div>
    </form>
  );
}
