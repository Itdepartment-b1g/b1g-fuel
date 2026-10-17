"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRecordAccess } from "@/components/providers/access-provider";
import { TableView } from "@/components/common/table/table-view";
import { canPerform } from "@/lib/auth/access-scope";
import type { TableSort } from "@/types/table-views";
import type { MeasurementSummary } from "@/types/measurements";
import { MEASUREMENT_TABLE_COLUMNS } from "./measurement-table-columns";

export type MeasurementActionProps = {
  onEdit: (measurement: MeasurementSummary) => void;
  onDelete: (measurement: MeasurementSummary) => void;
  disabled: boolean;
};

export function MeasurementUnits({ measurement }: { measurement: MeasurementSummary }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Units for {measurement.name}</caption>
        <thead className="border-b bg-gray-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">
              Unit name
            </th>
            <th scope="col" className="px-4 py-3">
              Symbol
            </th>
          </tr>
        </thead>
        <tbody>
          {measurement.units.length ? (
            measurement.units.map((unit) => (
              <tr key={unit.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{unit.name}</td>
                <td className="px-4 py-3">{unit.symbol}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="px-4 py-3 text-muted-foreground">
                No units
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
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
      expandedRow={(measurement) => (
        <MeasurementUnits measurement={measurement} />
      )}
      loading={props.loading}
      sortingMode="server"
      sorting={props.sorting}
      onSortingChange={props.onSortingChange}
      multipleFrozenColumns
      actionsDisabled={props.disabled}
      emptyTitle="No measurements found"
      emptyDescription="Add a measurement or adjust your search."
      columns={MEASUREMENT_TABLE_COLUMNS}
      actions={(measurement) => [
        {
          id: "edit",
          label: "Edit",
          icon: <Pencil />,
          disabled: !canPerform(access, "measurements", "edit", measurement),
          onSelect: props.onEdit,
        },
        {
          id: "delete",
          label: "Delete",
          icon: <Trash2 />,
          destructive: true,
          disabled: !canPerform(access, "measurements", "delete", measurement),
          onSelect: props.onDelete,
        },
      ]}
    />
  );
}
