import AttachmentControls from "./AttachmentControls";
import MessageInput from "./MessageInput";
import MentionSuggestions from "./MentionSuggestions";
import { Send } from "lucide-react";

export default function ChatFooter({
  message,
  onMessageChange,
  onKeyDown,
  onSend,
  isDisabled,
  isSending,
  isRecording,
  recordingTime,
  onToggleRecording,
  onOpenCamera,
  onOpenFilePicker,
  onToggleEmoji,
  typingUsers,
  inputRef,
  showMentionSuggestions,
  mentionSuggestions,
  mentionHighlightIndex,
  onMentionSelect,
  onMentionHover,
}) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
  
      <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <AttachmentControls
          onOpenFilePicker={onOpenFilePicker}
          onOpenCamera={onOpenCamera}
          onToggleRecording={onToggleRecording}
          onToggleEmoji={onToggleEmoji}
          isRecording={isRecording}
          recordingTime={recordingTime}
          isDisabled={isDisabled}
        />
        <div className="relative flex items-end gap-2">
          <div className="flex-1">
            <MessageInput
              ref={inputRef}
              value={message}
              onChange={onMessageChange}
              onKeyDown={onKeyDown}
              disabled={isDisabled}
            />
            {showMentionSuggestions && (
              <MentionSuggestions
                suggestions={mentionSuggestions}
                highlightIndex={mentionHighlightIndex}
                onSelect={onMentionSelect}
                onHover={onMentionHover}
              />
            )}
          </div>
          <button
            onClick={onSend}
            disabled={isDisabled || isSending}
            className="p-3 sm:p-4 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-60"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
