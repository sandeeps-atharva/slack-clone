import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  X,
} from "lucide-react";
import {
  toggleLocalVideo,
  toggleLocalAudio,
  setScreenSharing,
  setLocalStream,
  closeCallPanel,
} from "../store/slices/callSlice";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { usePeerConnections } from "../hooks/usePeerConnections";
import useCallActions from "../hooks/useCallActions";
import ParticipantVideo from "./ParticipantVideo";
import useCamera from "@/hooks/useCamera";

export default function CallPanel({ socket, channel }) {
  const dispatch = useDispatch();
  const {
    isInCall,
    callChannelId,
    callType,
    localStream,
    isLocalVideoEnabled,
    isLocalAudioEnabled,
    isScreenSharing,
    participants,
    callError,
    connectionError,
    showCallPanel,
  } = useSelector((state) => state.call);
  const { user } = useSelector((state) => state.auth);
  const activeChannelId = useSelector((state) => state.channels?.activeChannelId);
  const incomingCall = useSelector((state) => state.call.incomingCall);
  const {closeCamera} = useCamera();
  
  // Use callActions hook to get endCall function that sends system message
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  
  const callActions = useCallActions(socketRef, activeChannelId, incomingCall);

  const {
    startMedia,
    stopMedia,
    toggleVideo: toggleMediaVideo,
    toggleAudio: toggleMediaAudio,
    startScreenShare,
    error: mediaError,
  } = useLocalMedia(callType);

  const localVideoRef = useRef(null);

  // Initialize local media
  useEffect(() => {
    if (isInCall && !localStream && callChannelId) {
      startMedia()
        .then((stream) => {
          dispatch(setLocalStream(stream));
          // Join call room via socket
          if (socket && user) {
            socket.emit("call:join", {
              channelId: callChannelId,
              user: {
                id: user.id,
                username: user.username,
              },
            });
          }
        })
        .catch((err) => {
          console.error("Error starting media:", err);
        });
    }

    return () => {
      if (!isInCall) {
        // Stop all tracks from localStream
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            track.stop();
          });
        }
        // Stop media from useLocalMedia hook
        stopMedia();
        // Close camera from useCamera hook
        closeCamera();
        // Clear video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        dispatch(setLocalStream(null));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, callChannelId, socket, user, dispatch, localStream, stopMedia, closeCamera]);

  // Setup peer connections
  usePeerConnections(socket, localStream, callChannelId, user);

  // Display local video
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement || !localStream) {
      // If no stream, ensure video element is cleared
      if (videoElement) {
        videoElement.srcObject = null;
      }
      return;
    }

    videoElement.srcObject = localStream;
    const playPromise = videoElement.play();
    if (playPromise?.catch) {
      playPromise.catch((err) => {
        console.error("Error playing local video:", err);
      });
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
      // Stop all tracks when video element is unmounted
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [localStream]);

  // Cleanup on unmount - ensure camera is always turned off
  useEffect(() => {
    return () => {
      stopMedia();
      closeCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, callChannelId]);

  // Close camera when call panel is closed (X button or any other way)
  useEffect(() => {
    if (!showCallPanel && !isInCall) {
      // Panel was closed and call ended - ensure camera is off
      closeCamera();
      stopMedia();
    }
  }, [showCallPanel, isInCall, closeCamera, stopMedia]);

  // Close camera when call ends (isInCall becomes false)
  useEffect(() => {
    if (!isInCall) {
      // Call ended - ensure camera is off immediately
      // Stop all tracks from localStream if it still exists
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      stopMedia();
      closeCamera();
      
      // Also clear video element srcObject
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [isInCall, localStream, closeCamera, stopMedia]);

  const handleEndCall = async () => {
    // First, stop all media tracks immediately (before Redux state updates)
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    
    // Clear video element immediately
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Stop media from useLocalMedia hook (stops streamRef)
    stopMedia();
    
    // Ensure camera from useCamera is also closed (same logic as attachment camera)
    closeCamera();
    
    // Use callActions.endCall which handles system message sending
    await callActions.endCall(callChannelId);
  };

  const handleToggleVideo = () => {
    toggleMediaVideo();
    dispatch(toggleLocalVideo());
  };

  const handleToggleAudio = () => {
    toggleMediaAudio();
    dispatch(toggleLocalAudio());
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share - handled by useLocalMedia hook
        dispatch(setScreenSharing(false));
      } else {
        await startScreenShare();
        dispatch(setScreenSharing(true));
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
    }
  };

  if (!isInCall || !showCallPanel) return null;

  const participantArray = Object.values(participants);
  const totalParticipants = participantArray.length + 1; // +1 for local user

  // Grid layout based on number of participants
  const getGridClass = () => {
    if (totalParticipants === 1) return "grid-cols-1";
    if (totalParticipants === 2) return "grid-cols-1 md:grid-cols-2";
    if (totalParticipants === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/90 backdrop-blur-sm px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <h2 className="text-white font-semibold text-base sm:text-lg truncate">
            {channel?.name || "Video Call"}
          </h2>
          <span className="text-gray-400 text-xs sm:text-sm shrink-0">
            {totalParticipants} {totalParticipants === 1 ? "participant" : "participants"}
          </span>
        </div>
        <button
          onClick={() => dispatch(closeCallPanel())}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Error messages */}
      {(callError || connectionError || mediaError) && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2">
          <p className="text-red-200 text-sm">
            {callError || connectionError || mediaError}
          </p>
        </div>
      )}

      {/* Video grid */}
      <div className={`flex-1 grid ${getGridClass()} gap-2 p-2 sm:p-4 overflow-auto`}>
        {/* Local video */}
        {localStream && (
          <div className="relative w-full h-full min-h-[200px]">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute bottom-2 left-2 flex gap-2 items-center bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
              <span className="text-white text-xs font-medium">You</span>
              {!isLocalAudioEnabled && (
                <MicOff className="w-3 h-3 text-red-400" />
              )}
              {!isLocalVideoEnabled && (
                <VideoOff className="w-3 h-3 text-red-400" />
              )}
            </div>
          </div>
        )}

        {/* Remote participants */}
        {participantArray.map((participant) => (
          <ParticipantVideo
            key={participant.user?.id || Math.random()}
            participant={participant}
            isLocal={false}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="bg-gray-900/90 backdrop-blur-sm px-2 sm:px-4 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-4 border-t border-gray-800 flex-wrap">
        <button
          onClick={handleToggleAudio}
          className={`p-2 sm:p-3 rounded-full transition-colors ${
            isLocalAudioEnabled
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
          title={isLocalAudioEnabled ? "Mute" : "Unmute"}
        >
          {isLocalAudioEnabled ? (
            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          onClick={handleToggleVideo}
          className={`p-2 sm:p-3 rounded-full transition-colors ${
            isLocalVideoEnabled
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
          title={isLocalVideoEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {isLocalVideoEnabled ? (
            <Video className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          onClick={handleToggleScreenShare}
          className={`p-2 sm:p-3 rounded-full transition-colors ${
            isScreenSharing
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          onClick={handleEndCall}
          className="p-2 sm:p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
          title="End call"
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}

