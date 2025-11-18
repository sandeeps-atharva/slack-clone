import { Menu, Settings } from "lucide-react";
import ChannelIcon from "./ChannelIcon";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import CallControlButtons from "./CallControlButtons";
import UserAvatar from "./UserAvatar";

export default function ChatHeader({
  onToggleSidebar,
  channelName,
  channelTopic,
  isPrivate,
  theme,
  onToggleTheme,
  user,
  onOpenSettings,
  onLogout,
  isInCall,
  hasActiveCall,
  hasIncomingCall,
  isCallInActiveChannel,
  onStartCall,
  onJoinCall,
  onEndCall,
  isCallPanelVisible,
  onReopenCallPanel,
  unreadNotifications,
  onNotificationClick,
  notificationAnchorRef,
  onOpenProfile,
}) {
  const displayName = channelName || "Select a channel";
  const topicText =
    typeof channelTopic === "string"
      ? channelTopic
      : channelTopic && typeof channelTopic === "object"
      ? channelTopic.text || channelTopic.topic || channelTopic.description || ""
      : "";
  return (
    <div className="flex flex-col gap-2 bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChannelIcon isPrivate={isPrivate} className="w-4 h-4 sm:w-5 sm:h-5" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
              {displayName}
            </h1>
            {/* {topicText && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{topicText}</p>
            )} */}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <NotificationBell
            unreadCount={unreadNotifications}
            onClick={onNotificationClick}
            anchorRef={notificationAnchorRef}
          />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <CallControlButtons
            isInCall={isInCall}
            hasActiveCall={hasActiveCall}
            hasIncomingCall={hasIncomingCall}
            isActiveChannel={isCallInActiveChannel}
            onStart={onStartCall}
            onJoin={onJoinCall}
            onEnd={onEndCall}
            isCallPanelVisible={isCallPanelVisible}
            onReopenCallPanel={onReopenCallPanel}
          />
          <button
            onClick={onOpenSettings}
            className="p-1.5 sm:p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200"
            aria-label="Channel settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={onOpenProfile}
            className="p-1.5 sm:p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            aria-label="Open profile"
          >
            <UserAvatar username={user?.username} size="sm" />
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 sm:p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200"
            aria-label="Sign out"
            title="Sign out"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
