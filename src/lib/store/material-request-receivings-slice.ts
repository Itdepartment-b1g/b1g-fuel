import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { MaterialRequestReceiptsPage } from "@/types/material-requests";

type Failure = { status: number; message: string };
type Query = { page?: number; page_size?: number; search?: string; sort_by?: string; sort_order?: "asc" | "desc" };
type Config = { state: RootState; rejectValue: Failure };

function failure(error: unknown): Failure {
  return error && typeof error === "object" && "status" in error && "message" in error ? error as Failure : { status: 0, message: "Unable to reach the API. Try again." };
}

export const listMaterialRequestReceipts = createAsyncThunk<MaterialRequestReceiptsPage, Query, Config>("materialRequestReceivings/list", async (query, api) => {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  if (query.search) params.set("search", query.search);
  if (query.sort_by) params.set("sort_by", query.sort_by);
  if (query.sort_order) params.set("sort_order", query.sort_order);
  try {
    const response = await fetch(`/api/material-requests/receivings?${params}`, { credentials: "include", signal: api.signal });
    const data = await response.json();
    if (!response.ok) throw { status: response.status, message: data.error ?? "Request failed." };
    return data;
  } catch (error) {
    return api.rejectWithValue(failure(error));
  }
});

const slice = createSlice({
  name: "materialRequestReceivings",
  initialState: { receipts: [] as MaterialRequestReceiptsPage["receipts"], total: 0, page: 1, page_size: 10, loading: true, error: null as Failure | null, requestId: null as string | null },
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(listMaterialRequestReceipts.pending, (state, action) => { state.loading = true; state.error = null; state.requestId = action.meta.requestId; })
      .addCase(listMaterialRequestReceipts.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.receipts = action.payload.receipts;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.page_size = action.payload.page_size;
        state.loading = false;
        state.requestId = null;
      })
      .addCase(listMaterialRequestReceipts.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.meta.aborted ? null : action.payload ?? failure(action.error);
        state.requestId = null;
      });
  },
});

export const materialRequestReceivingsReducer = slice.reducer;
export function selectMaterialRequestReceipts(state: RootState) { return state.materialRequestReceivings; }
