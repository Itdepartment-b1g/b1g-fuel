"use client";

import { Pencil, Ruler, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { MeasurementSummary } from "@/types/measurements";
import { type MeasurementActionProps } from "../table-view/measurements-table-view";

export function MeasurementsCards({
  measurements,
  disabled,
  onEdit,
  onDelete,
}: MeasurementActionProps & { measurements: MeasurementSummary[] }) {
  const access = useRecordAccess();
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {measurements.map((measurement) => (
        <article key={measurement.id} className="rounded-xl border p-5">
          <Ruler className="mb-4 size-7 text-primary" aria-hidden="true" />
          <h2 className="break-words font-semibold">{measurement.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {measurement.company?.name ?? "All companies"} ·{" "}
            {measurement.created_by_name ?? "—"}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Units:{" "}
            {measurement.units.map((unit) => unit.symbol).join(", ") || "—"}
          </p>
          <div className="mt-4 flex justify-end gap-2 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={
                disabled ||
                !canPerform(access, "measurements", "edit", measurement)
              }
              onClick={() => onEdit(measurement)}
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={
                disabled ||
                !canPerform(access, "measurements", "delete", measurement)
              }
              onClick={() => onDelete(measurement)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
