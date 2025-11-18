// components/chat/CallControlButtons.js
import { Video, PhoneOff, Phone } from "lucide-react";

export default function CallControlButtons({
  isInCall,
  hasActiveCall,
  hasIncomingCall,
  onStart,
  onJoin,
  onEnd,
  isActiveChannel,
  isCallPanelVisible,
  onReopenCallPanel,
}) {
  // Show incoming call indicator (pulsing green phone icon)
  if (hasIncomingCall && !isInCall && isActiveChannel) {
    return (
      <button
        onClick={onJoin}
        className="p-1.5 sm:p-2 rounded-full bg-green-600 hover:bg-green-700 text-white transition animate-pulse"
        title="Incoming call - Click to join"
        aria-label="Incoming call"
      >
        <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    );
  }

  if (isInCall && isActiveChannel) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!isCallPanelVisible && (
          <button
            onClick={onReopenCallPanel}
            className="p-1.5 sm:p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition"
            title="Return to call"
            aria-label="Return to call"
          >
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        <button
          onClick={onEnd}
          className="p-1.5 sm:p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition"
          title="End call"
          aria-label="End call"
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    );
  }

  if (hasActiveCall && !isInCall && isActiveChannel) {
    return (
      <button
        onClick={onJoin}
        className="p-1.5 sm:p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200"
        title="Join active call"
        aria-label="Join active call"
      >
        <Video className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    );
  }

  if (!isInCall && !hasActiveCall && isActiveChannel) {
    return (
      <button
        onClick={onStart}
        className="p-1.5 sm:p-2 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200"
        title="Start video call"
        aria-label="Start video call"
      >
        <Video className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    );
  }

  return null;
}





