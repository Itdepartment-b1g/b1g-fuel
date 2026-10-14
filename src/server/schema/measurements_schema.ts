export const MEASUREMENT_SORT_FIELDS = [
  "id",
  "name",
  "created_at",
  "updated_at",
] as const;

export type MeasurementFieldInput = {
  key: string;
  label: string;
  required: boolean;
  is_active: boolean;
  position: number;
};
export type MeasurementUnitInput = {
  key: string;
  name: string;
  symbol: string;
  is_active: boolean;
  position: number;
};
export type MeasurementSummary = {
  id: string;
  company_id: string;
  created_by: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fields: (MeasurementFieldInput & { id: string })[];
  units: (MeasurementUnitInput & { id: string })[];
};
export type CreateMeasurementInput = {
  company_id: string;
  name: string;
  fields: MeasurementFieldInput[];
  units: MeasurementUnitInput[];
};
export type UpdateMeasurementInput = {
  id: string;
  name?: string;
  is_active?: boolean;
  fields?: MeasurementFieldInput[];
  units?: MeasurementUnitInput[];
};
export type MeasurementResponse = { measurement: MeasurementSummary };
export type MeasurementsPage = {
  measurements: MeasurementSummary[];
  total: number;
  page: number;
  page_size: number;
};
