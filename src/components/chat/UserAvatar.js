// components/chat/UserAvatar.js
import { User } from "lucide-react";

export default function UserAvatar({ username, size = "md" }) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const initial = username?.charAt(0)?.toUpperCase() || "";

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-200 font-semibold shrink-0`}
    >
      {initial || <User className="w-4 h-4" />}
    </div>
  );
}


