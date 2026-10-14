import type { RecordAccess } from "@/server/auth/record-access";
import type {
  CreateMeasurementInput,
  UpdateMeasurementInput,
} from "@/server/schema/measurements_schema";
import type { Pagination } from "@/server/lib/pagination";
import type { Sorting } from "@/server/lib/sorting";
import * as repository from "@/server/repositories/measurements_repository";
import { MeasurementError } from "@/server/lib/measurement-input";
import { getDatabase } from "@/server/lib/database";

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
  const unrestricted = access.grants.some((grant) => grant.permission === "measurements.add" && grant.scope === "all" && !grant.companyId);
  const granted = [...new Set(access.grants.filter((grant) => grant.permission === "measurements.add").flatMap((grant) => grant.companyId ? [grant.companyId] : access.companyIds))];
  const choices = unrestricted ? access.companyIds : granted;
  if (choices.length === 1) {
    if (!can_create_measurement(access, choices[0]))
      throw new MeasurementError("forbidden", "You cannot create measurements in this company.");
    return choices[0];
  }
  if (!requested)
    throw new MeasurementError("invalid_input", "Select a company.");
  if (!can_create_measurement(access, requested))
    throw new MeasurementError("forbidden", "You cannot create measurements in this company.");
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
  active?: boolean,
) {
  return repository.list_measurements(
    pagination,
    search,
    sorting,
    access,
    companyId,
    active,
  );
}
export async function get_measurement(id: string, access: RecordAccess) {
  const result = await repository.get_measurement(id, access);
  if (!result)
    throw new MeasurementError("not_found", "Measurement not found.");
  return result;
}
export function update_measurement(
  input: UpdateMeasurementInput,
  access: RecordAccess,
) {
  return repository.update_measurement(input, access);
}
export function archive_measurement(id: string, access: RecordAccess) {
  return repository.update_measurement(
    { id, is_active: false },
    access,
    "delete",
  );
}

export async function get_measurement_options(access: RecordAccess) {
  const all = access.superAdmin || access.grants.some((grant) => grant.permission === "measurements.add" && grant.scope === "all" && !grant.companyId);
  const ids = [...new Set(access.grants.filter((grant) => grant.permission === "measurements.add")
    .flatMap((grant) => grant.companyId ? [grant.companyId] : access.companyIds))];
  const companies = await getDatabase().company.findMany({
    where: all ? {} : { id: { in: ids } },
    select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return { companies };
}
