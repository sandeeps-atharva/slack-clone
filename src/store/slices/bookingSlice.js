import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Async thunks
export const fetchBookings = createAsyncThunk(
  "bookings/fetchBookings",
  async (filters = {}, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const params = new URLSearchParams();
      if (filters.room_id) params.append("room_id", filters.room_id);
      if (filters.user_id) params.append("user_id", filters.user_id);
      if (filters.status) params.append("status", filters.status);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);
      if (filters.upcoming_only) params.append("upcoming_only", "true");

      const res = await fetch(`/api/bookings?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        return data.bookings;
      } else {
        return rejectWithValue(data.error || "Failed to fetch bookings");
      }
    } catch (error) {
      return rejectWithValue("Network error while fetching bookings");
    }
  }
);

export const createBooking = createAsyncThunk(
  "bookings/createBooking",
  async (bookingData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bookingData),
      });

      const data = await res.json();

      if (res.ok) {
        return data.booking;
      } else {
        return rejectWithValue(data.error || "Failed to create booking");
      }
    } catch (error) {
      return rejectWithValue("Network error while creating booking");
    }
  }
);

export const updateBooking = createAsyncThunk(
  "bookings/updateBooking",
  async ({ bookingId, bookingData }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bookingData),
      });

      const data = await res.json();

      if (res.ok) {
        return data.booking;
      } else {
        return rejectWithValue(data.error || "Failed to update booking");
      }
    } catch (error) {
      return rejectWithValue("Network error while updating booking");
    }
  }
);

export const cancelBooking = createAsyncThunk(
  "bookings/cancelBooking",
  async (bookingId, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        return bookingId;
      } else {
        return rejectWithValue(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      return rejectWithValue("Network error while cancelling booking");
    }
  }
);

export const checkAvailability = createAsyncThunk(
  "bookings/checkAvailability",
  async ({ room_id, start_time, end_time }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const params = new URLSearchParams();
      params.append("start_time", start_time);
      params.append("end_time", end_time);
      if (room_id) params.append("room_id", room_id);

      const res = await fetch(`/api/bookings/availability?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        return data;
      } else {
        return rejectWithValue(data.error || "Failed to check availability");
      }
    } catch (error) {
      return rejectWithValue("Network error while checking availability");
    }
  }
);

const initialState = {
  bookings: [],
  upcomingBookings: [],
  myBookings: [],
  isLoading: false,
  error: null,
  availability: null,
};

const bookingSlice = createSlice({
  name: "bookings",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAvailability: (state) => {
      state.availability = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch bookings
      .addCase(fetchBookings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.bookings = action.payload;
        
        // Separate upcoming bookings
        const now = new Date();
        state.upcomingBookings = action.payload.filter(
          (booking) => new Date(booking.start_time) >= now
        );
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create booking
      .addCase(createBooking.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.isLoading = false;
        // Check if booking already exists (avoid duplicates)
        const exists = state.bookings.find(b => b.id === action.payload.id);
        if (!exists) {
          state.bookings.push(action.payload);
        }
        const now = new Date();
        if (new Date(action.payload.start_time) >= now) {
          const upcomingExists = state.upcomingBookings.find(b => b.id === action.payload.id);
          if (!upcomingExists) {
            state.upcomingBookings.push(action.payload);
          }
        }
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update booking
      .addCase(updateBooking.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateBooking.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.bookings.findIndex((b) => b.id === action.payload.id);
        if (index !== -1) {
          state.bookings[index] = action.payload;
        } else {
          state.bookings.push(action.payload);
        }
        const upcomingIndex = state.upcomingBookings.findIndex((b) => b.id === action.payload.id);
        const now = new Date();
        const isUpcoming = new Date(action.payload.start_time) >= now;
        if (upcomingIndex !== -1) {
          if (isUpcoming) {
            state.upcomingBookings[upcomingIndex] = action.payload;
          } else {
            state.upcomingBookings.splice(upcomingIndex, 1);
          }
        } else if (isUpcoming) {
          state.upcomingBookings.push(action.payload);
        }
      })
      .addCase(updateBooking.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Cancel booking
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.bookings = state.bookings.filter((b) => b.id !== action.payload);
        state.upcomingBookings = state.upcomingBookings.filter((b) => b.id !== action.payload);
      })
      // Check availability
      .addCase(checkAvailability.fulfilled, (state, action) => {
        state.availability = action.payload;
      });
  },
});

export const { clearError, clearAvailability } = bookingSlice.actions;
export default bookingSlice.reducer;

