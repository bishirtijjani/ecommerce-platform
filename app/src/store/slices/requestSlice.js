/**
 * Request slice - the reverse-marketplace "I need X" surface.
 *
 * A customer posts a need; the backend matches nearby sellers and pushes it to
 * them; sellers reply with a message + optional price; the customer accepts
 * one. Mirrors the supportSlice patterns: envelope-unwrapping HTTP,
 * idempotency keys on creation, rejectWithValue carries the full error so
 * screens can read .status / .data for validation surfaces.
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';

export const fetchMyRequests = createAsyncThunk(
  'request/fetchMine',
  async ({ status, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('page', page);
      params.append('limit', limit);
      const envelope = await api.get(`/requests?${params.toString()}`);
      return { items: envelope?.data?.items || [], total: envelope?.data?.total || 0 };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load requests');
    }
  },
);

export const createRequest = createAsyncThunk(
  'request/create',
  async (data, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/requests', data, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue({
        message: error?.message || 'Failed to post request',
        status: error?.status ?? null,
        data: error?.data ?? null,
      });
    }
  },
);

export const fetchRequestDetail = createAsyncThunk(
  'request/fetchDetail',
  async (requestId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/requests/${requestId}`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load request');
    }
  },
);

export const cancelRequest = createAsyncThunk(
  'request/cancel',
  async (requestId, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/requests/${requestId}/cancel`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to cancel request');
    }
  },
);

export const repostRequest = createAsyncThunk(
  'request/repost',
  async (requestId, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/requests/${requestId}/repost`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to repost request');
    }
  },
);

export const acceptResponse = createAsyncThunk(
  'request/accept',
  async ({ requestId, responseId }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/requests/${requestId}/accept`, { responseId });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to accept response');
    }
  },
);

const initialState = {
  myRequests: [],
  myRequestsLoading: false,
  myRequestsError: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  submitting: false,
};

const upsertDetail = (state, payload) => {
  if (!payload) return;
  state.detail = payload;
  const idx = state.myRequests.findIndex((r) => r.id === payload.id);
  if (idx !== -1) state.myRequests[idx] = { ...state.myRequests[idx], ...payload };
};

const requestSlice = createSlice({
  name: 'request',
  initialState,
  reducers: {
    clearRequestDetail(state) {
      state.detail = null;
      state.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyRequests.pending, (state) => {
        state.myRequestsLoading = true;
        state.myRequestsError = null;
      })
      .addCase(fetchMyRequests.fulfilled, (state, action) => {
        state.myRequestsLoading = false;
        state.myRequests = action.payload?.items || [];
      })
      .addCase(fetchMyRequests.rejected, (state, action) => {
        state.myRequestsLoading = false;
        state.myRequestsError = action.payload || 'Failed to load requests';
      })

      .addCase(createRequest.pending, (state) => {
        state.submitting = true;
      })
      .addCase(createRequest.fulfilled, (state, action) => {
        state.submitting = false;
        if (action.payload) {
          state.myRequests = [action.payload, ...state.myRequests];
          state.detail = action.payload;
        }
      })
      .addCase(createRequest.rejected, (state) => {
        state.submitting = false;
      })

      .addCase(fetchRequestDetail.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchRequestDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        upsertDetail(state, action.payload);
      })
      .addCase(fetchRequestDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || 'Failed to load request';
      })

      .addCase(cancelRequest.fulfilled, (state, action) => upsertDetail(state, action.payload))
      .addCase(repostRequest.fulfilled, (state, action) => upsertDetail(state, action.payload))
      .addCase(acceptResponse.fulfilled, (state, action) => upsertDetail(state, action.payload));
  },
});

export const { clearRequestDetail } = requestSlice.actions;
export default requestSlice.reducer;
