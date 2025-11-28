import { X, Camera } from "lucide-react";

export default function CameraCapture({ isOpen, onClose, onCapture, videoRef, error }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium uppercase tracking-wide">
          Camera Capture
        </span>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-2xl overflow-hidden">
          <video ref={videoRef} playsInline autoPlay className="w-full h-full object-cover" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-red-400 text-sm px-4 text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 pb-10">
        <button
          onClick={onCapture}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition"
        >
          <Camera className="w-5 h-5" />
          Capture
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}






















