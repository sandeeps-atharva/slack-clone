// components/chat/ChannelIcon.js
import { Hash, Lock } from "lucide-react";

export default function ChannelIcon({ isPrivate, className = "w-4 h-4" }) {
  const Icon = isPrivate ? Lock : Hash;
  return (
    <Icon className={`${className} text-purple-500 dark:text-purple-300 shrink-0`} />
  );
}


