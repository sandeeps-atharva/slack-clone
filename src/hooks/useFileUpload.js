// hooks/useFileUpload.js
import { useState, useRef, useCallback } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function useFileUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const reset = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [previewUrl]);

  const handleFileSelect = useCallback(
    (file) => {
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        setUploadError("File is too large. Max size is 10MB.");
        return;
      }

      reset();
      setSelectedFile(file);
      setUploadError(null);

      if (file.type.startsWith("image/") || file.type.startsWith("audio/")) {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      } else {
        setPreviewUrl(null);
      }
    },
    [reset]
  );

  const removeFile = useCallback(() => {
    reset();
  }, [reset]);

  const uploadFile = useCallback(async (file) => {
    if (!file) return null;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload file");
      }

      return result;
    } catch (error) {
      setUploadError(error.message || "Something went wrong");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    selectedFile,
    previewUrl,
    uploadError,
    isUploading,
    fileInputRef,
    handleFileSelect,
    removeFile,
    uploadFile,
    reset,
  };
}


