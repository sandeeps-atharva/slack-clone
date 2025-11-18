import { Plus, Hash, Lock, MessageCircle, X } from "lucide-react";
import OnlineIndicator from "./OnlineIndicator";

export default function ChannelSidebar({
  channels,
  activeChannelId,
  isLoading,
  error,
  showForm,
  onToggleForm,
  onSelectChannel,
  onOpenDM,
  form,
  isMobileSidebarOpen,
  onMobileSidebarToggle,
  onlineUserIds = [],
  currentUserId,
}) {
  const {
    name,
    topic,
    isPrivate,
    onNameChange,
    onTopicChange,
    onTogglePrivate,
    onSubmit,
    creating,
    formError,
    userSearchQuery,
    onUserSearchChange,
    findingUsers,
    userSearchError,
    availableUsers,
    selectedMembersDisplay,
    selectedMemberIds,
    onToggleMember,
  } = form;

  return (
    <>
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileSidebarToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
            <Hash className="w-5 h-5" />
            <span className="hidden sm:inline">Workspace</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile close button */}
            <button
              onClick={onMobileSidebarToggle}
              className="lg:hidden p-1.5 rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
            {onOpenDM && (
              <button
                onClick={onOpenDM}
                className="p-1.5 rounded-full text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30 transition"
                aria-label="Start direct message"
                title="Start DM"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onToggleForm}
              className="p-1.5 rounded-full text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30 transition"
              aria-label={showForm ? "Close channel form" : "Create channel"}
              title="Create channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

      {showForm && (
        <form onSubmit={onSubmit} className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 space-y-3 bg-purple-50/40 dark:bg-purple-500/10">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Channel name
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. design-team"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Topic (optional)
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Describe the purpose"
              value={topic}
              onChange={(e) => onTopicChange(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => onTogglePrivate(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
            />
            Make private
          </label>
          {isPrivate && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Add members
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search users by name or email"
                value={userSearchQuery}
                onChange={(e) => onUserSearchChange(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {findingUsers ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</div>
                ) : userSearchError ? (
                  <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{userSearchError}</div>
                ) : availableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {userSearchQuery.trim() ? "No users found" : "Start typing to search users"}
                  </div>
                ) : (
                  availableUsers.map((u) => {
                    const selected = selectedMemberIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => onToggleMember(u.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                          selected
                            ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span>
                          {u.username}
                          {u.email && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{u.email}</span>}
                        </span>
                        {selected && <span className="text-xs font-medium">Selected</span>}
                      </button>
                    );
                  })
                )}
              </div>
              {selectedMembersDisplay.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedMembersDisplay.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-500/20 px-3 py-1 text-xs text-purple-700 dark:text-purple-200"
                    >
                      {u.username}
                      <button
                        type="button"
                        className="text-purple-500 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200"
                        onClick={() => onToggleMember(u.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {(formError || error) && (
            <div className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
              {formError || error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleForm}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {!showForm && error && (
        <div className="px-4 py-2 text-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 dark:border-purple-900 border-t-purple-600" />
          </div>
        ) : channels.length ? (
          <nav className="py-2">
            {channels.map((channel) => {
              const isActive = activeChannelId === channel.id;
              const metadata = channel.metadata;
              const isDMChannel = metadata?.type === "dm";
              const Icon = isDMChannel ? MessageCircle : channel.is_private ? Lock : Hash;
              const displayName = channel.displayName || channel.name;
              const showTopic = isDMChannel ? null : channel.topic;

              let dmParticipantId = null;
              if (isDMChannel && Array.isArray(metadata?.participants)) {
                const otherParticipant = metadata.participants.find((participant) => {
                  if (participant?.id == null) return false;
                  if (currentUserId != null) {
                    return participant.id !== currentUserId;
                  }
                  return true;
                });
                dmParticipantId = otherParticipant?.id ?? null;
              }

              const showOnlineIndicator =
                dmParticipantId != null && onlineUserIds.includes(dmParticipantId);

              return (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  className={`w-full px-4 py-2 flex items-center gap-3 text-left transition ${
                    isActive
                      ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200 font-semibold"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4 shrink-0" />
                    {showOnlineIndicator && (
                      <OnlineIndicator
                        userId={dmParticipantId}
                        onlineUserIds={onlineUserIds}
                        className="absolute -bottom-[2px] -right-[2px]"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate flex items-center gap-2">
                      <span className="truncate">{displayName}</span>
                      {channel.unreadCount > 0 && (
                        <span className="ml-auto flex-shrink-0 rounded-full bg-purple-600 dark:bg-purple-500 text-white text-xs font-semibold px-2 py-0.5 min-w-[1.25rem] text-center">
                          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                        </span>
                      )}
                    </div>
                    {showTopic && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{showTopic}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
            No channels yet. Create one to get started.
          </div>
        )}
      </div>
    </aside>
    </>
  );
}

