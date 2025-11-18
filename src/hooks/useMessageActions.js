// hooks/useMessageActions.js
import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { updateMessage, deleteMessage } from "../store/slices/chatSlice";

export default function useMessageActions(token, socketRef, activeThreadId, setActiveThreadId, setThreadMessageDraft) {
  const dispatch = useDispatch();
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [error, setError] = useState(null);
  const [errorId, setErrorId] = useState(null);

  const startEdit = useCallback((message) => {
    if (!message || message.id == null) return;
    if (message.message_type !== "text") return;
    setEditingMessageId(message.id);
    setEditingMessageText(message.message || "");
    setError(null);
    setErrorId(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingMessageText("");
    setError(null);
    setErrorId(null);
  }, []);

  const saveEdit = useCallback(async ({ attachment = null, removeAttachment = false } = {}) => {
    if (!token || editingMessageId == null) return;
    const trimmed = editingMessageText.trim();
    if (!trimmed) {
      setErrorId(editingMessageId);
      setError("Message cannot be empty");
      return;
    }

    try {
      const result = await dispatch(
        updateMessage({
          token,
          messageId: editingMessageId,
          message: trimmed,
          attachment,
          removeAttachment,
        })
      ).unwrap();

      socketRef?.current?.emit("message:edit", result);
      setEditingMessageId(null);
      setEditingMessageText("");
      setError(null);
      setErrorId(null);
    } catch (err) {
      const errorMessage =
        typeof err === "string"
          ? err
          : err?.error || err?.message || "Failed to update message";
      setErrorId(editingMessageId);
      setError(errorMessage);
    }
  }, [token, editingMessageId, editingMessageText, dispatch, socketRef]);

  const deleteMsg = useCallback(async (message) => {
    if (!token || !message || message.id == null) return;
    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    try {
      const result = await dispatch(
        deleteMessage({ token, messageId: message.id })
      ).unwrap();

      socketRef?.current?.emit("message:delete", result);
      setError(null);
      setErrorId(null);
      if (activeThreadId === message.id) {
        setActiveThreadId?.(null);
        setThreadMessageDraft?.("");
      }
    } catch (err) {
      const errorMessage =
        typeof err === "string"
          ? err
          : err?.error || err?.message || "Failed to delete message";
      setErrorId(message.id);
      setError(errorMessage);
    }
  }, [token, dispatch, socketRef, activeThreadId, setActiveThreadId, setThreadMessageDraft]);

  return {
    editingMessageId,
    editingText: editingMessageText,
    setEditingText: setEditingMessageText,
    startEdit,
    saveEdit,
    deleteMsg,
    cancelEdit,
    error,
    errorId,
  };
}

