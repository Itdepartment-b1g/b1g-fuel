import type { TableColumn } from "@/components/common/table-view";
import type { MeasurementSummary } from "@/types/measurements";
import { formatDate } from "@/utils/date";

export const MEASUREMENT_TABLE_COLUMNS: TableColumn<MeasurementSummary>[] = [
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
      const units = measurement.units;
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
      <time dateTime={measurement.created_at}>{formatDate(measurement.created_at)}</time>
    ),
  },
];
