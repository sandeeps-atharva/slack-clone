import { X, AudioLines, FileText, Check, XCircle, CheckCheck, Send } from "lucide-react";
import { renderMessageWithMentions } from "../utils/renderMentions";
import AttachmentControls from "./chat/AttachmentControls";
import MessageReactions from "./chat/MessageReactions";

const renderStatusIcon = (message, isOwn) => {
  if (!isOwn) return null;

  switch (message?.status) {
    case "pending":
      return <Check className="w-4 h-4 text-white/70" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-300" />;
    case "sent":
    default:
      return <CheckCheck className="w-4 h-4 text-white" />;
  }
};

function MessageBubble({
  message,
  currentUser,
  isEditing,
  editingText,
  onChangeEditingText,
  isUpdating,
  isDeleting,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onDelete,
  showActions,
  resolveMentionEntities,
  onMentionClick,
  onToggleReaction,
  channelId,
}) {
  if (!message) return null;

  const isOwnMessage =
    message.user_id != null && currentUser?.id != null
      ? message.user_id === currentUser.id
      : message.username && currentUser?.username
      ? message.username === currentUser.username
      : false;

  const formattedTime = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const containerClass = `flex flex-col gap-1 max-w-full group ${
    isOwnMessage ? "items-end" : "items-start"
  }`;
  const bubbleClass = isOwnMessage
    ? "bg-purple-500 text-white shadow-lg"
    : "bg-white dark:bg-gray-800 dark:text-gray-100 shadow-sm";

  return (
    <div className={containerClass}>
      {!isOwnMessage && (
        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
          {message.username}
        </div>
      )}

      <div
        className={`px-3 sm:px-4 py-2 rounded-2xl break-words text-sm sm:text-base ${
          bubbleClass
        } ${isDeleting ? "opacity-60" : ""}`}
      >
        {isEditing ? (
          <textarea
            value={editingText}
            onChange={(event) => onChangeEditingText(event.target.value)}
            className="w-full resize-none rounded-lg border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-gray-900 text-sm sm:text-base text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
            rows={3}
            maxLength={2000}
            disabled={isUpdating}
          />
        ) : (
          <>
            {message.message && (
              <div className="whitespace-pre-wrap break-words">
                {renderMessageWithMentions(
                  message.message,
                  resolveMentionEntities ? resolveMentionEntities(message) : message.mentions,
                  { onMentionClick }
                )}
              </div>
            )}
            {/* {message.message && (
              <div className="whitespace-pre-wrap break-words">
                {renderMessageWithMentions(message.message, message.mentions)}
              </div>
            )} */}

            {message.file_url ? (
              <div className={`mt-2 ${isOwnMessage ? "text-white" : "text-gray-700 dark:text-gray-200"}`}>
                {message.mime_type?.startsWith("image/") ? (
                  <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={message.file_url}
                      alt={message.file_name || "Shared image"}
                      className="max-h-48 rounded-lg border border-white/10"
                    />
                  </a>
                ) : message.mime_type?.startsWith("audio/") ? (
                  <div className="flex flex-col gap-2">
                    <audio
                      controls
                      src={message.file_url}
                      className="w-48 max-w-full rounded-lg"
                      preload="metadata"
                    />
                    {message.file_name && (
                      <div className="flex items-center gap-2 text-xs opacity-80">
                        <AudioLines className="w-4 h-4" />
                        <span className="truncate">{message.file_name}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 underline underline-offset-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{message.file_name || "Download file"}</span>
                  </a>
                )}
              </div>
            ) : null}

            {!message.file_url && !message.message && message.file_name && (
              <div
                className={`mt-1 text-xs ${
                  isOwnMessage ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {message.status === "pending"
                  ? `Uploading ${message.message_type === "audio" ? "voice message" : "attachment"}…`
                  : message.message_type === "audio"
                  ? "Voice message"
                  : "Attachment"}
              </div>
            )}
          </>
        )}
      </div>

      {isEditing ? (
        <div
          className={`flex gap-3 text-xs mt-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
        >
          <button
            onClick={onCancelEditing}
            disabled={isUpdating}
            className="text-gray-200 hover:text-white dark:text-gray-400 dark:hover:text-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={onSaveEditing}
            disabled={isUpdating}
            className="text-white font-medium"
          >
            {isUpdating ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <div
          className={`mt-1 flex items-center gap-3 text-xs ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          <div className="flex items-center gap-1">
            <span>{formattedTime}</span>
            {renderStatusIcon(message, isOwnMessage)}
            {message.status === "failed" && isOwnMessage && (
              <span className="ml-1 text-red-300">Failed</span>
            )}
            {isUpdating && <span className="ml-2 text-purple-300">Editing…</span>}
            {isDeleting && <span className="ml-2 text-red-300">Deleting…</span>}
          </div>

          {showActions && isOwnMessage && message.id != null && (
            <div className="flex gap-3">
              <button
                onClick={() => onStartEditing(message)}
                disabled={isDeleting || isUpdating}
                className="text-gray-400 hover:text-purple-500 dark:text-gray-500 dark:hover:text-purple-300 transition"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(message)}
                disabled={isDeleting}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {!isEditing && message.id && (
        <MessageReactions
          reactions={message.reactions || []}
          messageId={message.id}
          channelId={channelId}
          currentUserId={currentUser?.id}
          onToggleReaction={onToggleReaction}
          isOwn={isOwnMessage}
        />
      )}
    </div>
  );
}

export default function ThreadPanel({
  isOpen,
  onClose,
  rootMessage,
  replies,
  currentUser,
  editingMessageId,
  editingMessageText,
  onChangeEditingText,
  updatingMessageId,
  deletingMessageId,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onDeleteMessage,
  onReply,
  replyDraft,
  onChangeReplyDraft,
  isSending,
  threadError,
  resolveMentionEntities,
  onMentionClick,
  attachmentControls,
  attachmentState,
  onAttachmentRemove,
  onThreadFileChange,
  threadFileInputRef,
  onToggleReaction,
  channelId,
}) {
  if (!isOpen || !rootMessage) {
    return null;
  }

  const hasAttachment = Boolean(attachmentState?.file);
  const canSendReply =
    (Boolean(replyDraft.trim()) || hasAttachment) && !isSending && !attachmentState?.isUploading;

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div className="fixed right-0 top-0 bottom-0 z-30 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Thread</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Replying to {rootMessage.username}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          aria-label="Close thread"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <MessageBubble
          message={rootMessage}
          currentUser={currentUser}
          isEditing={editingMessageId === rootMessage.id}
          editingText={editingMessageText}
          onChangeEditingText={onChangeEditingText}
          isUpdating={updatingMessageId === rootMessage.id}
          isDeleting={deletingMessageId === rootMessage.id}
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onSaveEditing={onSaveEditing}
          onDelete={onDeleteMessage}
          showActions
          resolveMentionEntities={resolveMentionEntities}
          onMentionClick={onMentionClick}
          onToggleReaction={onToggleReaction}
          channelId={channelId}
        />

        <div className="border-t border-gray-200 dark:border-gray-800" />

        {replies.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No replies yet. Start the conversation!
          </p>
        ) : (
          replies.map((reply) => (
            <MessageBubble
              key={`reply-${reply.id ?? reply.clientId}`}
              message={reply}
              currentUser={currentUser}
              isEditing={editingMessageId === reply.id}
              editingText={editingMessageText}
              onChangeEditingText={onChangeEditingText}
              isUpdating={updatingMessageId === reply.id}
              isDeleting={deletingMessageId === reply.id}
              onStartEditing={onStartEditing}
              onCancelEditing={onCancelEditing}
              onSaveEditing={onSaveEditing}
              onDelete={onDeleteMessage}
              showActions
              resolveMentionEntities={resolveMentionEntities}
              onMentionClick={onMentionClick}
              onToggleReaction={onToggleReaction}
              channelId={channelId}
            />
          ))
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-2">
        {threadError && (
          <div className="text-xs text-red-500 dark:text-red-300">{threadError}</div>
        )}
        {attachmentControls && (
          <div className="space-y-2">
              <AttachmentControls {...attachmentControls} />
              {threadFileInputRef && (
                <input
                  type="file"
                  ref={threadFileInputRef}
                  className="hidden"
                  onChange={onThreadFileChange}
                />
              )}
              {attachmentState?.uploadError && (
                <p className="text-xs text-red-500 dark:text-red-300">{attachmentState.uploadError}</p>
              )}
              {attachmentState?.recordingError && (
                <p className="text-xs text-red-500 dark:text-red-300">{attachmentState.recordingError}</p>
              )}
              {attachmentState?.file && (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[200px]">
                      {attachmentState.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(attachmentState.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onAttachmentRemove}
                    className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200"
                  >
                    Remove
                  </button>
                </div>
              )}
          </div>
        )}
        <div className="flex flex-rows gap-1">
        <textarea
          value={replyDraft}
          onChange={(event) => onChangeReplyDraft(event.target.value)}
          placeholder="Reply in thread..."
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <div className="flex justify-end">
          <button
            onClick={onReply}
            disabled={!canSendReply}
            className="px-4 py-2  bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {attachmentState?.isUploading ? "Uploading…" : isSending ? "Sending…" : "Send reply"}
          </button>
        </div>
        </div>
      </div>
      </div>
    </>
  );
}