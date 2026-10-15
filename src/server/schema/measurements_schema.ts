export const MEASUREMENT_SORT_FIELDS = [
  "id",
  "name",
  "created_at",
  "updated_at",
] as const;

export interface MeasurementUnitInput {
  key: string;
  name: string;
  symbol: string;
}

export interface MeasurementSummary {
  id: string;
  company_id: string | null;
  company: { id: string; name: string } | null;
  created_by: string | null;
  created_by_name: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  units: Array<MeasurementUnitInput & { id: string }>;
}

export interface CreateMeasurementInput {
  company_id?: string | null;
  name: string;
  units: MeasurementUnitInput[];
}

export interface UpdateMeasurementInput {
  id: string;
  name?: string;
  units?: MeasurementUnitInput[];
}
