"use client";

import { useState } from "react";
import { Archive, ChevronDown, Pencil, RotateCcw, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { MeasurementSummary } from "@/types/measurements";
import { MeasurementDetails, type MeasurementActionProps } from "../table-view/measurements-table-view";

export function MeasurementsCards({ measurements, disabled, onEdit, onArchive, onRestore }: MeasurementActionProps & { measurements: MeasurementSummary[] }) {
  const access = useRecordAccess();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {measurements.map((measurement) => (
        <article key={measurement.id} className="rounded-xl border p-5">
          <Ruler className="mb-4 size-7 text-primary" aria-hidden="true" />
          <h2 className="break-words font-semibold">{measurement.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{measurement.company?.name ?? "All companies"} · {measurement.created_by_name ?? "—"} · {measurement.is_active ? "Active" : "Archived"}</p>
          <p className="mt-3 text-sm text-muted-foreground">{measurement.fields.filter((field) => field.is_active).map((field) => field.label).join(", ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">Units: {measurement.units.filter((unit) => unit.is_active).map((unit) => unit.symbol).join(", ")}</p>
          <button type="button" className="mt-4 flex w-full items-center justify-between text-sm font-medium" aria-expanded={expandedId === measurement.id} aria-controls={`measurement-details-${measurement.id}`} onClick={() => setExpandedId((current) => current === measurement.id ? null : measurement.id)}>
            View fields and units<ChevronDown className={`size-4 transition-transform ${expandedId === measurement.id ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <div id={`measurement-details-${measurement.id}`} hidden={expandedId !== measurement.id} className="mt-3">{expandedId === measurement.id && <MeasurementDetails measurement={measurement} />}</div>
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "measurements", "edit", measurement)} onClick={() => onEdit(measurement)}><Pencil className="size-4" /> Edit</Button>
            {measurement.is_active ? <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "measurements", "delete", measurement)} onClick={() => onArchive(measurement)}><Archive className="size-4" /> Archive</Button> : <Button variant="ghost" size="sm" disabled={disabled || !canPerform(access, "measurements", "edit", measurement)} onClick={() => onRestore(measurement)}><RotateCcw className="size-4" /> Restore</Button>}
          </div>
        </article>
      ))}
    </div>
  );
}
