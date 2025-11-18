import { Video, X, Phone } from "lucide-react";

export default function IncomingCallNotification({ incomingCall, channel, onJoin, onDecline }) {
  if (!incomingCall || !channel) return null;

  return (
    <div className="fixed top-20 right-4 z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border-2 border-purple-500 p-4 max-w-sm animate-pulse">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
            <Video className="w-6 h-6 text-purple-600 dark:text-purple-300" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            Incoming Call
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {incomingCall.startedBy?.username || "Someone"} is calling in {channel.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onJoin}
            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors"
            title="Join call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={onDecline}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            title="Decline"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

