// store/slices/onlineStatusSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  onlineUserIds: [], // Array of user IDs that are currently online
};

const onlineStatusSlice = createSlice({
  name: "onlineStatus",
  initialState,
  reducers: {
    setUserOnline: (state, action) => {
      const userId = action.payload;
      if (userId && !state.onlineUserIds.includes(userId)) {
        state.onlineUserIds.push(userId);
      }
    },
    setUserOffline: (state, action) => {
      const userId = action.payload;
      if (userId) {
        state.onlineUserIds = state.onlineUserIds.filter((id) => id !== userId);
      }
    },
    setOnlineUsers: (state, action) => {
      // Replace the entire array with a new array of online user IDs
      state.onlineUserIds = action.payload || [];
    },
    clearOnlineUsers: (state) => {
      state.onlineUserIds = [];
    },
  },
});

export const { setUserOnline, setUserOffline, setOnlineUsers, clearOnlineUsers } =
  onlineStatusSlice.actions;

// Selector to check if a user is online
export const selectIsUserOnline = (state, userId) => {
  if (!userId) return false;
  return state.onlineStatus.onlineUserIds.includes(userId);
};

// Selector to get all online user IDs
export const selectOnlineUserIds = (state) => state.onlineStatus.onlineUserIds;

export default onlineStatusSlice.reducer;

