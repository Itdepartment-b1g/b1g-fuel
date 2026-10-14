import type { Prisma } from "@/generated/prisma/client";
import type { QuickFilterState } from "@/types/quick-filter";
import { record_where, type RecordAccess } from "@/server/auth/record-access";
import { getDatabase, type DatabaseExecutor } from "@/server/lib/database";
import { build_filter } from "@/server/lib/filter";
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
  units: { orderBy: [{ name: "asc" }, { key: "asc" }] },
} satisfies Prisma.measurementInclude;
type Record = Prisma.measurementGetPayload<{ include: typeof include }>;
function serialize(record: Record, createdByName: string | null): MeasurementSummary {
  return {
    ...record,
    created_by_name: createdByName,
    created_at: record.created_at.toISOString(),
    updated_at: record.updated_at.toISOString(),
    units: record.units.map(
      ({ measurement_id: _measurementId, ...unit }) => unit,
    ),
  };
}

/** Resolve creator ids to display names. Missing or deleted creators stay unnamed. */
async function serialize_measurements(records: Record[], client: DatabaseExecutor) {
  const ids = [...new Set(records.flatMap((record) => record.created_by ? [record.created_by] : []))];
  const creators = ids.length
    ? await client.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(creators.map((creator) => [creator.id, creator.name]));
  return records.map((record) => serialize(record, record.created_by ? names.get(record.created_by) ?? null : null));
}
export async function list_measurements(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  const where = build_filter<Prisma.measurementWhereInput>(filters, {
    where: { AND: [record_where(access, "measurements"), ...(companyId ? [{ company_id: companyId }] : [])] },
    fields: {
      name: (values) => ({ OR: values.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) }),
      company: (values) => ({ company_id: { in: values } }),
    },
    date: (range) => ({ created_at: range }),
    status: { shared: { company_id: null }, company: { company_id: { not: null } } },
    search: { value: search, fields: [(filter) => ({ name: filter })] },
  });
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
        measurements: await serialize_measurements(rows, tx),
        ...paginationMetadata(total, pagination),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export function get_measurement_filter_data(access: RecordAccess) {
  return getDatabase().measurement.findMany({
    where: record_where(access, "measurements"),
    select: { name: true, company_id: true, company: { select: { id: true, name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}
export async function get_measurement(id: string, access: RecordAccess) {
  const client = getDatabase();
  const record = await client.measurement.findFirst({
    where: { AND: [{ id }, record_where(access, "measurements")] },
    include,
  });
  return record ? (await serialize_measurements([record], client))[0] : null;
}
export async function create_measurement(
  input: CreateMeasurementInput,
  actor: string,
) {
  const { units, ...data } = input;
  const client = getDatabase();
  return (await serialize_measurements([
    await client.measurement.create({
      data: {
        ...data,
        created_by: actor,
        units: { create: units },
      },
      include,
    }),
  ], client))[0];
}
export async function update_measurement(
  input: UpdateMeasurementInput,
  access: RecordAccess,
) {
  return getDatabase().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "measurement" WHERE id = ${input.id}::uuid FOR UPDATE`;
    const where = {
      AND: [{ id: input.id }, record_where(access, "measurements", "edit")],
    };
    const current = await tx.measurement.findFirst({ where, include });
    if (!current)
      throw new MeasurementError("not_found", "Measurement not found.");
    const units = new Map(current.units.map((unit) => [unit.key, unit]));
    for (const unit of input.units ?? [])
      units.set(unit.key, {
        ...unit,
        id: units.get(unit.key)?.id ?? "",
        measurement_id: current.id,
      });
    if (!units.size)
      throw new MeasurementError("invalid_input", "Keep at least one unit.");
    const symbols = Array.from(units.values()).map((unit) =>
      unit.symbol.toLowerCase(),
    );
    if (new Set(symbols).size !== symbols.length)
      throw new MeasurementError(
        "conflict",
        "Unit symbols must be unique within the measurement.",
      );
    for (const unit of input.units ?? [])
      await tx.measurement_unit.upsert({
        where: {
          measurement_id_key: { measurement_id: input.id, key: unit.key },
        },
        create: { ...unit, measurement_id: input.id },
        update: unit,
      });
    return (await serialize_measurements([
      await tx.measurement.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
        },
        include,
      }),
    ], tx))[0];
  });
}

/** Remove a measurement and its units. Units are deleted first because the relation restricts parent deletion. */
export async function delete_measurement(id: string, access: RecordAccess) {
  await getDatabase().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "measurement" WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.measurement.findFirst({
      where: { AND: [{ id }, record_where(access, "measurements", "delete")] },
      select: { id: true },
    });
    if (!current)
      throw new MeasurementError("not_found", "Measurement not found.");
    await tx.measurement_unit.deleteMany({ where: { measurement_id: id } });
    await tx.measurement.delete({ where: { id } });
  });
}
