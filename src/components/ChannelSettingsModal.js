import { X } from "lucide-react";

export default function ChannelSettingsModal({
  isOpen,
  channel,
  onClose,
  isDirectMessageChannel,
  settingsName,
  settingsTopic,
  settingsPrivate,
  onChangeName,
  onChangeTopic,
  onChangePrivate,
  onSubmit,
  canEditChannel,
  canEditPrivacy,
  canManageMembers,
  canLeaveChannel,
  onLeave,
  isLeaving,
  panelPosition = 0, // Position from right (0 = rightmost)
  errors,
  members,
  membersLoading,
  currentUserId,
  onRemoveMember,
  removingMemberId,
  availableUsers,
  settingsUserQuery,
  onSettingsUserQueryChange,
  settingsSelectedMembersDisplay,
  onToggleSettingsSelected,
  onInviteMembers,
  addingMembers,
  addMembersError,
  findingUsers,
  userSearchError,
  updatingChannel,
  onClearChat,
  isClearingChat,
}) {
  if (!isOpen || !channel) return null;

  // Calculate right offset: each panel is 28rem wide, position 0 is rightmost
  const rightOffset = panelPosition * 28; // in rem
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };

  const combinedError =
    errors.filter(Boolean).length > 0 ? errors.filter(Boolean)[0] : null;

  const existingMemberIds = new Set(members.map((member) => member.id));

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 z-50 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full"
        style={rightStyle}
      >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Channel settings</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Manage {channel.name}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          aria-label="Close settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 sm:space-y-6">

        {combinedError && (
          <div className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{combinedError}</div>
        )}

        {!isDirectMessageChannel ? (
          canEditChannel ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Channel name
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                  value={settingsName}
                  onChange={(e) => onChangeName(e.target.value)}
                    disabled={updatingChannel}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Topic (optional)
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                  value={settingsTopic}
                  onChange={(e) => onChangeTopic(e.target.value)}
                    disabled={updatingChannel}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={settingsPrivate}
                onChange={(e) => onChangePrivate(e.target.checked)}
                  disabled={updatingChannel}
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              Make channel private
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingChannel}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {updatingChannel ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
          ) : (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
              Only channel owners can edit channel name and topic.
            </div>
          )
        ) : (
          <p className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
            Direct message details cannot be edited.
          </p>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Members</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{members.length} member(s)</span>
          </div>

          {canManageMembers && (
            <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Invite members</h4>
              <input
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                placeholder="Search users by name or email"
                value={settingsUserQuery}
                onChange={(e) => onSettingsUserQueryChange(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {findingUsers ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</div>
                ) : userSearchError ? (
                  <div className="px-3 py-2 text-sm text-red-600 dark:text-red-300">{userSearchError}</div>
                ) : availableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {settingsUserQuery.trim() ? "No users found" : "Start typing to search users"}
                  </div>
                ) : (
                  availableUsers
                    .filter((u) => !existingMemberIds.has(u.id))
                    .map((u) => {
                      const selected = settingsSelectedMembersDisplay.some((member) => member.id === u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => onToggleSettingsSelected(u.id)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                            selected
                              ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200"
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
              {settingsSelectedMembersDisplay.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {settingsSelectedMembersDisplay.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-2 rounded-full bg-purple-100 dark:bg-purple-500/20 px-3 py-1 text-xs text-purple-700 dark:text-purple-200"
                    >
                      {u.username}
                      <button
                        type="button"
                        className="text-purple-500 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200"
                        onClick={() => onToggleSettingsSelected(u.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onInviteMembers}
                disabled={settingsSelectedMembersDisplay.length === 0 || addingMembers}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {addingMembers ? "Inviting…" : "Invite selected"}
              </button>
              {addMembersError && (
                <div className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">{addMembersError}</div>
              )}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
            {membersLoading ? (
              <div className="flex items-center justify-center px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                Loading members...
              </div>
            ) : members.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No members yet.</div>
            ) : (
              members.map((member) => {
                const isSelf = member.id === currentUserId;
                const canRemove = canManageMembers && member.role !== "owner" && !isSelf;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-700 dark:text-gray-200">{member.username}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        {member.email ? ` · ${member.email}` : ""}
                      </span>
                    </div>
                    {canRemove && (
                      <button
                        onClick={() => onRemoveMember(member.id, member.username)}
                        disabled={removingMemberId === member.id}
                        className="rounded-full border border-red-200 dark:border-red-500/40 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50"
                      >
                        {removingMemberId === member.id ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-200 dark:border-gray-800 pt-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Chat Actions
            </h4>
            <button
              onClick={onClearChat}
              disabled={isClearingChat}
              className="w-full rounded-lg border border-orange-300 dark:border-orange-500/40 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition disabled:opacity-50"
            >
              {isClearingChat ? "Clearing..." : "Clear Chat"}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Hide all messages in this chat. Messages are not deleted and will reappear if you clear the chat again.
            </p>
          </div>
          {!isDirectMessageChannel && (
            <>
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Channel Actions
                </h4>
                <button
                  onClick={onLeave}
                  disabled={isLeaving}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover-bg-gray-800 transition disabled:opacity-50"
                >
                  {isLeaving ? "Leaving..." : "Leave channel"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
