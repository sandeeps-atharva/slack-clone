import { useState, useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

export default function MessageReactions({
  reactions = [],
  messageId,
  channelId,
  currentUserId,
  onToggleReaction,
  isOwn,
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const addButtonRef = useRef(null);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target) &&
        addButtonRef.current &&
        !addButtonRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleEmojiSelect = (emoji) => {
    if (onToggleReaction && messageId) {
      onToggleReaction(messageId, emoji.native);
    }
    setShowEmojiPicker(false);
  };

  const handleReactionClick = (emoji) => {
    if (onToggleReaction && messageId) {
      onToggleReaction(messageId, emoji);
    }
  };

  if (!reactions || reactions.length === 0) {
    return (
      <div className="relative flex items-center gap-1 mt-1.5">
        <button
          ref={addButtonRef}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Add reaction"
        >
          <SmilePlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </button>
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 mb-2 z-50"
          >
            <Picker data={data} onEmojiSelect={handleEmojiSelect} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center flex-wrap gap-1 mt-1.5">
      {reactions.map((reaction) => {
        const hasUserReacted = reaction.users?.some(
          (u) => u.id === currentUserId || u.isCurrentUser
        );
        const baseClasses =
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all cursor-pointer";
        const pillClasses = hasUserReacted
          ? isOwn
            ? "bg-purple-400/30 text-purple-100 border border-purple-300/50 hover:bg-purple-400/40"
            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50"
          : isOwn
          ? "bg-white/10 text-purple-100 border border-white/20 hover:bg-white/20"
          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600";

        // Get list of usernames who reacted
        const usernames = reaction.users?.map((u) => u.username).filter(Boolean) || [];

        return (
          <div 
            key={reaction.emoji} 
            className="relative"
            onMouseEnter={(e) => {
              const tooltip = e.currentTarget.querySelector('.reaction-tooltip');
              if (tooltip) tooltip.classList.remove('opacity-0');
            }}
            onMouseLeave={(e) => {
              const tooltip = e.currentTarget.querySelector('.reaction-tooltip');
              if (tooltip) tooltip.classList.add('opacity-0');
            }}
          >
            <button
              onClick={() => handleReactionClick(reaction.emoji)}
              className={`${baseClasses} ${pillClasses}`}
              aria-label={`${reaction.emoji} reaction (${reaction.count})`}
            >
              <span className="text-sm">{reaction.emoji}</span>
              <span className="text-xs">{reaction.count}</span>
            </button>
            {/* Tooltip showing who reacted - only shows on hover of this specific reaction */}
            {usernames.length > 0 && (
              <div className="reaction-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 pointer-events-none transition-opacity duration-200 max-w-xs whitespace-normal z-[100]">
                <div className="flex items-start gap-1.5">
                  <span className="text-sm shrink-0 mt-0.5">{reaction.emoji}</span>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="font-medium text-white/90">Reacted by:</span>
                    <span className="text-white/80 break-words">{usernames.join(", ")}</span>
                  </div>
                </div>
                {/* Tooltip arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button
        ref={addButtonRef}
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Add reaction"
      >
        <SmilePlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      </button>
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full left-0 mb-2 z-50"
        >
          <Picker data={data} onEmojiSelect={handleEmojiSelect} />
        </div>
      )}
    </div>
  );
}

