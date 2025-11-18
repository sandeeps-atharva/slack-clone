// hooks/useNotificationActions.js
import { useState, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import {
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
} from "../store/slices/notificationSlice";

const NOTIFICATION_PREFS_STORAGE_KEY = "chatapp:notification-preferences";

export default function useNotificationActions(notifications, notificationPreferences) {
  const dispatch = useDispatch();
  const [showNotifications, setShowNotifications] = useState(false);
  const audioContextRef = useRef(null);

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext || null;
    if (!AudioContextClass) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const context = audioContextRef.current;
      
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(880, context.currentTime);

      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.00001,
        context.currentTime + 0.35
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.35);
    } catch (error) {
      console.warn("Unable to play notification sound", error);
    }
  }, []);

  const handleToggleNotifications = useCallback(() => {
    setShowNotifications((prev) => !prev);
  }, []);

  const handleNotificationSelect = useCallback(
    (notification, onSelectChannel, setActiveThreadId) => {
      if (!notification) return;
      dispatch(markNotificationRead(notification.id));
      setShowNotifications(false);

      if (notification.channelId != null) {
        onSelectChannel?.(notification.channelId);
        if (notification.data?.threadRootId) {
          setTimeout(() => {
            setActiveThreadId?.(notification.data.threadRootId);
          }, 0);
        }
      }
    },
    [dispatch]
  );

  const handleNotificationRemove = useCallback(
    (notificationId) => {
      if (!notificationId) return;
      dispatch(removeNotification(notificationId));
    },
    [dispatch]
  );

  const handleMarkAllNotificationsReadClick = useCallback(() => {
    dispatch(markAllNotificationsRead());
  }, [dispatch]);

  return {
    showNotifications,
    handleToggleNotifications,
    handleNotificationSelect,
    handleNotificationRemove,
    handleMarkAllNotificationsReadClick,
    playNotificationSound,
  };
}


