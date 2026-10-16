import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { PRODUCT_TYPE_FILTER_OPTIONS } from "@/utils/management-filters";
import type {
  CreateProductTypeInput,
  DeleteProductTypeResponse,
  ProductTypeOptions,
  ProductTypeResponse,
  ProductTypeSummary,
  ProductTypesPage,
  UpdateProductTypeInput,
} from "@/types/product-types";

export type ProductTypeFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type ProductTypesQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  company_id?: string;
  sort_by?: string;
  sort_order?: TableSort["direction"];
  filters?: QuickFilterState;
};
type State = {
  product_types: ProductTypeSummary[];
  total: number;
  selectedProductType: ProductTypeSummary | null;
  options: ProductTypeOptions;
  filterOptions: ManagementFilterOptions;
  filterOptionsStatus: Status;
  filterOptionsError: ProductTypeFailure | null;
  filterOptionsRequestId: string | null;
  listStatus: Status;
  detailStatus: Status;
  optionsStatus: Status;
  mutationStatus: Status;
  listError: ProductTypeFailure | null;
  detailError: ProductTypeFailure | null;
  optionsError: ProductTypeFailure | null;
  mutationError: ProductTypeFailure | null;
  listRequestId: string | null;
  detailRequestId: string | null;
  optionsRequestId: string | null;
  mutationRequestId: string | null;
};

const initialState: State = {
  product_types: [],
  total: 0,
  selectedProductType: null,
  options: { companies: [] },
  filterOptions: PRODUCT_TYPE_FILTER_OPTIONS,
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

function failure(error: unknown): ProductTypeFailure {
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
      message:
        typeof data?.error === "string" ? data.error : "The request failed.",
    };
  return data as T;
}

type Config = { state: RootState; rejectValue: ProductTypeFailure };

export const listProductType = createAsyncThunk<
  ProductTypesPage,
  ProductTypesQuery,
  Config
>("productTypes/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "")
      params.set(
        key,
        key === "filters" ? JSON.stringify(value) : String(value),
      );
  try {
    return await request<ProductTypesPage>(`/api/product-types?${params}`, {
      signal,
    });
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

export const getProductTypeFilterOption = createAsyncThunk<
  ManagementFilterOptions,
  void,
  Config
>("productTypes/filter-options", async (_, { signal, rejectWithValue }) => {
  try {
    return await request<ManagementFilterOptions>(
      "/api/product-types/filter-options",
      { signal },
    );
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

export const getProductTypeOption = createAsyncThunk<
  ProductTypeOptions,
  void,
  Config
>("productTypes/options", async (_, { signal, rejectWithValue }) => {
  try {
    return await request<ProductTypeOptions>("/api/product-types/options", {
      signal,
    });
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

export const editProductType = createAsyncThunk<
  ProductTypeResponse,
  string,
  Config
>("productTypes/detail", async (id, { signal, rejectWithValue }) => {
  try {
    return await request<ProductTypeResponse>(
      `/api/product-types?id=${encodeURIComponent(id)}`,
      { signal },
    );
  } catch (error) {
    return rejectWithValue(failure(error));
  }
});

const canMutate = (_: unknown, { getState }: { getState: () => RootState }) =>
  getState().productTypes.mutationStatus !== "loading";

export const createProductType = createAsyncThunk<
  ProductTypeResponse,
  CreateProductTypeInput,
  Config
>(
  "productTypes/create",
  async (input, { rejectWithValue }) => {
    try {
      return await request<ProductTypeResponse>("/api/product-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const updateProductType = createAsyncThunk<
  ProductTypeResponse,
  UpdateProductTypeInput,
  Config
>(
  "productTypes/update",
  async (input, { rejectWithValue }) => {
    try {
      return await request<ProductTypeResponse>("/api/product-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const deleteProductType = createAsyncThunk<
  DeleteProductTypeResponse,
  string,
  Config
>(
  "productTypes/delete",
  async (id, { rejectWithValue }) => {
    try {
      return await request<DeleteProductTypeResponse>(
        `/api/product-types?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

const slice = createSlice({
  name: "productTypes",
  initialState,
  reducers: {
    resetProductTypes: () => initialState,
    clearProductTypeMutation(state) {
      if (state.mutationStatus !== "loading") {
        state.mutationStatus = "idle";
        state.mutationError = null;
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(listProductType.pending, (state, action) => {
        state.listStatus = "loading";
        state.listError = null;
        state.listRequestId = action.meta.requestId;
      })
      .addCase(listProductType.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.product_types = action.payload.product_types;
        state.total = action.payload.total;
        state.listStatus = "succeeded";
        state.listRequestId = null;
      })
      .addCase(listProductType.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listStatus = action.meta.aborted ? "idle" : "failed";
        state.listError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.listRequestId = null;
      })
      .addCase(getProductTypeFilterOption.pending, (state, action) => {
        state.filterOptionsStatus = "loading";
        state.filterOptionsError = null;
        state.filterOptionsRequestId = action.meta.requestId;
      })
      .addCase(getProductTypeFilterOption.fulfilled, (state, action) => {
        if (
          state.filterOptionsRequestId !== action.meta.requestId ||
          !action.payload?.fields
        )
          return;
        state.filterOptions = action.payload;
        state.filterOptionsStatus = "succeeded";
        state.filterOptionsRequestId = null;
      })
      .addCase(getProductTypeFilterOption.rejected, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId) return;
        state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed";
        state.filterOptionsError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.filterOptionsRequestId = null;
      })
      .addCase(getProductTypeOption.pending, (state, action) => {
        state.optionsStatus = "loading";
        state.optionsError = null;
        state.optionsRequestId = action.meta.requestId;
      })
      .addCase(getProductTypeOption.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.options = action.payload;
        state.optionsStatus = "succeeded";
        state.optionsRequestId = null;
      })
      .addCase(getProductTypeOption.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsStatus = action.meta.aborted ? "idle" : "failed";
        state.optionsError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.optionsRequestId = null;
      })
      .addCase(editProductType.pending, (state, action) => {
        state.detailStatus = "loading";
        state.selectedProductType = null;
        state.detailError = null;
        state.detailRequestId = action.meta.requestId;
      })
      .addCase(editProductType.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.selectedProductType = action.payload.product_type;
        state.detailStatus = "succeeded";
        state.detailRequestId = null;
      })
      .addCase(editProductType.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.detailStatus = action.meta.aborted ? "idle" : "failed";
        state.detailError = action.meta.aborted
          ? null
          : (action.payload ?? failure(action.error));
        state.detailRequestId = null;
      })
      .addMatcher(
        isAnyOf(
          createProductType.pending,
          updateProductType.pending,
          deleteProductType.pending,
        ),
        (state, action) => {
          state.mutationStatus = "loading";
          state.mutationError = null;
          state.mutationRequestId = action.meta.requestId;
        },
      )
      .addMatcher(
        isAnyOf(
          createProductType.fulfilled,
          updateProductType.fulfilled,
          deleteProductType.fulfilled,
        ),
        (state, action) => {
          if (state.mutationRequestId !== action.meta.requestId) return;
          state.mutationStatus = "succeeded";
          state.mutationRequestId = null;
          state.listRequestId = null;
          state.listStatus = "idle";
          state.listError = null;
          state.detailRequestId = null;
          state.detailError = null;
          if ("product_type" in action.payload)
            state.selectedProductType = action.payload.product_type;
          else state.selectedProductType = null;
          state.detailStatus = state.selectedProductType
            ? "succeeded"
            : "idle";
        },
      )
      .addMatcher(
        isAnyOf(
          createProductType.rejected,
          updateProductType.rejected,
          deleteProductType.rejected,
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

export const productTypesReducer = slice.reducer;
export const { resetProductTypes, clearProductTypeMutation } = slice.actions;
export function selectProductType(state: RootState) {
  const productTypes = state.productTypes;
  return {
    ...productTypes,
    filterOptions: productTypes.filterOptions ?? PRODUCT_TYPE_FILTER_OPTIONS,
    options: productTypes.options ?? { companies: [] },
  };
}
