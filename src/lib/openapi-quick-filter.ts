import { DATE_PRESETS } from "@/utils/quick-filter";
import { USER_FILTER_FIELDS } from "@/utils/users-filters";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
export const quickFilterSchemas = {
  QuickFilters: {
    type: "object",
    required: ["date", "conditions", "status", "additional"],
    properties: {
      date: {
        type: "object",
        required: ["preset", "from", "to"],
        properties: {
          preset: {
            type: "string",
            enum: DATE_PRESETS.map((preset) => preset.value),
          },
          from: {
            type: "string",
            description: "YYYY-MM-DD or empty. Inclusive start in Asia/Manila.",
          },
          to: {
            type: "string",
            description: "YYYY-MM-DD or empty. Inclusive end in Asia/Manila.",
          },
        },
      },
      conditions: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          required: ["id", "field", "value"],
          properties: {
            id: {
              type: "string",
              maxLength: 64,
              description: "Unique condition identifier",
            },
            field: {
              type: "string",
              enum: ["", ...USER_FILTER_FIELDS.map((field) => field.key)],
            },
            value: { type: "string", maxLength: 254 },
          },
        },
      },
      status: {
        type: "string",
        enum: ["all", "assigned", "unassigned"],
        description: "Whether the user has any global or company roles.",
      },
      additional: {
        type: "object",
        properties: {
          membership: {
            type: "string",
            enum: ["all", "assigned", "unassigned"],
            default: "all",
          },
        },
      },
    },
  },
  FilterOption: {
    type: "object",
    required: ["value", "label"],
    properties: {
      value: { type: "string" },
      label: { type: "string" },
      count: { type: "integer", minimum: 0 },
    },
  },
  FilterField: {
    type: "object",
    required: ["key", "label", "options"],
    properties: {
      key: { type: "string" },
      label: { type: "string" },
      options: { type: "array", items: ref("FilterOption") },
    },
  },
  UserFilterOptions: {
    type: "object",
    required: ["fields", "statusOptions", "additionalFilters"],
    properties: {
      fields: { type: "array", items: ref("FilterField") },
      statusOptions: { type: "array", items: ref("FilterOption") },
      additionalFilters: { type: "array", items: ref("FilterField") },
    },
  },
};
