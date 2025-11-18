// components/OnlineIndicator.js
export default function OnlineIndicator({ userId, onlineUserIds, className = "" }) {
  const isOnline = userId && onlineUserIds && onlineUserIds.includes(userId);
  
  if (!isOnline) return null;
  
  return (
    <span
      className={`inline-block w-[14px] h-[14px] rounded-full bg-green-500 border-2 border-white dark:border-gray-900 ${className}`}
      title="Online"
      aria-label="Online"
    />
  );
}

