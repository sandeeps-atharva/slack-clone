import { memo } from "react";

function MentionSuggestions({ suggestions, highlightIndex, onSelect, onHover }) {
  if (!suggestions?.length) return null;

  return (
    <div className="absolute bottom-full mb-2 w-full max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-700">
        {suggestions.map((suggestion, index) => {
          const isActive = index === highlightIndex;
          const label =
            suggestion.displayName ||
            suggestion.username ||
            suggestion.name ||
            suggestion.mentionText ||
            "";
          const subtitle =
            suggestion.type === "channel"
              ? `#${suggestion.mentionText || label}`
              : suggestion.email || null;
          return (
            <li key={suggestion.id ?? suggestion.username ?? index}>
              <button
                type="button"
                onClick={() => onSelect?.(suggestion)}
                onMouseEnter={() => onHover?.(index)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                  isActive
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-600 dark:bg-purple-500/20 dark:text-purple-200">
                  {(label || "?")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800 dark:text-gray-100">
                    {suggestion.type === "channel" ? `#${label}` : label}
                  </p>
                  {subtitle && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(MentionSuggestions);
