// hooks/useTyping.js
import { useState, useRef, useCallback, useEffect } from "react";

export default function useTyping(socketRef, activeChannelId, user) {
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const emitTypingEvent = useCallback(
    (isTypingNow) => {
      const socket = socketRef?.current;
      if (!socket || !user || !activeChannelId) return;
      socket.emit(isTypingNow ? "typing:start" : "typing:stop", {
        channelId: activeChannelId,
        user: { id: user.id, username: user.username },
      });
    },
    [socketRef, activeChannelId, user]
  );

  const handleTypingStopped = useCallback(() => {
    if (!isTyping) return;
    setIsTyping(false);
    emitTypingEvent(false);
  }, [isTyping, emitTypingEvent]);

  const scheduleTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStopped();
    }, 2000);
  }, [handleTypingStopped]);

  const handleMessageChange = useCallback(
    (value) => {
      if (!isTyping) {
        setIsTyping(true);
        emitTypingEvent(true);
      }
      scheduleTypingTimeout();
      return value;
    },
    [isTyping, emitTypingEvent, scheduleTypingTimeout]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        emitTypingEvent(false);
      }
    };
  }, [isTyping, emitTypingEvent]);

  return {
    isTyping,
    typingUsers,
    setTypingUsers,
    handleMessageChange,
    emitTyping: emitTypingEvent,
    resetTyping: () => setIsTyping(false),
  };
}

