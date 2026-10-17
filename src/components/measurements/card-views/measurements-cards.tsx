"use client";

import { useState } from "react";
import { Eye, Pencil, Ruler, Trash2 } from "lucide-react";
import { CardActionsMenu } from "@/components/common/card-actions-menu";
import { useRecordAccess } from "@/components/providers/access-provider";
import { canPerform } from "@/lib/auth/access-scope";
import type { MeasurementSummary } from "@/types/measurements";
import { type MeasurementActionProps } from "../table-view/measurements-table-view";
import { ViewMeasurementDialog } from "../dialog/view-measurement-dialog";

export function MeasurementsCards({
  measurements,
  disabled,
  onEdit,
  onDelete,
}: MeasurementActionProps & { measurements: MeasurementSummary[] }) {
  const access = useRecordAccess();
  const [viewing, setViewing] = useState<MeasurementSummary | null>(null);
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {measurements.map((measurement) => (
        <article key={measurement.id} className="rounded-xl border p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <Ruler className="size-7 text-primary" aria-hidden="true" />
            <CardActionsMenu
              label={`Actions for ${measurement.name}`}
              items={[
                { id: "view", label: "View", icon: <Eye />, onSelect: () => setViewing(measurement) },
                {
                  id: "edit",
                  label: "Edit",
                  icon: <Pencil />,
                  disabled: disabled || !canPerform(access, "measurements", "edit", measurement),
                  onSelect: () => onEdit(measurement),
                },
                {
                  id: "delete",
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  disabled: disabled || !canPerform(access, "measurements", "delete", measurement),
                  onSelect: () => onDelete(measurement),
                },
              ]}
            />
          </div>
          <h2 className="break-words font-semibold">{measurement.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {measurement.company?.name ?? "All companies"} ·{" "}
            {measurement.created_by_name ?? "—"}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Units:{" "}
            {measurement.units.map((unit) => unit.symbol).join(", ") || "—"}
          </p>
        </article>
      ))}
      {viewing && <ViewMeasurementDialog measurement={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
