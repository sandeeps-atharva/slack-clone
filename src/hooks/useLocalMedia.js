import { useState, useEffect, useRef } from "react";

export function useLocalMedia(callType = "video") {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef(null);
  

  const startMedia = async (constraints = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const defaultConstraints = {
        video: callType === "video" ? { facingMode: "user" } : false,
        audio: true,
        ...constraints,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsLoading(false);
      return mediaStream;
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError(err.message || "Failed to access camera/microphone");
      setIsLoading(false);
      throw err;
    }
  };

  const stopMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setError(null);
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace video track in existing stream
      if (streamRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = streamRef.current.getVideoTracks()[0];
        if (sender) {
          streamRef.current.removeTrack(sender);
          sender.stop();
        }
        streamRef.current.addTrack(videoTrack);

        // Handle screen share end
        videoTrack.onended = () => {
          // Restore camera
          navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "user" }, audio: false })
            .then((cameraStream) => {
              const cameraTrack = cameraStream.getVideoTracks()[0];
              const screenSender = streamRef.current.getVideoTracks()[0];
              if (screenSender) {
                streamRef.current.removeTrack(screenSender);
                screenSender.stop();
              }
              streamRef.current.addTrack(cameraTrack);
              cameraStream.getTracks().forEach((track) => {
                if (track.kind === "audio") track.stop();
              });
            })
            .catch((err) => {
              console.error("Error restoring camera:", err);
            });
        };
      }

      return screenStream;
    } catch (err) {
      console.error("Error starting screen share:", err);
      throw err;
    }
  };

  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, []);

  return {
    stream,
    error,
    isLoading,
    startMedia,
    stopMedia,
    toggleVideo,
    toggleAudio,
    startScreenShare,
  };
}

