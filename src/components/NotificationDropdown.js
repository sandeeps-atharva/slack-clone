import { useEffect, useMemo, useRef } from "react";
import {
  Bell,
  MessageCircle,
  User,
  AtSign,
  PhoneIncoming,
  AlertCircle,
  Trash2,
  Check,
  CheckCheck,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const typeIconMap = {
  dm: User,
  message: MessageCircle,
  mention: AtSign,
  thread: MessageCircle,
  call: PhoneIncoming,
  system: AlertCircle,
};

const formatTimestamp = (value) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch (error) {
    return "";
  }
};

export default function NotificationDropdown({
  notifications,
  onClose,
  onSelect,
  onRemove,
  onMarkAllRead,
  anchorRef,
  preferences = {},
  onPreferenceToggle,
  onResetPreferences,
  isOpen,
  panelPosition = 0, // Position from right (0 = rightmost)
}) {
  // Calculate right offset: each panel is 28rem wide, position 0 is rightmost
  const rightOffset = panelPosition * 28; // in rem
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, isOpen]);

  const sortedNotifications = useMemo(() => {
    if (!Array.isArray(notifications)) {
      return [];
    }
    return [...notifications].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
  }, [notifications]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 z-40 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full"
        style={rightStyle}
      >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Bell className="w-4 h-4 text-purple-500" />
          <span>Notifications</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllRead}
            className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200 transition disabled:opacity-60"
            disabled={!sortedNotifications.some((n) => !n.read)}
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {sortedNotifications.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            You're all caught up!
          </div>
        ) : (
          sortedNotifications.map((notification) => {
            const Icon = typeIconMap[notification.type] || AlertCircle;
            const isUnread = !notification.read;

            return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 ${
                  isUnread
                    ? "bg-purple-50/70 dark:bg-purple-500/10"
                    : "bg-white dark:bg-gray-900"
                }`}
              >
                <div className="relative">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-200">
                    <Icon className="w-4 h-4" />
                  </div>
                  {isUnread && (
                    <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {notification.title || "Notification"}
                      </div>
                      {notification.message && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {formatTimestamp(notification.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => onSelect?.(notification)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200 transition"
                    >
                      {isUnread ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Open
                        </>
                      ) : (
                        <>
                          <CheckCheck className="w-3.5 h-3.5" />
                          View
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => onRemove?.(notification.id)}
                      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500" />
            Preferences
          </span>
          <button
            onClick={onResetPreferences}
            className="text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200 transition"
          >
            Reset
          </button>
        </div>
        <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
          <PreferenceToggle
            label="Channel messages"
            checked={preferences.message !== false}
            onChange={(value) => onPreferenceToggle?.("message", value)}
          />
          <PreferenceToggle
            label="Direct messages"
            checked={preferences.dm !== false}
            onChange={(value) => onPreferenceToggle?.("dm", value)}
          />
          <PreferenceToggle
            label="@ Mentions"
            checked={preferences.mention !== false}
            onChange={(value) => onPreferenceToggle?.("mention", value)}
          />
          <PreferenceToggle
            label="Call alerts"
            checked={preferences.call !== false}
            onChange={(value) => onPreferenceToggle?.("call", value)}
          />
          <PreferenceToggle
            label="Sound"
            checked={preferences.sound !== false}
            iconOn={<Volume2 className="w-3.5 h-3.5" />}
            iconOff={<VolumeX className="w-3.5 h-3.5" />}
            onChange={(value) => onPreferenceToggle?.("sound", value)}
          />
        </div>
      </div>
      </div>
    </>
  );
}

function PreferenceToggle({ label, checked, onChange, iconOn, iconOff }) {
  const IconElement = checked ? iconOn : iconOff;

  return (
    <label className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        {IconElement}
        <span>{label}</span>
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
      />
    </label>
  );
}

