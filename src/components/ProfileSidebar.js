import { X, User, Mail, LogOut, Settings } from "lucide-react";
import UserAvatar from "./chat/UserAvatar";

export default function ProfileSidebar({
  isOpen,
  onClose,
  user,
  onLogout,
  onOpenSettings,
  onlineUserIds,
}) {
  if (!isOpen || !user) return null;

  const isOnline = onlineUserIds?.includes(user.id);

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <UserAvatar username={user.username} size="lg" />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
              )}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {user.username}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Account Information
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                    <User className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Username</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {user.username}
                    </p>
                  </div>
                </div>

                {user.email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                      <Mail className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                )}

                {user.id && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-300">ID</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {user.id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t border-gray-200 dark:border-gray-800 pt-4">
            <button
              onClick={() => {
                onOpenSettings?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
            >
              <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Channel Settings
              </span>
            </button>

            <button
              onClick={() => {
                onLogout?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 dark:border-red-500/40 hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left"
            >
              <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

