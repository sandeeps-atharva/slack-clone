// hooks/useMediaRecorder.js
import { useState, useRef, useCallback, useEffect } from "react";

export default function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [recordedFile, setRecordedFile] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser.");
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (err) {
        console.error("Failed to start MediaRecorder:", err);
        setError("Unable to start recording.");
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        return;
      }

      recordedChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }

        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }

        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (!chunks.length) {
          setError("Recording was too short.");
          return;
        }

        const firstChunkType =
          chunks[0].type && chunks[0].type !== "application/octet-stream"
            ? chunks[0].type
            : "audio/webm";
        const blob = new Blob(chunks, { type: firstChunkType });

        if (blob.size === 0) {
          setError("Recording was too short.");
          return;
        }

        const extension = firstChunkType.split("/")[1] || "webm";
        const fileName = `voice-note-${Date.now()}.${extension}`;
        const file = new File([blob], fileName, { type: firstChunkType });

        setRecordedFile(file);
        setError(null);
        setRecordingTime(0);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        setError("Recording failed. Please try again.");
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setError("Unable to access microphone. Please check permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const clearRecording = useCallback(() => {
    setRecordedFile(null);
    setError(null);
    setRecordingTime(0);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    recordingTime,
    error,
    recordedFile,
    startRecording,
    stopRecording,
    toggleRecording,
    clearRecording,
  };
}


