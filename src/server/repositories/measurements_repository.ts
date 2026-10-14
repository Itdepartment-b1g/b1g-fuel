import type { Prisma } from "@/generated/prisma/client";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase } from "@/server/lib/database";
import { paginationMetadata, type Pagination } from "@/server/lib/pagination";
import { build_sort, type Sorting } from "@/server/lib/sorting";
import type {
  CreateMeasurementInput,
  MeasurementSummary,
  UpdateMeasurementInput,
} from "@/server/schema/measurements_schema";
import { MeasurementError } from "@/server/lib/measurement-input";

const include = {
  company: { select: { id: true, name: true } },
  fields: { orderBy: [{ position: "asc" }, { key: "asc" }] },
  units: { orderBy: [{ position: "asc" }, { key: "asc" }] },
} satisfies Prisma.measurementInclude;
type Record = Prisma.measurementGetPayload<{ include: typeof include }>;
function serialize(record: Record): MeasurementSummary {
  return {
    ...record,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    fields: record.fields.map(
      ({ measurement_id: _measurementId, ...field }) => field,
    ),
    units: record.units.map(
      ({ measurement_id: _measurementId, ...unit }) => unit,
    ),
  };
}
export async function list_measurements(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  active?: boolean,
) {
  const where: Prisma.measurementWhereInput = {
    AND: [
      record_where(access, "measurements"),
      {
        ...(companyId ? { company_id: companyId } : {}),
        ...(active !== undefined ? { is_active: active } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
    ],
  };
  const orderBy = build_sort<Prisma.measurementOrderByWithRelationInput>(
    sorting,
    {
      fields: {
        id: (direction) => ({ id: direction }),
        name: (direction) => ({ name: direction }),
        created_at: (direction) => ({ created_at: direction }),
        updated_at: (direction) => ({ updated_at: direction }),
      },
      default: { field: "created_at", direction: "desc" },
      tieBreaker: { field: "id", order: { id: "asc" } },
    },
  );
  return getDatabase().$transaction(
    async (tx) => {
      const rows = await tx.measurement.findMany({
        where,
        include,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      });
      const total = await tx.measurement.count({ where });
      return {
        measurements: rows.map(serialize),
        ...paginationMetadata(total, pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function get_measurement(id: string, access: RecordAccess) {
  const record = await getDatabase().measurement.findFirst({
    where: { AND: [{ id }, record_where(access, "measurements")] },
    include,
  });
  return record ? serialize(record) : null;
}
export async function create_measurement(
  input: CreateMeasurementInput,
  actor: string,
) {
  const { fields, units, ...data } = input;
  return serialize(
    await getDatabase().measurement.create({
      data: {
        ...data,
        created_by: actor,
        fields: { create: fields },
        units: { create: units },
      },
      include,
    }),
  );
}
export async function update_measurement(
  input: UpdateMeasurementInput,
  access: RecordAccess,
  action = "edit",
) {
  return getDatabase().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "measurement" WHERE id = ${input.id}::uuid FOR UPDATE`;
    const where = {
      AND: [{ id: input.id }, record_where(access, "measurements", action)],
    };
    const current = await tx.measurement.findFirst({ where, include });
    if (!current)
      throw new MeasurementError("not_found", "Measurement not found.");
    const fields = new Map(current.fields.map((field) => [field.key, field]));
    const units = new Map(current.units.map((unit) => [unit.key, unit]));
    for (const field of input.fields ?? [])
      fields.set(field.key, {
        ...field,
        id: fields.get(field.key)?.id ?? "",
        measurement_id: current.id,
      });
    for (const unit of input.units ?? [])
      units.set(unit.key, {
        ...unit,
        id: units.get(unit.key)?.id ?? "",
        measurement_id: current.id,
      });
    if (
      !Array.from(fields.values()).some((field) => field.is_active) ||
      !Array.from(units.values()).some((unit) => unit.is_active)
    )
      throw new MeasurementError(
        "invalid_input",
        "Keep at least one active field and one active unit.",
      );
    const symbols = Array.from(units.values()).map((unit) =>
      unit.symbol.toLowerCase(),
    );
    if (new Set(symbols).size !== symbols.length)
      throw new MeasurementError(
        "conflict",
        "Unit symbols must be unique within the measurement.",
      );
    for (const field of input.fields ?? [])
      await tx.measurement_field.upsert({
        where: {
          measurement_id_key: { measurement_id: input.id, key: field.key },
        },
        create: { ...field, measurement_id: input.id },
        update: field,
      });
    for (const unit of input.units ?? [])
      await tx.measurement_unit.upsert({
        where: {
          measurement_id_key: { measurement_id: input.id, key: unit.key },
        },
        create: { ...unit, measurement_id: input.id },
        update: unit,
      });
    return serialize(
      await tx.measurement.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.is_active !== undefined
            ? { is_active: input.is_active }
            : {}),
        },
        include,
      }),
    );
  });
}
