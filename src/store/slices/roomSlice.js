import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Async thunks
export const fetchRooms = createAsyncThunk(
  "rooms/fetchRooms",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch("/api/rooms", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        return data.rooms;
      } else {
        return rejectWithValue(data.error || "Failed to fetch rooms");
      }
    } catch (error) {
      return rejectWithValue("Network error while fetching rooms");
    }
  }
);

export const createRoom = createAsyncThunk(
  "rooms/createRoom",
  async (roomData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(roomData),
      });

      const data = await res.json();

      if (res.ok) {
        return data.room;
      } else {
        return rejectWithValue(data.error || "Failed to create room");
      }
    } catch (error) {
      return rejectWithValue("Network error while creating room");
    }
  }
);

export const updateRoom = createAsyncThunk(
  "rooms/updateRoom",
  async ({ roomId, roomData }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(roomData),
      });

      const data = await res.json();

      if (res.ok) {
        return data.room;
      } else {
        return rejectWithValue(data.error || "Failed to update room");
      }
    } catch (error) {
      return rejectWithValue("Network error while updating room");
    }
  }
);

export const deleteRoom = createAsyncThunk(
  "rooms/deleteRoom",
  async (roomId, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;

      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        return roomId;
      } else {
        return rejectWithValue(data.error || "Failed to delete room");
      }
    } catch (error) {
      return rejectWithValue("Network error while deleting room");
    }
  }
);

const initialState = {
  rooms: [],
  isLoading: false,
  error: null,
};

const roomSlice = createSlice({
  name: "rooms",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch rooms
      .addCase(fetchRooms.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRooms.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rooms = action.payload;
      })
      .addCase(fetchRooms.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create room
      .addCase(createRoom.fulfilled, (state, action) => {
        state.rooms.push(action.payload);
      })
      // Update room
      .addCase(updateRoom.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateRoom.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.rooms.findIndex((r) => r.id === action.payload.id);
        if (index !== -1) {
          state.rooms[index] = action.payload;
        }
      })
      .addCase(updateRoom.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete room
      .addCase(deleteRoom.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteRoom.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rooms = state.rooms.filter((r) => r.id !== action.payload);
      })
      .addCase(deleteRoom.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = roomSlice.actions;
export default roomSlice.reducer;

