import AttachmentControls from "./AttachmentControls";

export default function MessageEditor({
  text,
  onChange,
  onSave,
  onCancel,
  isUpdating,
  error,
  attachmentProps = {},
  fileInputRef,
}) {
  const {
    mode = "none",
    initialAttachment,
    newFile,
    previewUrl,
    uploadError,
    isUploading,
    isRecording,
    recordingTime,
    recordingError,
    onOpenFilePicker,
    onOpenCamera,
    onToggleRecording,
    onToggleEmoji,
    onRemoveNewFile,
    onFileChange,
    onRemoveExisting,
    onRestoreExisting,
  } = attachmentProps || {};

  const renderNewAttachmentPreview = () => {
    if (!newFile) return null;
    const isImage = newFile.type?.startsWith("image/");
    const isAudio = newFile.type?.startsWith("audio/");
    return (
      <div className="flex items-center justify-between rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50/60 dark:bg-purple-500/10 px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          {isImage && previewUrl ? (
            <img src={previewUrl} alt={newFile.name} className="w-14 h-14 rounded-lg object-cover" />
          ) : isAudio && previewUrl ? (
            <audio controls className="w-40">
              <source src={previewUrl} type={newFile.type} />
            </audio>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-100 text-sm font-semibold">
              {newFile.name?.slice(0, 2)?.toUpperCase() || "FI"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[160px]">
              {newFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(newFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemoveNewFile}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200"
        >
          Remove
        </button>
      </div>
    );
  };

  const renderExistingAttachment = () => {
    if (!initialAttachment) return null;
    if (mode === "remove") {
      return (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-300">Attachment will be removed</span>
          <button
            type="button"
            onClick={onRestoreExisting}
            className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200"
          >
            Undo
          </button>
        </div>
      );
    }

    if (mode !== "keep") return null;

    return (
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
            {initialAttachment.fileName || "Attachment"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {initialAttachment.mimeType || initialAttachment.messageType || "file"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemoveExisting}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-100"
        >
          Remove
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-lg border border-purple-200 dark:border-purple-500/40 bg-white dark:bg-gray-900 text-sm sm:text-base text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
        rows={3}
        maxLength={2000}
        disabled={isUpdating}
      />
      {error && (
        <div className="text-xs text-red-100 dark:text-red-300">{error}</div>
      )}
      {(attachmentProps && (onOpenFilePicker || onOpenCamera || onToggleRecording || onToggleEmoji)) && (
        <div className="flex flex-col gap-2">
          <AttachmentControls
            onOpenFilePicker={onOpenFilePicker}
            onOpenCamera={onOpenCamera}
            onToggleRecording={onToggleRecording}
            onToggleEmoji={onToggleEmoji}
            isRecording={isRecording}
            recordingTime={recordingTime}
            isDisabled={isUpdating || isUploading}
          />
          {fileInputRef && (
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => onFileChange?.(event.target.files?.[0])}
            />
          )}
          {recordingError && (
            <p className="text-xs text-red-500 dark:text-red-300">{recordingError}</p>
          )}
          {uploadError && (
            <p className="text-xs text-red-500 dark:text-red-300">{uploadError}</p>
          )}
          <div className="flex flex-col gap-2">
            {renderExistingAttachment()}
            {renderNewAttachmentPreview()}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-60"
          disabled={isUpdating || isUploading}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          disabled={isUpdating}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}




