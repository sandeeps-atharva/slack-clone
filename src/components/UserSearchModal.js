import { useState, useEffect } from "react";
import { X, Search, User } from "lucide-react";
import OnlineIndicator from "./OnlineIndicator";

export default function UserSearchModal({
  isOpen,
  onClose,
  onSelectUser,
  availableUsers,
  findingUsers,
  userSearchError,
  searchQuery,
  onSearchChange,
  onlineUserIds = [],
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-300" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">Search Users</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-300"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {findingUsers ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-4 border-purple-200 dark:border-purple-900 border-t-purple-600" />
            </div>
          ) : userSearchError ? (
            <div className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg mx-2">
              {userSearchError}
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              {searchQuery.trim() ? (
                <p>No users found matching &quot;{searchQuery}&quot;</p>
              ) : (
                <p>Start typing to search for users</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {availableUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 text-left rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors group"
                >
                  <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-200 font-semibold text-sm sm:text-base">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <OnlineIndicator
                      userId={user.id}
                      onlineUserIds={onlineUserIds}
                      className="absolute bottom-0 right-0"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate text-sm sm:text-base">
                      {user.username}
                    </div>
                    {user.email && (
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                    )}
                  </div>
                  <div className="text-purple-600 dark:text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

