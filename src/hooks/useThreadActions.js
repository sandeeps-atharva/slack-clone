// hooks/useThreadActions.js
import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { sendMessage, addPendingMessage } from "../store/slices/chatSlice";
import { extractMentions } from "../utils/renderMentions";

export default function useThreadActions(token, socketRef, activeChannelId, user) {
  const dispatch = useDispatch();
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadMessageDraft, setThreadMessageDraft] = useState("");
  const [error, setError] = useState(null);

  const generateClientId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const openThread = useCallback((message) => {
    if (!message) return;
    const rootId = message.thread_parent_id || message.id;
    if (!rootId) return;
    setActiveThreadId(rootId);
    setThreadMessageDraft("");
    setError(null);
  }, []);

  const closeThread = useCallback(() => {
    setActiveThreadId(null);
    setThreadMessageDraft("");
    setError(null);
  }, []);

  const sendThreadReply = useCallback(
    async ({ attachment = null } = {}) => {
    if (!user || !token || !activeThreadId || activeChannelId == null) return;

    const trimmed = threadMessageDraft.trim();
      const hasAttachment = attachment && attachment.fileUrl;
      if (!trimmed && !hasAttachment) return;

    const clientId = generateClientId();

      const mentions = extractMentions(trimmed);

      let messageType = "text";
      if (hasAttachment) {
        if (attachment.mimeType?.startsWith("image/")) {
          messageType = "image";
        } else if (attachment.mimeType?.startsWith("audio/")) {
          messageType = "audio";
        } else {
          messageType = "file";
        }
      }

    dispatch(
      addPendingMessage({
        id: clientId,
        clientId,
        user_id: user.id,
        username: user.username,
          message: trimmed || null,
          message_type: messageType,
          file_url: hasAttachment ? attachment.fileUrl : null,
          file_name: hasAttachment ? attachment.fileName : null,
          mime_type: hasAttachment ? attachment.mimeType : null,
        created_at: new Date().toISOString(),
        status: "pending",
        channel_id: activeChannelId,
        thread_parent_id: activeThreadId,
        mentions,
      })
    );

    setThreadMessageDraft("");
    setError(null);

    try {
      const result = await dispatch(
        sendMessage({
          message: trimmed,
          attachment,
          token,
          clientId,
          channelId: activeChannelId,
          threadParentId: activeThreadId,
          mentions,
        })
      ).unwrap();

      const payloadWithClient = {
        ...result,
        clientId: result?.clientId || clientId || null,
      };
      socketRef?.current?.emit("send_message", payloadWithClient);
    } catch (err) {
      const errorMessage =
        typeof err === "string"
          ? err
          : err?.error || err?.message || "Failed to send reply";
      setError(errorMessage);
    }
    },
    [user, token, activeThreadId, activeChannelId, threadMessageDraft, dispatch, socketRef]
  );

  return {
    activeThreadId,
    setActiveThreadId,
    threadDraft: threadMessageDraft,
    setThreadDraft: setThreadMessageDraft,
    openThread,
    closeThread,
    sendThreadReply,
    error,
  };
}

