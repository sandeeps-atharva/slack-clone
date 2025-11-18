import { useEffect, useRef } from "react";
import { User, Mic, MicOff, Video, VideoOff } from "lucide-react";

export default function ParticipantVideo({ participant, isLocal = false }) {
  const videoRef = useRef(null);
  const { stream, user, videoEnabled: propVideoEnabled = true, audioEnabled: propAudioEnabled = true } = participant || {};

  // Check actual stream track states
  const videoEnabled = stream?.getVideoTracks()?.some(track => track.enabled && track.readyState === 'live') ?? propVideoEnabled;
  const audioEnabled = stream?.getAudioTracks()?.some(track => track.enabled && track.readyState === 'live') ?? propAudioEnabled;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !stream) return;

    videoElement.srcObject = stream;
    const playPromise = videoElement.play();
    if (playPromise?.catch) {
      playPromise.catch((err) => {
        console.error("Error playing video:", err);
      });
    }

    return () => {
      videoElement.srcObject = null;
    };
  }, [stream]);

  const displayName = user?.username || "Unknown User";

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden group">
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                  <User className="w-10 h-10 text-gray-400" />
                </div>
                <span className="text-white text-sm font-medium">{displayName}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
              <User className="w-10 h-10 text-gray-400" />
            </div>
            <span className="text-white text-sm font-medium">{displayName}</span>
          </div>
        </div>
      )}
      
      {/* Status indicators */}
      <div className="absolute bottom-2 left-2 flex gap-2 items-center bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
        <span className="text-white text-xs font-medium truncate max-w-[120px]">
          {isLocal ? "You" : displayName}
        </span>
        {!audioEnabled && (
          <MicOff className="w-3 h-3 text-red-400" />
        )}
        {audioEnabled && !isLocal && (
          <Mic className="w-3 h-3 text-green-400" />
        )}
        {!videoEnabled && (
          <VideoOff className="w-3 h-3 text-red-400" />
        )}
        {videoEnabled && (
          <Video className="w-3 h-3 text-green-400" />
        )}
      </div>
    </div>
  );
}

