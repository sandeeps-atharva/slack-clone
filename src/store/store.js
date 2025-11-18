// store/store.js
import { configureStore } from "@reduxjs/toolkit";
import authSlice from "@/store/slices/authSlice";
import chatSlice from "@/store/slices/chatSlice";
import uiSlice from "@/store/slices/uiSlice";
import channelSlice from "@/store/slices/channelSlice";
import callSlice from "@/store/slices/callSlice";
import onlineStatusSlice from "@/store/slices/onlineStatusSlice";
import notificationSlice from "@/store/slices/notificationSlice";

export const store = configureStore({
  reducer: {
    auth: authSlice,
    chat: chatSlice,
    ui: uiSlice,
    channels: channelSlice,
    call: callSlice,
    onlineStatus: onlineStatusSlice,
    notifications: notificationSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["socket/connected", "socket/disconnected"],
        ignoredPaths: ["call.localStream", "call.participants"],
      },
    }),
});
