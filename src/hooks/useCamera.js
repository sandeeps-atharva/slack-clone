// hooks/useCamera.js
import { useState, useRef, useCallback, useEffect } from "react";

export default function useCamera() {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);

  const cameraStreamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  const openCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      console.error("Camera access error:", error);
      setCameraError("Unable to access camera. Please check permissions.");
    }
  }, []);

  const closeCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
  }, []);

  const capturePhoto = useCallback(() => {
    const videoEl = videoPreviewRef.current;
    if (!videoEl) {
      setCameraError("Camera preview not ready.");
      return;
    }

    const width = videoEl.videoWidth || 720;
    const height = videoEl.videoHeight || 1280;

    if (!width || !height) {
      setCameraError("Camera is still loading. Try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to capture image.");
      return;
    }
    context.drawImage(videoEl, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Capture failed. Please try again.");
          return;
        }

        const file = new File([blob], `photo-${Date.now()}.jpeg`, {
          type: "image/jpeg",
        });

        setCapturedFile(file);
        setCameraError(null);
        closeCamera();
      },
      "image/jpeg",
      0.92
    );
  }, [closeCamera]);

  const clearCapturedFile = useCallback(() => {
    setCapturedFile(null);
    setCameraError(null);
  }, []);

  useEffect(() => {
    if (isCameraOpen && videoPreviewRef.current && cameraStreamRef.current) {
      videoPreviewRef.current.srcObject = cameraStreamRef.current;
      const playPromise = videoPreviewRef.current.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    }
    return () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [isCameraOpen]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  return {
    isCameraOpen,
    cameraError,
    videoRef: videoPreviewRef,
    openCamera,
    closeCamera,
    capturePhoto,
    capturedFile,
    clearCapturedFile,
  };
}


