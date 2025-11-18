// components/chat/OnlineStatusBadge.js
import OnlineIndicator from "../OnlineIndicator";

export default function OnlineStatusBadge({ userId, onlineUserIds, className = "" }) {
  return (
    <OnlineIndicator
      userId={userId}
      onlineUserIds={onlineUserIds}
      className={className}
    />
  );
}


