const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const error = { description: "Request failed", ...json(ref("Error")) };
const errors = { "400": error, "401": error, "403": error, "404": error, "409": error, "500": error };
const id = { type: "string", format: "uuid" };

export const receivingSchemas = {
  CreateReceiving: {
    type: "object",
    additionalProperties: false,
    required: ["purchase_order_id", "lines"],
    properties: {
      purchase_order_id: id,
      notes: { type: "string", maxLength: 1000 },
      lines: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["purchase_order_item_id", "qty"],
          properties: {
            purchase_order_item_id: id,
            qty: { type: "string", example: "80" },
          },
        },
      },
    },
  },
};

export const receivingPaths = {
  "/api/receiving": {
    get: {
      tags: ["Receiving"],
      summary: "List receipts or load one",
      description: "Requires receiving.view. A draft receipt does not change received quantities. Pass id to load one receipt.",
      security: [{ session: [] }],
      responses: { "200": { description: "Receipts" }, ...errors },
    },
    post: {
      tags: ["Receiving"],
      summary: "Create a draft receipt",
      description: "Requires receiving.add. The receipt uses the purchase order warehouse. Quantity cannot exceed the amount still outstanding.",
      security: [{ session: [] }],
      requestBody: { required: true, ...json(ref("CreateReceiving")) },
      responses: { "201": { description: "Draft created" }, ...errors },
    },
  },
  "/api/receiving/post": {
    post: {
      tags: ["Receiving"],
      summary: "Post a draft receipt",
      description: "Requires receiving.edit. Posting increases the purchase order received quantities and writes a timeline event. Stock is unchanged until stock balances exist.",
      security: [{ session: [] }],
      responses: { "200": { description: "Receipt posted" }, ...errors },
    },
  },
};
