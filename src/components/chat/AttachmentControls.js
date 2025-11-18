import { Paperclip, Camera, Smile } from "lucide-react";
import MediaRecorderControls from "./MediaRecorderControls";

export default function AttachmentControls({
  onOpenFilePicker,
  onOpenCamera,
  onToggleRecording,
  onToggleEmoji,
  isRecording,
  recordingTime,
  isDisabled,
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenFilePicker}
        disabled={isDisabled}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 disabled:opacity-50"
        aria-label="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </button>
      <button
        onClick={onOpenCamera}
        disabled={isDisabled}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 disabled:opacity-50"
        aria-label="Open camera"
      >
        <Camera className="w-5 h-5" />
      </button>
      <button
        onClick={onToggleEmoji}
        disabled={isDisabled}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 disabled:opacity-50"
        aria-label="Toggle emoji picker"
      >
        <Smile className="w-5 h-5" />
      </button>
      <MediaRecorderControls
        isRecording={isRecording}
        recordingTime={recordingTime}
        onToggle={onToggleRecording}
        disabled={isDisabled && !isRecording}
      />
    </div>
  );
}



