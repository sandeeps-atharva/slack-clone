// components/chat/TypingIndicator.js
export default function TypingIndicator({ typingUsers }) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const names = typingUsers.slice(0, 2);
  const remaining = typingUsers.length - names.length;
  const text =
    names.length === 1
      ? `${names[0]} is typing...`
      : remaining > 0
      ? `${names.join(", ")} and ${remaining} more are typing...`
      : `${names.join(" and ")} are typing...`;

  return (
    <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 italic">
      {text}
    </div>
  );
}


