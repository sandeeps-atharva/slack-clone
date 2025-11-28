import { useEffect, useMemo } from "react";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  VideoOff,
  Clock,
  User,
  Users,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";

const callTypeIconMap = {
  video: Video,
  audio: Phone,
};

const callStatusIconMap = {
  completed: PhoneCall,
  incoming: PhoneIncoming,
  outgoing: PhoneOutgoing,
  missed: PhoneMissed,
  declined: PhoneMissed,
};

const formatDuration = (durationMs) => {
  if (!durationMs || durationMs < 1000) return "< 1s";
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

const formatTimestamp = (value) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch (error) {
    return "";
  }
};

const getCallStatusColor = (status) => {
  switch (status) {
    case "completed":
      return "text-green-600 dark:text-green-400";
    case "missed":
    case "declined":
      return "text-red-600 dark:text-red-400";
    case "incoming":
      return "text-blue-600 dark:text-blue-400";
    case "outgoing":
      return "text-purple-600 dark:text-purple-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
};

export default function CallHistoryDropdown({
  calls,
  isLoading,
  error,
  onClose,
  onCallUser,
  onRemoveCall,
  onRefresh,
  isOpen,
  currentUserId,
  panelPosition = 0, // Position from right (0 = rightmost)
}) {
  // Calculate right offset: each panel is 28rem wide, position 0 is rightmost
  const rightOffset = panelPosition * 28; // in rem
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, isOpen]);

  const sortedCalls = useMemo(() => {
    if (!Array.isArray(calls)) {
      return [];
    }
    return [...calls].sort(
      (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  }, [calls]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 z-40 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full"
        style={rightStyle}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Phone className="w-4 h-4 text-green-500" />
            <span>Call History</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition disabled:opacity-60"
              aria-label="Refresh call history"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              aria-label="Close call history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-800">
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            </div>
          )}

          {isLoading && sortedCalls.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading call history...
            </div>
          ) : sortedCalls.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No calls yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedCalls.map((call) => {
                const CallTypeIcon = callTypeIconMap[call.callType] || Phone;
                const CallStatusIcon = callStatusIconMap[call.status] || PhoneCall;
                const statusColor = getCallStatusColor(call.status);
                const isOutgoing = call.initiatedBy === currentUserId;
                const otherParticipant = call.participants?.find(p => p.id !== currentUserId);
                const participantCount = call.participants?.length || 0;

                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                  >
                    <div className="relative">
                      <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-800 ${statusColor}`}>
                        <CallTypeIcon className="w-4 h-4" />
                      </div>
                      <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full bg-white dark:bg-gray-900 ${statusColor}`}>
                        <CallStatusIcon className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {call.channelName || otherParticipant?.username || "Unknown"}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className={statusColor}>
                              {isOutgoing ? "Outgoing" : "Incoming"}
                            </span>
                            {participantCount > 2 && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  <span>{participantCount} people</span>
                                </div>
                              </>
                            )}
                            {call.duration && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDuration(call.duration)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                          {formatTimestamp(call.timestamp)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        {otherParticipant && (
                          <button
                            onClick={() => onCallUser?.(otherParticipant, call.callType)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition"
                          >
                            <CallTypeIcon className="w-3.5 h-3.5" />
                            Call back
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveCall?.(call.id)}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/70 px-4 py-3 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {sortedCalls.length > 0 
              ? `${sortedCalls.length} call${sortedCalls.length === 1 ? "" : "s"} in history`
              : "Call history will appear here"
            }
          </div>
        </div>
      </div>
    </>
  );
}

