// store/slices/notificationSlice.js
import { createSlice, nanoid } from "@reduxjs/toolkit";

const MAX_NOTIFICATIONS = 50;

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  message: true,
  dm: true,
  mention: true,
  call: true,
  sound: true,
};

const resolvePreferenceKey = (type) => {
  switch (type) {
    case "dm":
      return "dm";
    case "mention":
      return "mention";
    case "call":
      return "call";
    default:
      return "message";
  }
};

const initialState = {
  items: [],
  unreadCount: 0,
  preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addNotification: {
      reducer: (state, action) => {
        const notification = action.payload;

        if (!notification) return;

        const preferenceKey = resolvePreferenceKey(notification.type);
        if (state.preferences[preferenceKey] === false) {
          return;
        }

        // Prevent duplicates by messageId/thread if already present
        if (
          notification.messageId &&
          state.items.some(
            (item) =>
              item.messageId === notification.messageId &&
              item.channelId === notification.channelId &&
              item.type === notification.type
          )
        ) {
          return;
        }

        state.items.unshift(notification);
        if (!notification.read) {
          state.unreadCount = Math.min(
            state.unreadCount + 1,
            MAX_NOTIFICATIONS
          );
        }

        if (state.items.length > MAX_NOTIFICATIONS) {
          const removed = state.items.pop();
          if (removed && !removed.read && state.unreadCount > 0) {
            state.unreadCount -= 1;
          }
        }
      },
      prepare: (payload) => {
        const {
          id = nanoid(),
          createdAt = new Date().toISOString(),
          read = false,
          ...rest
        } = payload || {};

        return {
          payload: {
            id,
            createdAt,
            read,
            ...rest,
          },
        };
      },
    },
    markNotificationRead: (state, action) => {
      const id = action.payload;
      if (!id) return;

      const notification = state.items.find((item) => item.id === id);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(state.unreadCount - 1, 0);
      }
    },
    markAllNotificationsRead: (state) => {
      state.items.forEach((item) => {
        item.read = true;
      });
      state.unreadCount = 0;
    },
    markNotificationsByChannel: (state, action) => {
      const channelId = action.payload;
      if (channelId == null) return;
      let decremented = 0;
      state.items.forEach((item) => {
        if (item.channelId === channelId && !item.read) {
          item.read = true;
          decremented += 1;
        }
      });
      state.unreadCount = Math.max(state.unreadCount - decremented, 0);
    },
    markNotificationsByThread: (state, action) => {
      const { channelId, threadRootId } = action.payload || {};
      if (channelId == null || threadRootId == null) return;
      let decremented = 0;
      state.items.forEach((item) => {
        if (
          item.channelId === channelId &&
          item.data?.threadRootId === threadRootId &&
          !item.read
        ) {
          item.read = true;
          decremented += 1;
        }
      });
      state.unreadCount = Math.max(state.unreadCount - decremented, 0);
    },
    removeNotification: (state, action) => {
      const id = action.payload;
      if (!id) return;

      const index = state.items.findIndex((item) => item.id === id);
      if (index !== -1) {
        const [removed] = state.items.splice(index, 1);
        if (removed && !removed.read && state.unreadCount > 0) {
          state.unreadCount -= 1;
        }
      }
    },
    clearNotifications: (state) => {
      state.items = [];
      state.unreadCount = 0;
    },
    setNotificationPreference: (state, action) => {
      const { key, value } = action.payload || {};
      if (!key) return;
      state.preferences = {
        ...state.preferences,
        [key]: Boolean(value),
      };
    },
    setNotificationPreferences: (state, action) => {
      const incoming = action.payload || {};
      state.preferences = {
        ...state.preferences,
        ...incoming,
      };
    },
    resetNotificationPreferences: (state) => {
      state.preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    },
  },
});

export const {
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsByChannel,
  markNotificationsByThread,
  removeNotification,
  clearNotifications,
  setNotificationPreference,
  setNotificationPreferences,
  resetNotificationPreferences,
} = notificationSlice.actions;

export const selectNotifications = (state) => state.notifications.items;
export const selectUnreadNotificationCount = (state) =>
  state.notifications.unreadCount;
export const selectNotificationPreferences = (state) =>
  state.notifications.preferences;

export default notificationSlice.reducer;

