import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { QuickFilterState } from "@/types/quick-filter";
import type { ManagementFilterOptions } from "@/types/management-filters";
import type { TableSort } from "@/types/table-views";
import { RECEIVING_FILTER_OPTIONS } from "@/utils/management-filters";
import type {
  CreateReceivingInput,
  DeleteReceivingResponse,
  ReceivingOptions,
  ReceivingResponse,
  ReceivingSummary,
  ReceivingsPage,
  UpdateReceivingInput,
} from "@/types/receiving";

export type ReceivingFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type ReceivingsQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_order?: TableSort["direction"];
  filters?: QuickFilterState;
};
type State = {
  receivings: ReceivingSummary[];
  total: number;
  selectedReceiving: ReceivingSummary | null;
  options: ReceivingOptions;
  filterOptions: ManagementFilterOptions;
  filterOptionsStatus: Status;
  filterOptionsError: ReceivingFailure | null;
  filterOptionsRequestId: string | null;
  listStatus: Status;
  detailStatus: Status;
  optionsStatus: Status;
  mutationStatus: Status;
  listError: ReceivingFailure | null;
  detailError: ReceivingFailure | null;
  optionsError: ReceivingFailure | null;
  mutationError: ReceivingFailure | null;
  listRequestId: string | null;
  detailRequestId: string | null;
  optionsRequestId: string | null;
  mutationRequestId: string | null;
};

const emptyOptions: ReceivingOptions = { purchase_orders: [] };
const initialState: State = {
  receivings: [],
  total: 0,
  selectedReceiving: null,
  options: emptyOptions,
  filterOptions: RECEIVING_FILTER_OPTIONS,
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

function failure(error: unknown): ReceivingFailure {
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
    throw { status: response.status, message: "The API returned an unreadable response." };
  }
  if (!response.ok)
    throw { status: response.status, message: typeof data?.error === "string" ? data.error : "The request failed." };
  return data as T;
}

type Config = { state: RootState; rejectValue: ReceivingFailure };

export const listReceiving = createAsyncThunk<ReceivingsPage, ReceivingsQuery, Config>(
  "receiving/list",
  async (query, { signal, rejectWithValue }) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "")
        params.set(key, key === "filters" ? JSON.stringify(value) : String(value));
    try {
      return await request<ReceivingsPage>(`/api/receiving?${params}`, { signal });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
);

export const getReceivingFilterOption = createAsyncThunk<ManagementFilterOptions, void, Config>(
  "receiving/filter-options",
  async (_, { signal, rejectWithValue }) => {
    try {
      return await request<ManagementFilterOptions>("/api/receiving/filter-options", { signal });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
);

export const getReceivingOption = createAsyncThunk<ReceivingOptions, void, Config>(
  "receiving/options",
  async (_, { signal, rejectWithValue }) => {
    try {
      return await request<ReceivingOptions>("/api/receiving/options", { signal });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
);

export const editReceiving = createAsyncThunk<ReceivingResponse, string, Config>(
  "receiving/detail",
  async (id, { signal, rejectWithValue }) => {
    try {
      return await request<ReceivingResponse>(`/api/receiving?id=${encodeURIComponent(id)}`, { signal });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
);

const canMutate = (_: unknown, { getState }: { getState: () => RootState }) =>
  getState().receiving.mutationStatus !== "loading";

function send(url: string, method: string, body?: unknown) {
  return request<ReceivingResponse>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const createReceiving = createAsyncThunk<ReceivingResponse, CreateReceivingInput, Config>(
  "receiving/create",
  async (input, { rejectWithValue }) => {
    try {
      return await send("/api/receiving", "POST", input);
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const updateReceiving = createAsyncThunk<ReceivingResponse, UpdateReceivingInput, Config>(
  "receiving/update",
  async (input, { rejectWithValue }) => {
    try {
      return await send("/api/receiving", "PATCH", input);
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const postReceiving = createAsyncThunk<ReceivingResponse, string, Config>(
  "receiving/post",
  async (id, { rejectWithValue }) => {
    try {
      return await send("/api/receiving/post", "POST", { id });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

export const deleteReceiving = createAsyncThunk<DeleteReceivingResponse, string, Config>(
  "receiving/delete",
  async (id, { rejectWithValue }) => {
    try {
      return await request<DeleteReceivingResponse>(`/api/receiving?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (error) {
      return rejectWithValue(failure(error));
    }
  },
  { condition: canMutate },
);

const slice = createSlice({
  name: "receiving",
  initialState,
  reducers: {
    clearReceivingMutation(state) {
      if (state.mutationStatus !== "loading") {
        state.mutationStatus = "idle";
        state.mutationError = null;
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(listReceiving.pending, (state, action) => {
        state.listStatus = "loading";
        state.listError = null;
        state.listRequestId = action.meta.requestId;
      })
      .addCase(listReceiving.fulfilled, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.receivings = action.payload.receivings;
        state.total = action.payload.total;
        state.listStatus = "succeeded";
        state.listRequestId = null;
      })
      .addCase(listReceiving.rejected, (state, action) => {
        if (state.listRequestId !== action.meta.requestId) return;
        state.listStatus = action.meta.aborted ? "idle" : "failed";
        state.listError = action.meta.aborted ? null : (action.payload ?? failure(action.error));
        state.listRequestId = null;
      })
      .addCase(getReceivingFilterOption.pending, (state, action) => {
        state.filterOptionsStatus = "loading";
        state.filterOptionsError = null;
        state.filterOptionsRequestId = action.meta.requestId;
      })
      .addCase(getReceivingFilterOption.fulfilled, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId || !action.payload?.fields) return;
        state.filterOptions = action.payload;
        state.filterOptionsStatus = "succeeded";
        state.filterOptionsRequestId = null;
      })
      .addCase(getReceivingFilterOption.rejected, (state, action) => {
        if (state.filterOptionsRequestId !== action.meta.requestId) return;
        state.filterOptionsStatus = action.meta.aborted ? "idle" : "failed";
        state.filterOptionsError = action.meta.aborted ? null : (action.payload ?? failure(action.error));
        state.filterOptionsRequestId = null;
      })
      .addCase(getReceivingOption.pending, (state, action) => {
        state.optionsStatus = "loading";
        state.optionsError = null;
        state.optionsRequestId = action.meta.requestId;
      })
      .addCase(getReceivingOption.fulfilled, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.options = action.payload;
        state.optionsStatus = "succeeded";
        state.optionsRequestId = null;
      })
      .addCase(getReceivingOption.rejected, (state, action) => {
        if (state.optionsRequestId !== action.meta.requestId) return;
        state.optionsStatus = action.meta.aborted ? "idle" : "failed";
        state.optionsError = action.meta.aborted ? null : (action.payload ?? failure(action.error));
        state.optionsRequestId = null;
      })
      .addCase(editReceiving.pending, (state, action) => {
        state.detailStatus = "loading";
        state.selectedReceiving = null;
        state.detailError = null;
        state.detailRequestId = action.meta.requestId;
      })
      .addCase(editReceiving.fulfilled, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.selectedReceiving = action.payload.receiving;
        state.detailStatus = "succeeded";
        state.detailRequestId = null;
      })
      .addCase(editReceiving.rejected, (state, action) => {
        if (state.detailRequestId !== action.meta.requestId) return;
        state.detailStatus = action.meta.aborted ? "idle" : "failed";
        state.detailError = action.meta.aborted ? null : (action.payload ?? failure(action.error));
        state.detailRequestId = null;
      })
      .addMatcher(isAnyOf(createReceiving.pending, updateReceiving.pending, postReceiving.pending, deleteReceiving.pending), (state, action) => {
        state.mutationStatus = "loading";
        state.mutationError = null;
        state.mutationRequestId = action.meta.requestId;
      })
      .addMatcher(isAnyOf(createReceiving.fulfilled, updateReceiving.fulfilled, postReceiving.fulfilled, deleteReceiving.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded";
        state.mutationRequestId = null;
        state.listStatus = "idle";
        state.listError = null;
        state.listRequestId = null;
        if ("receiving" in action.payload) state.selectedReceiving = action.payload.receiving;
        else state.selectedReceiving = null;
      })
      .addMatcher(isAnyOf(createReceiving.rejected, updateReceiving.rejected, postReceiving.rejected, deleteReceiving.rejected), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "failed";
        state.mutationError = action.payload ?? failure(action.error);
        state.mutationRequestId = null;
      });
  },
});

export const receivingReducer = slice.reducer;
export const { clearReceivingMutation } = slice.actions;
export function selectReceiving(state: RootState) {
  const receiving = state.receiving;
  return {
    ...receiving,
    filterOptions: receiving.filterOptions ?? RECEIVING_FILTER_OPTIONS,
    options: receiving.options ?? emptyOptions,
  };
}
