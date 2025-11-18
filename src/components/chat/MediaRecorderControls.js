import { Mic, Square } from "lucide-react";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function MediaRecorderControls({ isRecording, recordingTime, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
        isRecording
          ? "border-red-500 text-red-500 bg-red-100/10 animate-pulse"
          : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      {isRecording && `Stop • ${formatTime(recordingTime)}`}
    </button>
  );
}



