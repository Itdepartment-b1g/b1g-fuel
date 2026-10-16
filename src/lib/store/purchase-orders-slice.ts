import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { PURCHASE_ORDER_FILTER_OPTIONS } from "@/utils/management-filters";
import type {
  CreatePurchaseOrderInput,
  DeletePurchaseOrderResponse,
  PurchaseOrderOptions,
  PurchaseOrderResponse,
  PurchaseOrderSummary,
  PurchaseOrdersPage,
  UpdatePurchaseOrderInput,
} from "@/types/purchase-orders";

export type PurchaseOrderFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type PurchaseOrdersQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: TableSort["direction"];
  filters?: QuickFilterState;
};
type State = {
  purchase_orders: PurchaseOrderSummary[];
  total: number;
  selectedPurchaseOrder: PurchaseOrderSummary | null;
  options: PurchaseOrderOptions;
  filterOptions: ManagementFilterOptions;
  filterOptionsStatus: Status;
  filterOptionsError: PurchaseOrderFailure | null;
  filterOptionsRequestId: string | null;
  listStatus: Status;
  detailStatus: Status;
  optionsStatus: Status;
  mutationStatus: Status;
  listError: PurchaseOrderFailure | null;
  detailError: PurchaseOrderFailure | null;
  optionsError: PurchaseOrderFailure | null;
  mutationError: PurchaseOrderFailure | null;
  listRequestId: string | null;
  detailRequestId: string | null;
  optionsRequestId: string | null;
  mutationRequestId: string | null;
};

const emptyOptions: PurchaseOrderOptions = {
  companies: [],
  suppliers: [],
  locations: [],
  variants: [],
  product_types: [],
  units: [],
};

const initialState: State = {
  purchase_orders: [],
  total: 0,
  selectedPurchaseOrder: null,
  options: emptyOptions,
  filterOptions: PURCHASE_ORDER_FILTER_OPTIONS,
  filterOptionsStatus: "idle",
  filterOptionsError: null,
  filterOptionsRequestId: null,
  listStatus: "idle",
  detailStatus: "idle",
  optionsStatus: "idle",
  mutationStatus: "idle",
  listError: null,
  detailError: null,
  optionsError: null,
  mutationError: null,
  listRequestId: null,
  detailRequestId: null,
  optionsRequestId: null,
  mutationRequestId: null,
};

function failure(error: unknown): PurchaseOrderFailure {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "message" in error &&
    typeof error.status === "number" &&
    typeof error.message === "string"
  ) {
    return { status: error.status, message: error.message };
  }
  return { status: 0, message: "Unable to reach the API. Please try again." };
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  let data;
  try {
    data = await response.json();
  } catch {
    throw {
      status: response.status,
      message: "The API returned an unreadable response.",
    };
  }
  if (!response.ok)
    throw {
      status: response.status,
      message: typeof data?.error === "string" ? data.error : "The request failed.",
    };
  return data as T;
}

type Config = { state: RootState; rejectValue: PurchaseOrderFailure };

export const listPurchaseOrder = createAsyncThunk<
  PurchaseOrdersPage,
  PurchaseOrdersQuery,
  Config
>("purchaseOrders/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "")
      params.set(key, key === "filters" ? JSON.stringify(value) : String(value));
  try {
    return await request<PurchaseOrdersPage>(`/api/purchase-orders?${params}`, { signal });
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

export const getPurchaseOrderFilterOption = createAsyncThunk<
  ManagementFilterOptions,
  void,
  Config
>("purchaseOrders/filter-options", async (_, { signal, rejectWithValue }) => {
  try {
    return await request<ManagementFilterOptions>("/api/purchase-orders/filter-options", {
      signal,
    });
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

export const getPurchaseOrderOption = createAsyncThunk<PurchaseOrderOptions, void, Config>(
  "purchaseOrders/options",
  async (_, { signal, rejectWithValue }) => {
    try {
      return await request<PurchaseOrderOptions>("/api/purchase-orders/options", { signal });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
);

export const editPurchaseOrder = createAsyncThunk<PurchaseOrderResponse, string, Config>(
  "purchaseOrders/detail",
  async (id, { signal, rejectWithValue }) => {
    try {
      return await request<PurchaseOrderResponse>(
        `/api/purchase-orders?id=${encodeURIComponent(id)}`,
        { signal },
      );
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
);

const canMutate = (_: unknown, { getState }: { getState: () => RootState }) =>
  getState().purchaseOrders.mutationStatus !== "loading";

function send(url: string, method: string, body?: unknown) {
  return request<PurchaseOrderResponse>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const createPurchaseOrder = createAsyncThunk<
  PurchaseOrderResponse,
  CreatePurchaseOrderInput,
  Config
>(
  "purchaseOrders/create",
  async (input, { rejectWithValue }) => {
    try {
      return await send("/api/purchase-orders", "POST", input);
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const updatePurchaseOrder = createAsyncThunk<
  PurchaseOrderResponse,
  UpdatePurchaseOrderInput,
  Config
>(
  "purchaseOrders/update",
  async (input, { rejectWithValue }) => {
    try {
      return await send("/api/purchase-orders", "PATCH", input);
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const confirmPurchaseOrder = createAsyncThunk<PurchaseOrderResponse, string, Config>(
  "purchaseOrders/confirm",
  async (id, { rejectWithValue }) => {
    try {
      return await send("/api/purchase-orders/confirm", "POST", { id });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const closePurchaseOrder = createAsyncThunk<PurchaseOrderResponse, string, Config>(
  "purchaseOrders/close",
  async (id, { rejectWithValue }) => {
    try {
      return await send("/api/purchase-orders/close", "POST", { id });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const deletePurchaseOrder = createAsyncThunk<
  DeletePurchaseOrderResponse,
  string,
  Config
>(
  "purchaseOrders/delete",
  async (id, { rejectWithValue }) => {
    try {
      return await request<DeletePurchaseOrderResponse>(
        `/api/purchase-orders?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

const slice = createSlice({
  name: "purchaseOrders",
  initialState,
  reducers: {
    clearPurchaseOrderMutation(state) {
      if (state.mutationStatus !== "loading") {
        state.mutationStatus = "idle";
        state.mutationError = null;
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(listPurchaseOrder.pending, (state, action) => {
        state.listStatus = "loading";
        state.listError = null;
        state.listRequestId = action.meta.requestId;
      })
      .addCase(listPurchaseOrder.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.purchase_orders = action.payload.purchase_orders;
        state.total = action.payload.total;
        state.listStatus = "succeeded";
        state.listRequestId = null;
      })
      .addCase(listPurchaseOrder.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listStatus = action.meta.aborted ? "idle" : "failed";
        state.listError = action.meta.aborted ? null : (action.payload ?? failure(action.error));
        state.listRequestId = null;
      })
      .addCase(getPurchaseOrderFilterOption.pending, (state, action) => {
        state.filterOptionsStatus = "loading";
        state.filterOptionsError = null;
        state.filterOptionsRequestId = action.meta.requestId;
      })
      .addCase(getPurchaseOrderFilterOption.fulfilled, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId || !action.payload?.fields)
          return;
        state.filterOptions = action.payload;
        state.filterOptionsStatus = "succeeded";
        state.filterOptionsRequestId = null;
      })
      .addCase(getPurchaseOrderFilterOption.rejected, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId) return;
        state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed";
        state.filterOptionsError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.filterOptionsRequestId = null;
      })
      .addCase(getPurchaseOrderOption.pending, (state, action) => {
        state.optionsStatus = "loading";
        state.optionsError = null;
        state.optionsRequestId = action.meta.requestId;
      })
      .addCase(getPurchaseOrderOption.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.options = action.payload;
        state.optionsStatus = "succeeded";
        state.optionsRequestId = null;
      })
      .addCase(getPurchaseOrderOption.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsStatus = action.meta.aborted ? "idle" : "failed";
        state.optionsError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.optionsRequestId = null;
      })
      .addCase(editPurchaseOrder.pending, (state, action) => {
        state.detailStatus = "loading";
        state.selectedPurchaseOrder = null;
        state.detailError = null;
        state.detailRequestId = action.meta.requestId;
      })
      .addCase(editPurchaseOrder.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.selectedPurchaseOrder = action.payload.purchase_order;
        state.detailStatus = "succeeded";
        state.detailRequestId = null;
      })
      .addCase(editPurchaseOrder.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.detailStatus = action.meta.aborted ? "idle" : "failed";
        state.detailError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.detailRequestId = null;
      })
      .addMatcher(
        isAnyOf(
          createPurchaseOrder.pending,
          updatePurchaseOrder.pending,
          confirmPurchaseOrder.pending,
          closePurchaseOrder.pending,
          deletePurchaseOrder.pending,
        ),
        (state, action) => {
          state.mutationStatus = "loading";
          state.mutationError = null;
          state.mutationRequestId = action.meta.requestId;
        },
      )
      .addMatcher(
        isAnyOf(
          createPurchaseOrder.fulfilled,
          updatePurchaseOrder.fulfilled,
          confirmPurchaseOrder.fulfilled,
          closePurchaseOrder.fulfilled,
          deletePurchaseOrder.fulfilled,
        ),
        (state, action) => {
          if (state.mutationRequestId !== action.meta.requestId) return;
          state.mutationStatus = "succeeded";
          state.mutationRequestId = null;
          state.listStatus = "idle";
          state.listError = null;
          state.listRequestId = null;
          if ("purchase_order" in action.payload)
            state.selectedPurchaseOrder = action.payload.purchase_order;
          else state.selectedPurchaseOrder = null;
        },
      )
      .addMatcher(
        isAnyOf(
          createPurchaseOrder.rejected,
          updatePurchaseOrder.rejected,
          confirmPurchaseOrder.rejected,
          closePurchaseOrder.rejected,
          deletePurchaseOrder.rejected,
        ),
        (state, action) => {
          if (state.mutationRequestId !== action.meta.requestId) return;
          state.mutationStatus = "failed";
          state.mutationError = action.payload ?? failure(action.error);
          state.mutationRequestId = null;
        },
      );
  },
});

export const purchaseOrdersReducer = slice.reducer;
export const { clearPurchaseOrderMutation } = slice.actions;
export function selectPurchaseOrder(state: RootState) {
  const purchaseOrders = state.purchaseOrders;
  return {
    ...purchaseOrders,
    filterOptions: purchaseOrders.filterOptions ?? PURCHASE_ORDER_FILTER_OPTIONS,
    options: purchaseOrders.options ?? emptyOptions,
  };
}
