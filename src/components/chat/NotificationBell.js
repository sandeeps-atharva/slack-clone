// components/chat/NotificationBell.js
import { Bell } from "lucide-react";

export default function NotificationBell({ unreadCount, onClick, anchorRef }) {
  return (
    <button
      ref={anchorRef}
      onClick={onClick}
      className="relative p-1.5 sm:p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white dark:border-gray-900">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}







