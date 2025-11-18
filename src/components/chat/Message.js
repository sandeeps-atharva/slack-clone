import MessageStatusIcon from "./MessageStatusIcon";
import MessageActions from "./MessageActions";
import MessageEditor from "./MessageEditor";
import MessageReactions from "./MessageReactions";
import OnlineStatusBadge from "./OnlineStatusBadge";
import { renderMessageWithMentions } from "../../utils/renderMentions";
import { Video, PhoneOff } from "lucide-react";

export default function Message({
  message,
  isOwn,
  onEdit,
  onDelete,
  onThreadOpen,
  isEditing,
  editingText,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  isUpdating,
  isDeleting,
  threadCount,
  showThreadActions,
  onlineUserIds,
  error,
  showError,
  timestamp,
  mentionEntities,
  onMentionClick,
  editAttachmentProps,
  editFileInputRef,
  onToggleReaction,
  currentUserId,
  channelId,
}) {
  if (!message) return null;

  // Handle system messages (call_started, call_ended)
  if (message.message_type === "call_started" || message.message_type === "call_ended") {
    return <SystemMessage message={message} timestamp={timestamp} />;
  }

  const bubbleBaseClass = isOwn
    ? "bg-purple-500 text-white shadow-lg"
    : "bg-white dark:bg-gray-800 dark:text-gray-100 shadow-sm";

  const containerClass = `flex flex-col gap-1 max-w-[85%] sm:max-w-md group ${
    isOwn ? "ml-auto items-end" : "mr-auto items-start"
  }`;

  return (
    <div className={containerClass}>
      {!isOwn && (
        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1.5">
          {message.username}
          <OnlineStatusBadge
            userId={message.user_id}
            onlineUserIds={onlineUserIds}
            className="shrink-0"
          />
        </div>
      )}

      <div
        className={`px-3 sm:px-4 py-2 rounded-2xl break-words text-sm sm:text-base ${bubbleBaseClass} ${
          isDeleting ? "opacity-60" : ""
        }`}
      >
        {isEditing ? (
          <MessageEditor
            text={editingText}
            onChange={onEditChange}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            isUpdating={isUpdating}
            error={showError ? error : null}
            attachmentProps={editAttachmentProps}
            fileInputRef={editFileInputRef}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {message.message && (
              <div className="whitespace-pre-wrap break-words">
                {renderMessageWithMentions(message.message, mentionEntities || message.mentions, {
                  onMentionClick,
                })}
              </div>
            )}

            {message.file_url && (
              <AttachmentPreviewContent message={message} isOwn={isOwn} />
            )}

            <div className="flex items-center justify-between gap-3 text-xs mt-1 opacity-80">
              <span>{timestamp}</span>
              <div className="flex items-center gap-2">
                <MessageStatusIcon status={message.status} isOwn={isOwn} />
              </div>
            </div>

            <MessageActions
              canEdit={isOwn && message.message_type === "text" && message.id != null}
              canDelete={isOwn && message.id != null}
              onEdit={onEdit}
              onDelete={onDelete}
              onThreadOpen={onThreadOpen}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
              threadCount={threadCount}
              showThreadActions={showThreadActions}
              isOwn={isOwn}
            />
          </div>
        )}
      </div>

      {/* Reply count link - shown below message bubble */}
      {!isEditing && message.id && threadCount > 0 && (
        <button
          onClick={onThreadOpen}
          className={`text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors mt-0.5 ${
            isOwn ? "text-right" : "text-left"
          }`}
        >
          {threadCount} {threadCount === 1 ? "Reply" : "Replies"}
        </button>
      )}

      {!isEditing && message.id && (
        <MessageReactions
          reactions={message.reactions || []}
          messageId={message.id}
          channelId={channelId}
          currentUserId={currentUserId}
          onToggleReaction={onToggleReaction}
          isOwn={isOwn}
        />
      )}

      {showError && !isEditing && error && (
        <div className={`text-xs text-red-500 dark:text-red-300 ${isOwn ? "text-right" : "text-left"}`}>
          {error}
        </div>
      )}
    </div>
  );
}

function AttachmentPreviewContent({ message, isOwn }) {
  if (!message.file_url) return null;
  const textClass = isOwn ? "text-white" : "text-gray-700 dark:text-gray-200";

  if (message.mime_type?.startsWith("image/")) {
    return (
      <a
        href={message.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={message.file_url}
          alt={message.file_name || "Image attachment"}
          className="rounded-lg max-h-64 object-cover"
        />
      </a>
    );
  }

  if (message.mime_type?.startsWith("audio/")) {
    return (
      <div className={textClass}>
        <audio controls className="w-full">
          <source src={message.file_url} type={message.mime_type} />
        </audio>
      </div>
    );
  }

  return (
    <a
      href={message.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${textClass} underline`}
    >
      {message.file_name || "Download file"}
    </a>
  );
}

// System message component for call events
function SystemMessage({ message, timestamp }) {
  const isCallStarted = message.message_type === "call_started";
  const isCallEnded = message.message_type === "call_ended";
  
  // Extract username from message for call_started
  // Format: "Call started by John Appleseed"
  const startedByMatch = message.message?.match(/Call started by (.+)/);
  const startedBy = startedByMatch?.[1] || message.username || "Someone";

  // Extract username and duration from message for call_ended
  // Format: "Call ended by John Appleseed • 12m 45s" or "Call ended by John Appleseed"
  const endedByMatch = message.message?.match(/Call ended by (.+?)(?:\s*•|$)/);
  const endedBy = endedByMatch?.[1]?.trim() || message.username || "Someone";
  
  // Parse duration from message if it's a call_ended message
  // Format: "Call ended by [username] • 12m 45s"
  const durationMatch = message.message?.match(/•\s*(\d+)m\s*(\d+)s/);
  const duration = durationMatch 
    ? `${durationMatch[1]}m ${durationMatch[2]}s`
    : null;

  return (
    <div className="flex items-center justify-center gap-2 my-2 px-2 w-full">
      {isCallStarted && (
        <>
          <Video className="w-4 h-4 text-green-500 dark:text-green-400 shrink-0" />
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Call started by {startedBy}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {timestamp}
            </span>
          )}
        </>
      )}
      {isCallEnded && (
        <>
          <PhoneOff className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Call ended by {endedBy}
          </span>
          {duration && (
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              • {duration}
            </span>
          )}
          {timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {timestamp}
            </span>
          )}
        </>
      )}
    </div>
  );
}
