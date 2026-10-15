import type { QuickFilterState } from "@/types/quick-filter";
import { MEASUREMENT_FILTER_OPTIONS } from "@/utils/management-filters";
import type { RecordAccess } from "@/server/auth/record-access";
import { build_filter_options } from "@/server/lib/quick-filters";
import type {
  CreateMeasurementInput,
  UpdateMeasurementInput,
} from "@/server/schema/measurements_schema";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import * as repository from "@/server/repositories/measurements_repository";
import { getDatabase } from "@/server/lib/database";

export class MeasurementError extends Error {
  constructor(public code: "invalid_input" | "not_found" | "forbidden" | "conflict", message: string) { super(message); }
}

export function can_create_measurement(
  access: RecordAccess,
  companyId: string,
) {
  return (
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "measurements.add" &&
        ((grant.scope === "all" && !grant.companyId) ||
          (grant.companyId
            ? grant.companyId === companyId
            : access.companyIds.includes(companyId))),
    )
  );
}

export function measurement_company(access: RecordAccess, requested?: string) {
  if (access.superAdmin) return null;
  const unrestricted = access.grants.some(
    (grant) =>
      grant.permission === "measurements.add" &&
      grant.scope === "all" &&
      !grant.companyId,
  );
  const granted = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "measurements.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const choices = unrestricted ? access.companyIds : granted;
  if (choices.length === 1) {
    if (!can_create_measurement(access, choices[0]))
      throw new MeasurementError(
        "forbidden",
        "You cannot create measurements in this company.",
      );
    return choices[0];
  }
  if (!requested)
    throw new MeasurementError("invalid_input", "Select a company.");
  if (!can_create_measurement(access, requested))
    throw new MeasurementError(
      "forbidden",
      "You cannot create measurements in this company.",
    );
  return requested;
}

export async function create_measurement(
  input: CreateMeasurementInput,
  access: RecordAccess,
) {
  const company_id = measurement_company(access, input.company_id ?? undefined);
  return repository.create_measurement({ ...input, company_id }, access.userId);
}
export function list_measurements(
  pagination: Pagination,
  search: string,
  sorting: Sorting | undefined,
  access: RecordAccess,
  companyId?: string,
  filters?: QuickFilterState,
) {
  return repository.list_measurements(
    pagination,
    search,
    sorting,
    access,
    companyId,
    filters,
  );
}
export async function get_measurement_filter_options(access: RecordAccess) {
  const records = await repository.get_measurement_filter_data(access);
  return build_filter_options(
    records,
    MEASUREMENT_FILTER_OPTIONS,
    (measurement, field) =>
      field === "company"
        ? measurement.company
          ? { value: measurement.company.id, label: measurement.company.name }
          : null
        : { value: measurement.name, label: measurement.name },
    (measurement, status) =>
      status === "all" || (measurement.company_id === null) === (status === "shared"),
  );
}
export async function get_measurement(id: string, access: RecordAccess) {
  const result = await repository.get_measurement(id, access);
  if (!result)
    throw new MeasurementError("not_found", "Measurement not found.");
  return result;
}
export async function update_measurement(
  input: UpdateMeasurementInput,
  access: RecordAccess,
) {
  const result = await repository.update_measurement(input, access);
  if (result === "not_found") throw new MeasurementError("not_found", "Measurement not found.");
  if (result === "empty") throw new MeasurementError("invalid_input", "Keep at least one unit.");
  if (result === "duplicate_symbols") throw new MeasurementError("conflict", "Unit symbols must be unique within the measurement.");
  return result;
}
export async function delete_measurement(id: string, access: RecordAccess) {
  const result = await repository.delete_measurement(id, access);
  if (result === "not_found") throw new MeasurementError("not_found", "Measurement not found.");
}

export async function get_measurement_options(access: RecordAccess) {
  const all =
    access.superAdmin ||
    access.grants.some(
      (grant) =>
        grant.permission === "measurements.add" &&
        grant.scope === "all" &&
        !grant.companyId,
    );
  const ids = [
    ...new Set(
      access.grants
        .filter((grant) => grant.permission === "measurements.add")
        .flatMap((grant) =>
          grant.companyId ? [grant.companyId] : access.companyIds,
        ),
    ),
  ];
  const companies = await getDatabase().company.findMany({
    where: all ? {} : { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return { companies };
}
