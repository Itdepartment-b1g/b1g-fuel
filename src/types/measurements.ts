import type { CompanyOption } from "./companies";

export interface MeasurementUnitInput {
  // Stable machine-readable key of the unit.
  key: string;
  // Display name of the unit, such as Centimeter.
  name: string;
  // Short unit symbol, such as cm.
  symbol: string;
}

export interface MeasurementUnit extends MeasurementUnitInput {
  // Unique identifier (UUID) of the saved unit definition.
  id: string;
}

export interface Measurement {
  // Unique identifier (UUID) of the measurement definition.
  id: string;
  // UUID of the owning company. Null when a super admin shared the definition with every company.
  company_id: string | null;
  // Display information for the owning company. Null for a shared definition.
  company: CompanyOption | null;
  // UUID of the user who created the definition, when recorded.
  created_by: string | null;
  // Display name of the user who created the definition, when available.
  created_by_name: string | null;
  // Display name of the measurement, such as Dimensions.
  name: string;
  // ISO date string when the definition was created.
  created_at: string;
  // ISO date string when the definition was last updated.
  updated_at: string;
  // Units people can choose for this measurement.
  units: MeasurementUnit[];
}

export type MeasurementSummary = Measurement;

export interface CreateMeasurementInput {
  // UUID of the company that will own the definition. Omitted for a shared super-admin definition.
  company_id?: string | null;
  // Display name of the new measurement.
  name: string;
  // Allowed units to create.
  units: MeasurementUnitInput[];
}

export interface UpdateMeasurementInput {
  // UUID of the measurement to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // Unit definitions to upsert by key; omitted units are preserved.
  units?: MeasurementUnitInput[];
}

export interface MeasurementResponse {
  // Measurement returned by a detail, create, or update request.
  measurement: MeasurementSummary;
}

export interface MeasurementOptions {
  // Companies in which the user can create measurements.
  companies: CompanyOption[];
}

export interface MeasurementsPage {
  // Measurement definitions returned for the requested page.
  measurements: MeasurementSummary[];
  // Total number of definitions matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of definitions per page.
  page_size: number;
}

export interface DeleteMeasurementResponse {
  // UUID of the deleted measurement.
  id: string;
  // Result message returned by the API.
  message: string;
}
