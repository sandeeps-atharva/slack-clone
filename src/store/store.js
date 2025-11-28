// store/store.js
import { configureStore } from "@reduxjs/toolkit";
import authSlice from "@/store/slices/authSlice";
import chatSlice from "@/store/slices/chatSlice";
import uiSlice from "@/store/slices/uiSlice";
import channelSlice from "@/store/slices/channelSlice";
import callSlice from "@/store/slices/callSlice";
import onlineStatusSlice from "@/store/slices/onlineStatusSlice";
import notificationSlice from "@/store/slices/notificationSlice";
import callHistorySlice from "@/store/slices/callHistorySlice";
import roomSlice from "@/store/slices/roomSlice";
import bookingSlice from "@/store/slices/bookingSlice";

export const store = configureStore({
  reducer: {
    auth: authSlice,
    chat: chatSlice,
    ui: uiSlice,
    channels: channelSlice,
    call: callSlice,
    onlineStatus: onlineStatusSlice,
    notifications: notificationSlice,
    callHistory: callHistorySlice,
    rooms: roomSlice,
    bookings: bookingSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["socket/connected", "socket/disconnected"],
        ignoredPaths: ["call.localStream", "call.participants"],
      },
    }),
});
