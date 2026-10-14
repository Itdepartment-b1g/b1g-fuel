import type { MeasurementSummary } from "@/types/measurements";

export function MeasurementDetails({
  measurement,
}: {
  measurement: MeasurementSummary;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="overflow-hidden rounded-lg border bg-white">
        <h3 className="border-b bg-gray-50 px-4 py-3 text-sm font-semibold">
          Input fields
        </h3>
        <ul className="divide-y">
          {measurement.fields.map((field) => (
            <li
              key={field.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span>{field.label}</span>
              <span className="text-xs text-muted-foreground">
                {field.required ? "Required" : "Optional"} ·{" "}
                {field.is_active ? "Active" : "Inactive"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="overflow-hidden rounded-lg border bg-white">
        <h3 className="border-b bg-gray-50 px-4 py-3 text-sm font-semibold">
          Allowed units
        </h3>
        <ul className="divide-y">
          {measurement.units.map((unit) => (
            <li
              key={unit.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span>
                {unit.name} ({unit.symbol})
              </span>
              <span className="text-xs text-muted-foreground">
                {unit.is_active ? "Active" : "Inactive"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
