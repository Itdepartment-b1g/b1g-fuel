import { createAsyncThunk, createSlice, isAnyOf } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { TableSort } from "@/types/table-views";
import type { CreateVariantInput, DeleteVariantResponse, UpdateVariantInput, VariantOptions, VariantResponse, VariantSummary, VariantsPage } from "@/types/variants";

export type VariantFailure = { status: number; message: string };
type Status = "idle" | "loading" | "succeeded" | "failed";
export type VariantsQuery = { page?: number; page_size?: number; search?: string; brand_id?: string; company_id?: string; sort_by?: string; sort_order?: TableSort["direction"] };
type State = {
  variants: VariantSummary[]; total: number; selectedVariant: VariantSummary | null;
  options: VariantOptions;
  listStatus: Status; detailStatus: Status; optionsStatus: Status; mutationStatus: Status;
  listError: VariantFailure | null; detailError: VariantFailure | null; optionsError: VariantFailure | null; mutationError: VariantFailure | null;
  listRequestId: string | null; detailRequestId: string | null; optionsRequestId: string | null; mutationRequestId: string | null;
};
const initialState: State = {
  variants: [], total: 0, selectedVariant: null, options: { brands: [], companies: [] },
  listStatus: "idle", detailStatus: "idle", optionsStatus: "idle", mutationStatus: "idle",
  listError: null, detailError: null, optionsError: null, mutationError: null,
  listRequestId: null, detailRequestId: null, optionsRequestId: null, mutationRequestId: null,
};
function failure(error: unknown): VariantFailure {
  if (error && typeof error === "object" && "status" in error && "message" in error && typeof error.status === "number" && typeof error.message === "string") return { status: error.status, message: error.message };
  return { status: 0, message: "Unable to reach the API. Please try again." };
}
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  let data;
  try { data = await response.json(); }
  catch { throw { status: response.status, message: "The API returned an unreadable response." }; }
  if (!response.ok) throw { status: response.status, message: typeof data?.error === "string" ? data.error : "The request failed." };
  return data as T;
}
type Config = { state: RootState; rejectValue: VariantFailure };
export const listVariant = createAsyncThunk<VariantsPage, VariantsQuery, Config>("variants/list", async (query, { signal, rejectWithValue }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  try { return await request<VariantsPage>(`/api/variants?${params}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const editVariant = createAsyncThunk<VariantResponse, string, Config>("variants/detail", async (id, { signal, rejectWithValue }) => {
  try { return await request<VariantResponse>(`/api/variants?id=${encodeURIComponent(id)}`, { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
export const getVariantOption = createAsyncThunk<VariantOptions, void, Config>("variants/options", async (_, { signal, rejectWithValue }) => {
  try { return await request<VariantOptions>("/api/variants/options", { signal }); }
  catch (error) { return rejectWithValue(failure(error)); }
});
const canMutate = (_: unknown, { getState }: { getState: () => RootState }) => getState().variants.mutationStatus !== "loading";
export const createVariant = createAsyncThunk<VariantResponse, CreateVariantInput, Config>("variants/create", async (input, { rejectWithValue }) => {
  try { return await request<VariantResponse>("/api/variants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const updateVariant = createAsyncThunk<VariantResponse, UpdateVariantInput, Config>("variants/update", async (input, { rejectWithValue }) => {
  try { return await request<VariantResponse>("/api/variants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
export const deleteVariant = createAsyncThunk<DeleteVariantResponse, string, Config>("variants/delete", async (id, { rejectWithValue }) => {
  try { return await request<DeleteVariantResponse>(`/api/variants?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { return rejectWithValue(failure(error)); }
}, { condition: canMutate });
const slice = createSlice({
  name: "variants", initialState,
  reducers: {
    resetVariants: () => initialState,
    clearVariantMutation(state) { if (state.mutationStatus !== "loading") { state.mutationStatus = "idle"; state.mutationError = null; } },
  },
  extraReducers(builder) {
    builder
      .addCase(listVariant.pending, (state, action) => { state.listStatus = "loading"; state.listError = null; state.listRequestId = action.meta.requestId; })
      .addCase(listVariant.fulfilled, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.variants = action.payload.variants; state.total = action.payload.total; state.listStatus = "succeeded"; state.listRequestId = null; })
      .addCase(listVariant.rejected, (state, action) => { if (state.listRequestId !== action.meta.requestId) return; state.listStatus = action.meta.aborted ? "idle" : "failed"; state.listError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.listRequestId = null; })
      .addCase(editVariant.pending, (state, action) => { state.detailStatus = "loading"; state.selectedVariant = null; state.detailError = null; state.detailRequestId = action.meta.requestId; })
      .addCase(editVariant.fulfilled, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.selectedVariant = action.payload.variant; state.detailStatus = "succeeded"; state.detailRequestId = null; })
      .addCase(editVariant.rejected, (state, action) => { if (state.detailRequestId !== action.meta.requestId) return; state.detailStatus = action.meta.aborted ? "idle" : "failed"; state.detailError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.detailRequestId = null; })
      .addCase(getVariantOption.pending, (state, action) => { state.optionsStatus = "loading"; state.optionsError = null; state.optionsRequestId = action.meta.requestId; })
      .addCase(getVariantOption.fulfilled, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.options = action.payload; state.optionsStatus = "succeeded"; state.optionsRequestId = null; })
      .addCase(getVariantOption.rejected, (state, action) => { if (state.optionsRequestId !== action.meta.requestId) return; state.optionsStatus = action.meta.aborted ? "idle" : "failed"; state.optionsError = action.meta.aborted ? null : action.payload ?? failure(action.error); state.optionsRequestId = null; })
      .addMatcher(isAnyOf(createVariant.pending, updateVariant.pending, deleteVariant.pending), (state, action) => { state.mutationStatus = "loading"; state.mutationError = null; state.mutationRequestId = action.meta.requestId; })
      .addMatcher(isAnyOf(createVariant.fulfilled, updateVariant.fulfilled, deleteVariant.fulfilled), (state, action) => {
        if (state.mutationRequestId !== action.meta.requestId) return;
        state.mutationStatus = "succeeded"; state.mutationRequestId = null;
        state.listRequestId = null; state.listStatus = "idle"; state.listError = null;
        state.detailRequestId = null; state.detailError = null;
        if ("variant" in action.payload) state.selectedVariant = action.payload.variant;
        else state.selectedVariant = null;
        state.detailStatus = state.selectedVariant ? "succeeded" : "idle";
      })
      .addMatcher(isAnyOf(createVariant.rejected, updateVariant.rejected, deleteVariant.rejected), (state, action) => { if (state.mutationRequestId !== action.meta.requestId) return; state.mutationStatus = "failed"; state.mutationError = action.payload ?? failure(action.error); state.mutationRequestId = null; });
  },
});
export const variantsReducer = slice.reducer;
export const { resetVariants, clearVariantMutation } = slice.actions;
export const selectVariant = (state: RootState) => state.variants;
