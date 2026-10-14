"use client";

import { Archive, Pencil, RotateCcw } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { MeasurementSummary } from "@/types/measurements";

export type MeasurementActionProps = {
  onEdit: (measurement: MeasurementSummary) => void;
  onArchive: (measurement: MeasurementSummary) => void;
  onRestore: (measurement: MeasurementSummary) => void;
  disabled: boolean;
};
export function MeasurementsTableView(
  props: MeasurementActionProps & {
    measurements: MeasurementSummary[];
    loading: boolean;
    sorting: TableSort | null;
    onSortingChange: (sorting: TableSort | null) => void;
  },
) {
  const access = useRecordAccess();
  return (
    <TableView
      data={props.measurements}
      rowKey={(measurement) => measurement.id}
      caption="Measurement definitions and units"
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No measurements found"
      emptyDescription="Add a measurement or adjust your search and status filter."
      columns={[
        {
          id: "name",
          header: "Measurement",
          sortable: true,
          freezable: true,
          value: (measurement) => measurement.name,
          className: "font-semibold",
        },
        {
          id: "company",
          header: "Company",
          freezable: true,
          cell: (measurement) => measurement.company?.name ?? "All companies",
        },
        {
          id: "units",
          header: "Units",
          cell: (measurement) => {
            const units = measurement.units.filter((unit) => unit.is_active);
            if (!units.length) return "—";
            return (
              <div className="flex flex-wrap gap-1.5">
                {units.map((unit) => (
                  <span
                    key={unit.id}
                    title={unit.name}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {unit.symbol}
                  </span>
                ))}
              </div>
            );
          },
        },
        {
          id: "is_active",
          header: "Status",
          cell: (measurement) =>
            measurement.is_active ? "Active" : "Archived",
        },
        {
          id: "created_by",
          header: "Created by",
          freezable: true,
          value: (measurement) => measurement.created_by_name,
          cell: (measurement) => measurement.created_by_name ?? "—",
        },
        {
          id: "created_at",
          header: "Created",
          sortable: true,
          freezable: true,
          cell: (measurement) => (
            <time dateTime={measurement.created_at}>
              {new Date(measurement.created_at).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "Asia/Manila",
              })}
            </time>
          ),
        },
      ]}
      actions={(measurement) => [
        {
          id: "edit",
          label: "Edit",
          icon: <Pencil />,
          disabled: !canPerform(access, "measurements", "edit", measurement),
          onSelect: props.onEdit,
        },
        measurement.is_active
          ? {
              id: "archive",
              label: "Archive",
              icon: <Archive />,
              destructive: true,
              disabled: !canPerform(
                access,
                "measurements",
                "delete",
                measurement,
              ),
              onSelect: props.onArchive,
            }
          : {
              id: "restore",
              label: "Restore",
              icon: <RotateCcw />,
              disabled: !canPerform(
                access,
                "measurements",
                "edit",
                measurement,
              ),
              onSelect: props.onRestore,
            },
      ]}
    />
  );
}
