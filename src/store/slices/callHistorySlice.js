import { createSlice, createAsyncThunk, nanoid } from "@reduxjs/toolkit";

const MAX_CALL_HISTORY = 100;

// Async thunk to fetch call history from API
export const fetchCallHistory = createAsyncThunk(
  "callHistory/fetch",
  async ({ token, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/call-history?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to fetch call history");
      }

      const data = await response.json();
      return data.calls || [];
    } catch (error) {
      return rejectWithValue("Network error. Please try again.");
    }
  }
);

const initialState = {
  calls: [], // Array of call history entries
  isLoading: false,
  error: null,
  lastFetched: null,
};

const callHistorySlice = createSlice({
  name: "callHistory",
  initialState,
  reducers: {
    addCallToHistory: {
      reducer: (state, action) => {
        const call = action.payload;
        if (!call) return;

        // Prevent duplicates by call ID if it exists
        if (call.id && state.calls.some((c) => c.id === call.id)) {
          return;
        }

        // Add to beginning of array (most recent first)
        state.calls.unshift(call);

        // Limit the number of stored calls
        if (state.calls.length > MAX_CALL_HISTORY) {
          state.calls = state.calls.slice(0, MAX_CALL_HISTORY);
        }
      },
      prepare: (payload) => {
        const {
          id = nanoid(),
          timestamp = new Date().toISOString(),
          ...rest
        } = payload || {};

        return {
          payload: {
            id,
            timestamp,
            ...rest,
          },
        };
      },
    },

    updateCallInHistory: (state, action) => {
      const { callId, updates } = action.payload;
      const callIndex = state.calls.findIndex((call) => call.id === callId);
      
      if (callIndex !== -1) {
        state.calls[callIndex] = {
          ...state.calls[callIndex],
          ...updates,
        };
      }
    },

    removeCallFromHistory: (state, action) => {
      const callId = action.payload;
      state.calls = state.calls.filter((call) => call.id !== callId);
    },

    clearCallHistory: (state) => {
      state.calls = [];
      state.error = null;
    },

    clearCallHistoryError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch call history
      .addCase(fetchCallHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCallHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.calls = action.payload;
        state.lastFetched = new Date().toISOString();
        state.error = null;
      })
      .addCase(fetchCallHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  addCallToHistory,
  updateCallInHistory,
  removeCallFromHistory,
  clearCallHistory,
  clearCallHistoryError,
} = callHistorySlice.actions;

// Selectors
export const selectCallHistory = (state) => state.callHistory.calls;
export const selectCallHistoryLoading = (state) => state.callHistory.isLoading;
export const selectCallHistoryError = (state) => state.callHistory.error;

export default callHistorySlice.reducer;

