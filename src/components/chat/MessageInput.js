import { forwardRef } from "react";

const MessageInput = forwardRef(function MessageInput(
  { value, onChange, onKeyDown, placeholder = "Write a message...", disabled },
  ref
) {
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm sm:text-base text-gray-800 dark:text-gray-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
    />
  );
});

export default MessageInput;



