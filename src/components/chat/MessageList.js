import { useEffect, useRef } from "react";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import EmptyState from "./EmptyState";
import TypingIndicator from "./TypingIndicator";
import Message from "./Message";

export default function MessageList({
  messages,
  isLoading,
  error,
  onDismissError,
  emptyText = "No messages yet.",
  typingUsers,
  renderMessageProps,
  lastReadTimestamp,
  currentUserId,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Find the index of the first unread message
  const firstUnreadIndex = lastReadTimestamp != null
    ? messages.findIndex((msg) => {
        if (!msg.created_at) return false;
        const msgTimestamp = new Date(msg.created_at).getTime();
        const isOwnMessage = msg.user_id === currentUserId;
        return !isOwnMessage && msgTimestamp > lastReadTimestamp;
      })
    : -1;

  const hasUnreadMessages = firstUnreadIndex >= 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner text="Loading messages..." />
      </div>
    );
  }

  return (
    <div className="flex-1 scrollbar-width overflow-y-auto scroll px-3 sm:px-4 py-3 sm:py-4 space-y-3 bg-gray-50 dark:bg-gray-900">
      {error && (
        <ErrorMessage error={error} onDismiss={onDismissError} />
      )}

      {messages.length === 0 && !error ? (
        <EmptyState message={emptyText} />
      ) : (
        messages.map((message, index) => {
          const showNewMessagesDivider = hasUnreadMessages && index === firstUnreadIndex;
          return (
            <div key={message.id ?? message.clientId}>
              {showNewMessagesDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                  <span className="px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full">
                    New messages
                  </span>
                  <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                </div>
              )}
              <Message
                message={message}
                {...renderMessageProps(message)}
              />
            </div>
          );
        })
      )}
      <TypingIndicator typingUsers={typingUsers} />
      <div ref={endRef} />
    </div>
  );
}








