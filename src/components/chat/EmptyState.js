// components/chat/EmptyState.js
import { MessageCircle } from "lucide-react";

export default function EmptyState({ message, icon: Icon = MessageCircle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Icon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
        {message}
      </p>
    </div>
  );
}


