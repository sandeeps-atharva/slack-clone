import { X, FileText, Play } from "lucide-react";

export default function AttachmentPreview({ file, previewUrl, onRemove, className = "" }) {
  if (!file) return null;

  const isImage = file.type?.startsWith("image/");
  const isAudio = file.type?.startsWith("audio/");

  return (
    <div
      className={`fixed bottom-36 right-6 z-40 flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
        ) : isAudio && previewUrl ? (
          <audio controls className="w-32">
            <source src={previewUrl} type={file.type} />
          </audio>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-200">
            {isAudio ? <Play className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
            {file.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500"
        aria-label="Remove attachment"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}









