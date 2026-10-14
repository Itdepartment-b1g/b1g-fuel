export const VARIANT_SORT_FIELDS = ["id", "name", "created_at", "updated_at"] as const;

export type {
  VariantSummary,
  CreateVariantInput,
  UpdateVariantInput,
  VariantResponse,
  VariantOptions,
  VariantsPage,
  DeleteVariantResponse,
} from "@/types/variants";
