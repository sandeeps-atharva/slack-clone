// hooks/useCallActions.js
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  startCall as startCallAction,
  endCall as endCallAction,
  clearCallError,
  clearIncomingCall,
  setActiveChannel,
  clearLastCallEnded,
} from "../store/slices/callSlice";
import { sendMessage } from "../store/slices/chatSlice";

// Helper function to format duration
function formatDuration(ms) {
  if (!ms || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export default function useCallActions(socketRef, activeChannelId, incomingCall) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const token = useSelector((state) => state.auth.token);
  const callStartTime = useSelector((state) => state.call.callStartTime);

  const startCall = useCallback(async () => {
    if (activeChannelId == null || activeChannelId === "") return;

    if (typeof window !== "undefined") {
      const shouldStart = window.confirm("Start a video call?");
      if (!shouldStart) {
        return;
      }
    }

    dispatch(clearCallError());
    dispatch(clearIncomingCall());
    dispatch(startCallAction({ channelId: activeChannelId, callType: "video" }));
    
    // Send system message for call started
    if (token && user) {
      try {
        const result = await dispatch(
          sendMessage({
            message: `Call started by ${user.username}`,
            token,
            channelId: activeChannelId,
            messageType: "call_started",
          })
        ).unwrap();
        
        // Emit via socket for real-time updates
        if (socketRef?.current && result) {
          socketRef.current.emit("send_message", result);
        }
      } catch (error) {
        console.error("Failed to send call started message:", error);
      }
    }
  }, [activeChannelId, dispatch, token, user, socketRef]);

  const joinCall = useCallback(() => {
    const channelIdToJoin = incomingCall?.channelId || activeChannelId;
    if (channelIdToJoin == null || channelIdToJoin === "") return;
    dispatch(clearCallError());
    dispatch(clearIncomingCall());
    if (incomingCall?.channelId && incomingCall.channelId !== activeChannelId) {
      dispatch(setActiveChannel(incomingCall.channelId));
    }
    dispatch(startCallAction({ channelId: channelIdToJoin, callType: "video" }));
  }, [incomingCall, activeChannelId, dispatch]);

  const declineCall = useCallback(() => {
    dispatch(clearIncomingCall());
  }, [dispatch]);

  const endCall = useCallback(
    async (callChannelId) => {
      if (socketRef?.current && callChannelId) {
        socketRef.current.emit("call:leave", { channelId: callChannelId });
      }
      
      // Calculate duration from call start time
      const duration = callStartTime ? Date.now() - callStartTime : null;
      
      dispatch(endCallAction(callChannelId ?? null));
      
      // Send system message for call ended
      if (token && user && callChannelId) {
        try {
          const formattedDuration = formatDuration(duration);
          const username = user.username || "Unknown user";
          const messageText = formattedDuration 
            ? `Call ended by ${username} • ${formattedDuration}`
            : `Call ended by ${username}`;
          
          const result = await dispatch(
            sendMessage({
              message: messageText,
              token,
              channelId: callChannelId,
              messageType: "call_ended",
            })
          ).unwrap();
          
          // Emit via socket for real-time updates
          if (socketRef?.current && result) {
            socketRef.current.emit("send_message", result);
          }
        } catch (error) {
          console.error("Failed to send call ended message:", error);
        }
      }
    },
    [socketRef, dispatch, token, user, callStartTime]
  );

  return {
    startCall,
    joinCall,
    declineCall,
    endCall,
  };
}

