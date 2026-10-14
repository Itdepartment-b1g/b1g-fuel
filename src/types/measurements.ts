import type { CompanyOption } from "./companies";

export interface MeasurementFieldInput {
  // Stable machine-readable key; preserved when the label changes.
  key: string;
  // Display label for the numeric input, such as Length.
  label: string;
  // Whether users must enter a value for this field.
  required: boolean;
  // Whether this field is available for new variant measurements.
  is_active: boolean;
  // Zero-based display order within the measurement.
  position: number;
}

export interface MeasurementField extends MeasurementFieldInput {
  // Unique identifier (UUID) of the saved field definition.
  id: string;
}

export interface MeasurementUnitInput {
  // Stable machine-readable key of the unit.
  key: string;
  // Display name of the unit, such as Centimeter.
  name: string;
  // Short unit symbol, such as cm.
  symbol: string;
  // Whether this unit is available for new variant measurements.
  is_active: boolean;
  // Zero-based display order within the measurement.
  position: number;
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
  // Whether the definition is active rather than archived.
  is_active: boolean;
  // ISO date string when the definition was created.
  created_at: string;
  // ISO date string when the definition was last updated.
  updated_at: string;
  // Ordered numeric input definitions, including inactive entries.
  fields: MeasurementField[];
  // Ordered allowed units, including inactive entries.
  units: MeasurementUnit[];
}

export type MeasurementSummary = Measurement;

export interface CreateMeasurementInput {
  // UUID of the company that will own the definition. Omitted for a shared super-admin definition.
  company_id?: string | null;
  // Display name of the new measurement.
  name: string;
  // Numeric input fields to create.
  fields: MeasurementFieldInput[];
  // Allowed units to create.
  units: MeasurementUnitInput[];
}

export interface UpdateMeasurementInput {
  // UUID of the measurement to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // Updated active/archived status.
  is_active?: boolean;
  // Field definitions to upsert by key; omitted fields are preserved.
  fields?: MeasurementFieldInput[];
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

export interface ArchiveMeasurementResponse {
  // UUID of the archived measurement.
  id: string;
  // Result message returned by the API.
  message: string;
}
