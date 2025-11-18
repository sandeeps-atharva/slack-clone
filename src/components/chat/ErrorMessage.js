// components/chat/ErrorMessage.js
import { X } from "lucide-react";

export default function ErrorMessage({ error, onDismiss }) {
  if (!error) return null;

  return (
    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 p-3 rounded-md flex items-center justify-between gap-2">
      <span className="text-sm">{error}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}


