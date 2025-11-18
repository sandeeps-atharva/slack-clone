import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateMessageReaction } from "../store/slices/chatSlice";

export default function useMessageReactions(socketRef, token) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const currentUserId = user?.id;

  const toggleReaction = useCallback(
    async (messageId, emoji, channelId) => {
      if (!messageId || !emoji || !token || !channelId) return;

      try {
        const res = await fetch(`/api/messages/${messageId}/reactions?messageId=${messageId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ emoji }),
        });

        if (res.ok) {
          const data = await res.json();
          const reactionUser = data.user || { id: user?.id, username: user?.username };
          
          // Update Redux state optimistically
          dispatch(
            updateMessageReaction({
              messageId,
              channelId,
              emoji: data.emoji,
              action: data.action,
              user: reactionUser,
              currentUserId,
            })
          );

          // Emit socket event for real-time updates
          // IMPORTANT: Emit the socket event so other users get real-time updates
          const emitReactionEvent = () => {
            const payload = {
              messageId,
              channelId,
              emoji: data.emoji,
              action: data.action,
              user: reactionUser,
              currentUserId,
            };
            
            if (!socketRef.current) {
              console.error("❌ Socket ref is null! Cannot emit reaction event.");
              return false;
            }
            
            if (!socketRef.current.connected) {
              console.warn("❌ Socket not connected! Current state:", {
                exists: !!socketRef.current,
                connected: socketRef.current.connected,
                id: socketRef.current.id
              });
              // Try to wait for connection
              socketRef.current.once("connect", () => {
                socketRef.current.emit("message:reaction", payload);
              });
              return false;
            } 
            try {
              socketRef.current.emit("message:reaction", payload);
              return true;
            } catch (error) {
              console.error("❌ Error emitting reaction event:", error);
              return false;
            }
          };
          
          emitReactionEvent();
        } else {
          console.error("Failed to toggle reaction");
        }
      } catch (error) {
        console.error("Error toggling reaction:", error);
      }
    },
    [token, user, currentUserId, dispatch, socketRef]
  );

  return { toggleReaction };
}

