// Planned client model for variants; variant API endpoints are not implemented yet.
export interface VariantMeasurementValue {
  // UUID of the numeric field definition, such as Length or Width.
  field_id: string;
  // Numeric value entered for this field in the selected unit.
  value: number;
}

export interface VariantMeasurement {
  // UUID of the selected measurement definition, such as Dimensions.
  measurement_id: string;
  // UUID of the allowed unit used by all fields in this measurement.
  unit_id: string;
  // Numeric values entered for the measurement's fields.
  values: VariantMeasurementValue[];
}

export interface Variant {
  // Unique identifier (UUID) of the variant.
  id: string;
  // UUID of the company that owns the variant.
  company_id: string;
  // UUID of the brand this variant belongs to.
  brand_id: string;
  // Display name of the variant.
  name: string;
  // Item code used to identify the variant.
  sku: string;
  // UUID of the purchasing unit, such as PCS or SET.
  purchasing_unit_id: string;
  // Multiple selected measurements and their entered values.
  measurements: VariantMeasurement[];
  // UUID of the user who created the variant, when recorded.
  created_by: string | null;
  // Whether the variant is available for procurement.
  is_active: boolean;
  // ISO date string when the variant was created.
  created_at: string;
  // ISO date string when the variant was last updated.
  updated_at: string;
}

export interface CreateVariantInput {
  // UUID of the brand under which to create the variant.
  brand_id: string;
  // Display name of the new variant.
  name: string;
  // Item code of the new variant.
  sku: string;
  // UUID of the purchasing unit, separate from the item's measurements.
  purchasing_unit_id: string;
  // Selected measurements, units, and numeric values.
  measurements: VariantMeasurement[];
}

export interface UpdateVariantInput {
  // UUID of the variant to update.
  id: string;
  // Updated display name, when supplied.
  name?: string;
  // Updated item code, when supplied.
  sku?: string;
  // Updated purchasing unit UUID.
  purchasing_unit_id?: string;
  // Updated selected measurements and numeric values.
  measurements?: VariantMeasurement[];
  // Updated active/archived status.
  is_active?: boolean;
}

export interface VariantResponse {
  // Variant returned by a detail or mutation request.
  variant: Variant;
}

export interface VariantsPage {
  // Variants returned for the requested page.
  variants: Variant[];
  // Total number of variants matching the query.
  total: number;
  // Current page number, starting at 1.
  page: number;
  // Maximum number of variants per page.
  page_size: number;
}
