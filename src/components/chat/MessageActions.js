import { Pencil, Trash2, MessageSquare } from "lucide-react";

export default function MessageActions({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onThreadOpen,
  isUpdating,
  isDeleting,
  threadCount,
  showThreadActions,
  isOwn,
}) {
  // Icon button style - similar to emoji picker
  const iconButtonClass = isOwn
    ? "flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/20 dark:hover:bg-white/20 transition-colors"
    : "flex items-center justify-center w-6 h-6 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors";

  const iconClass = isOwn
    ? "w-3.5 h-3.5 text-white/80 hover:text-white"
    : "w-3.5 h-3.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200";

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Reply button - always show if thread actions are enabled */}
      {showThreadActions && (
        <button
          onClick={onThreadOpen}
          className={iconButtonClass}
          title="Reply to this message"
        >
          <MessageSquare className={iconClass} />
        </button>
      )}
      {canEdit && (
        <button
          onClick={onEdit}
          className={iconButtonClass}
          disabled={isUpdating}
          title="Edit message"
        >
          <Pencil className={iconClass} />
        </button>
      )}
      {canDelete && (
        <button
          onClick={onDelete}
          className={iconButtonClass}
          disabled={isDeleting}
          title="Delete message"
        >
          <Trash2 className={iconClass} />
        </button>
      )}
    </div>
  );
}
