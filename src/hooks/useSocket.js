// hooks/useSocket.js
import { useRef, useEffect, useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import io from "socket.io-client";
import {
  receiveMessage,
  applyIncomingMessageUpdate,
  removeMessage,
  updateMessageReaction,
  updateMessageReadStatus,
  incrementUnreadCount,
} from "../store/slices/chatSlice";
import {
  setActiveCall,
  removeActiveCall,
  setIncomingCall,
  clearIncomingCall,
  endCall,
} from "../store/slices/callSlice";
import {
  setUserOnline,
  setUserOffline,
  setOnlineUsers,
} from "../store/slices/onlineStatusSlice";
import { addChannel, removeMemberFromChannel, updateChannelFromSocket, fetchChannelMembers } from "../store/slices/channelSlice";
import {
  addNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../store/slices/notificationSlice";

const getPreferenceKeyForNotification = (type) => {
  switch (type) {
    case "dm":
      return "dm";
    case "mention":
      return "mention";
    case "call":
      return "call";
    default:
      return "message";
  }
};

export default function useSocket({
  user,
  isAuthenticated,
  activeChannelId,
  channelsByIdRef,
  joinedChannelIdsRef,
  userRef,
  activeChannelIdRef,
  isInCallRef,
  callChannelIdRef,
  incomingCallRef,
  localStreamRef,
  activeThreadIdRef,
  notificationPreferencesRef,
  playNotificationSound,
  setTypingUsers,
  socketRef: externalSocketRef,
  tokenRef,
}) {
  const dispatch = useDispatch();
  const socketRef = externalSocketRef ?? useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Helper function to set up reaction listener
    const setupReactionListener = (socket) => {
      socket.off("message:reaction"); // Remove any existing listener first
      socket.on("message:reaction", (payload) => {
        if (!payload) {
          console.warn("message:reaction: Empty payload received");
          return;
        }
        const currentUser = userRef.current;
        
        if (!payload.messageId || !payload.channelId || !payload.emoji || !payload.action) {
          console.warn("message:reaction: Missing required fields", payload);
          return;
        }
        
        dispatch(
          updateMessageReaction({
            messageId: payload.messageId,
            channelId: payload.channelId,
            emoji: payload.emoji,
            action: payload.action,
            user: payload.user,
            currentUserId: currentUser?.id,
          })
        );
      });
    };

    if (socketRef.current) {
      // Socket already exists, just ensure reaction listener is set up
      setupReactionListener(socketRef.current);
      return; // Don't create a new socket, just ensure listener is set up
    }

    // Create new socket connection
    socketRef.current = io({
      path: "/api/socketio",
    });

    socketRef.current.on("connect", () => {
      setIsConnected(true);
      
      // Ensure reaction listener is set up when socket connects
      setupReactionListener(socketRef.current);
      
      if (user?.id) {
        socketRef.current.emit("user:online", {
          userId: user.id,
          user: { id: user.id, username: user.username },
        });
      }
    });

    socketRef.current.on("disconnect", () => {
      setIsConnected(false);
    });

    socketRef.current.on("reconnect", () => {
      // Re-setup reaction listener on reconnect
      setupReactionListener(socketRef.current);
    });

    const setTyping = setTypingUsers ?? (() => {});

    socketRef.current.on("receive_message", (msg) => {
      const channelId = Number(msg.channel_id ?? msg.channelId ?? msg.channel);
      if (!Number.isFinite(channelId)) {
        return;
      }

      const currentUser = userRef.current;
      const activeChannelIdCurrent = activeChannelIdRef.current;

      // Check if this message should be marked as unread
      const authorId = Number(
        msg.user_id ?? msg.userId ?? msg.author_id ?? msg.authorId
      );
      const authorUsername = (msg.username || msg.user?.username || "").trim();
      const currentUsername = currentUser?.username
        ? String(currentUser.username).trim()
        : "";

      const isOwnMessage =
        (currentUser?.id != null && authorId === currentUser.id) ||
        (!!authorUsername &&
          !!currentUsername &&
          authorUsername.toLowerCase() === currentUsername.toLowerCase());

      // If channel is not in our list yet, it might be a new DM channel
      // Create a temporary channel entry so the message can be processed
      let channelInfo = channelsByIdRef.current[channelId] || null;
      const isChannelJoined = joinedChannelIdsRef.current.has(channelId);
      
      if (!channelInfo && !isChannelJoined && !isOwnMessage && currentUser?.id && authorId && authorId !== currentUser.id) {
        // This is likely a new DM channel - create a temporary channel entry
        const dmMetadata = {
          type: "dm",
          participants: [
            { id: currentUser.id, username: currentUser.username },
            { id: authorId, username: authorUsername },
          ],
        };

        const tempChannel = {
          id: channelId,
          name: authorUsername || "Direct Message",
          is_private: 1,
          topic: JSON.stringify(dmMetadata),
          role: "member",
          metadata: dmMetadata, // Add metadata directly for easier access
        };
        
        // Add to Redux store
        dispatch(addChannel(tempChannel));
        
        // Update refs
        channelsByIdRef.current[channelId] = tempChannel;
        joinedChannelIdsRef.current.add(channelId);
        
        channelInfo = tempChannel;
      }

      // If still no channel info and not joined, skip processing
      // But allow system messages to go through
      const isSystemMessage = msg.message_type === "call_started" || msg.message_type === "call_ended" || msg.message_type === "member_added" || msg.message_type === "member_left" || msg.message_type === "member_removed" || msg.message_type === "room_booking";
      if (!channelInfo && !isChannelJoined && !isSystemMessage) {
        return;
      }

      // Don't increment unread count for own messages or system messages
      if (isOwnMessage || isSystemMessage) {
        dispatch(
          receiveMessage({
            ...msg,
            status: "sent",
          })
        );
        return;
      }

      // Mark as unread if channel is not active
      const isUnread = channelId !== activeChannelIdCurrent;

      dispatch(
        receiveMessage({
          ...msg,
          status: "sent",
        })
      );

      // If unread, increment unread count
      if (isUnread) {
        dispatch(incrementUnreadCount(channelId));
      }

      // Get channel info again in case it was just added
      if (!channelInfo) {
        channelInfo = channelsByIdRef.current[channelId] || null;
      }
      const isDMChannel =
        channelInfo?.metadata?.type === "dm" || channelInfo?.is_private;

      const rawMessage =
        typeof msg.message === "string"
          ? msg.message
          : msg.file_name || msg.file_url || "";
      const normalizedMessage = rawMessage?.trim() || "(Attachment)";
      const mentionPattern =
        currentUsername && currentUsername.length
          ? new RegExp(`@${currentUsername}\\b`, "i")
          : null;
      const mentionsCurrentUser =
        mentionPattern && mentionPattern.test(rawMessage || "");

      const threadParentId =
        Number(msg.thread_parent_id ?? msg.threadParentId) || null;

      const documentHidden =
        typeof document !== "undefined" ? document.hidden : false;

      const shouldNotify =
        channelId !== activeChannelIdCurrent ||
        mentionsCurrentUser ||
        documentHidden;

      if (!shouldNotify) {
        return;
      }

      let type = "message";
      if (mentionsCurrentUser) {
        type = "mention";
      } else if (isDMChannel) {
        type = "dm";
      }

      const preferences = notificationPreferencesRef.current || DEFAULT_NOTIFICATION_PREFERENCES;
      const preferenceKey = getPreferenceKeyForNotification(type);
      if (preferences[preferenceKey] === false) {
        return;
      }

      const shouldPlaySound = preferences.sound !== false;

      const title = isDMChannel
        ? authorUsername
          ? `Message from ${authorUsername}`
          : "New direct message"
        : channelInfo?.displayName
        ? `New message in ${channelInfo.displayName}`
        : "New channel message";

      dispatch(
        addNotification({
          type,
          title,
          message: normalizedMessage.slice(0, 140),
          channelId,
          messageId: msg.id ?? null,
          read: channelId === activeChannelIdCurrent && !documentHidden,
          data: {
            channelName: channelInfo?.displayName ?? channelInfo?.name ?? null,
            authorId,
            authorUsername,
            threadRootId: threadParentId,
            isDM: Boolean(isDMChannel),
          },
        })
      );

      if (shouldPlaySound && playNotificationSound) {
        playNotificationSound();
      }
    });

    socketRef.current.on("typing:start", ({ channelId, user: typingUser }) => {
      if (!typingUser || channelId == null) return;
      const channelKey = String(channelId);
      setTyping((prev) => {
        const channelTyping = { ...(prev[channelKey] || {}) };
        channelTyping[typingUser.id] = typingUser;
        return { ...prev, [channelKey]: channelTyping };
      });
    });

    socketRef.current.on("typing:stop", ({ channelId, userId }) => {
      if (channelId == null || userId == null) return;
      const channelKey = String(channelId);
      setTyping((prev) => {
        if (!prev[channelKey]) return prev;
        const channelTyping = { ...prev[channelKey] };
        delete channelTyping[userId];
        return { ...prev, [channelKey]: channelTyping };
      });
    });

    socketRef.current.on("message:edit", (msg) => {
      dispatch(
        applyIncomingMessageUpdate({
          ...msg,
          status: "sent",
        })
      );
    });

    socketRef.current.on("message:delete", (payload) => {
      if (!payload) return;
      dispatch(removeMessage(payload));
    });

    socketRef.current.on("messages:read", (payload) => {
      if (!payload || !payload.channelId || !payload.messageIds || !payload.readBy) {
        return;
      }
      dispatch(
        updateMessageReadStatus({
          channelId: payload.channelId,
          messageIds: Array.isArray(payload.messageIds) ? payload.messageIds : [payload.messageIds],
          readBy: payload.readBy,
        })
      );
    });

    // Set up message:reaction listener for new socket
    setupReactionListener(socketRef.current);

    socketRef.current.on("call:started", ({ channelId, startedBy, callType }) => {
      const channelIdNum = Number(channelId);
      const currentUser = userRef.current;
      const currentlyInCall = isInCallRef.current;
      const activeChannelIdCurrent = activeChannelIdRef.current;
      const channelInfo = channelsByIdRef.current[channelIdNum];
      const documentHidden =
        typeof document !== "undefined" ? document.hidden : false;

      if (
        !currentlyInCall &&
        joinedChannelIdsRef.current.has(channelIdNum) &&
        currentUser?.id !== startedBy?.id
      ) {
        dispatch(setIncomingCall({ channelId: channelIdNum, startedBy, callType }));
      }
      dispatch(setActiveCall({ channelId: channelIdNum, startedBy, callType }));

      if (
        joinedChannelIdsRef.current.has(channelIdNum) &&
        currentUser?.id !== startedBy?.id &&
        (channelIdNum !== activeChannelIdCurrent || currentlyInCall || documentHidden)
      ) {
        const preferences = notificationPreferencesRef.current || DEFAULT_NOTIFICATION_PREFERENCES;
        if (preferences.call === false) {
          return;
        }
        dispatch(
          addNotification({
            type: "call",
            title: channelInfo?.displayName
              ? `Call started in ${channelInfo.displayName}`
              : "Call started",
            message: startedBy?.username
              ? `${startedBy.username} started a ${callType || "call"}`
              : "A call has started",
            channelId: channelIdNum,
            read: channelIdNum === activeChannelIdCurrent && !documentHidden,
            data: {
              channelName: channelInfo?.displayName ?? channelInfo?.name ?? null,
              callType: callType || "video",
              startedBy,
            },
          })
        );

        if (preferences.sound !== false && playNotificationSound) {
          playNotificationSound();
        }
      }
    });

    socketRef.current.on("call:ended", ({ channelId }) => {
      const channelIdNum = Number(channelId);
      dispatch(removeActiveCall(channelIdNum));
      const currentIncomingCall = incomingCallRef.current;
      if (currentIncomingCall?.channelId === channelIdNum) {
        dispatch(clearIncomingCall());
      }
      const currentCallChannelId = callChannelIdRef?.current;
      const currentlyInCall = isInCallRef.current;
      const hasLocalStream = Boolean(localStreamRef?.current);
      if (
        currentCallChannelId != null &&
        String(currentCallChannelId) === String(channelIdNum) &&
        currentlyInCall &&
        hasLocalStream
      ) {
        dispatch(endCall(channelIdNum));
      }
    });

    socketRef.current.on("user:online", ({ userId }) => {
      if (userId) {
        dispatch(setUserOnline(userId));
      }
    });

    socketRef.current.on("user:offline", ({ userId }) => {
      if (userId) {
        dispatch(setUserOffline(userId));
      }
    });

    socketRef.current.on("users:online", (onlineUserIds) => {
      if (Array.isArray(onlineUserIds)) {
        dispatch(setOnlineUsers(onlineUserIds));
      }
    });

    // Listen for new channel creation (especially for DM channels)
    socketRef.current.on("channel:created", ({ channel, memberIds, userId }) => {
      const currentUser = userRef.current;
      // Only add channel if this event is for the current user
      // Check both userId (if provided) and memberIds array
      const isForCurrentUser = 
        (userId && userId === currentUser?.id) ||
        (currentUser?.id && channel && Array.isArray(memberIds) && memberIds.includes(currentUser.id));
      
      if (isForCurrentUser) {
        dispatch(addChannel(channel));
        
        // Update refs to mark channel as joined
        if (channel.id) {
          channelsByIdRef.current[channel.id] = channel;
          joinedChannelIdsRef.current.add(channel.id);
        }
      }
    });

    // Listen for when a user is added to a channel (invited by owner)
    socketRef.current.on("member:added_to_channel", ({ channel, userId }) => {
      const currentUser = userRef.current;
      // Only add channel if this event is for the current user
      if (currentUser?.id && channel && userId === currentUser.id) {
        // Sanitize channel data to ensure it's not misidentified as a DM
        const sanitizedChannel = {
          ...channel,
          // Ensure name is always present and is a string
          name: channel.name || "",
          // Ensure topic is a string (empty if null)
          topic: channel.topic != null ? String(channel.topic) : "",
          // Ensure is_private is a number
          is_private: channel.is_private != null ? Number(channel.is_private) : 0,
        };
        
        // If channel has a name AND is NOT private, ensure topic doesn't have DM metadata
        // For private channels (DMs), we need to keep the topic metadata to identify participants
        if (sanitizedChannel.name && sanitizedChannel.name.trim() !== "" && sanitizedChannel.is_private === 0) {
          try {
            if (sanitizedChannel.topic) {
              const parsed = JSON.parse(sanitizedChannel.topic);
              if (parsed && parsed.type === "dm") {
                // Topic incorrectly has DM metadata for a non-private channel - clear it
                sanitizedChannel.topic = "";
              }
            }
          } catch (e) {
            // Topic is not valid JSON, which is fine for regular channels
            // Keep it as is
          }
        }
        
        dispatch(addChannel(sanitizedChannel));
        
        // Update refs to mark channel as joined
        if (sanitizedChannel.id) {
          channelsByIdRef.current[sanitizedChannel.id] = sanitizedChannel;
          joinedChannelIdsRef.current.add(sanitizedChannel.id);
        }
      }
    });

    // Listen for when a user leaves a channel
    socketRef.current.on("member:left_channel", ({ channelId, userId }) => {
      const currentUser = userRef.current;
      const activeChannelIdCurrent = activeChannelIdRef.current;
      
      // Only update if this is for a channel we're currently viewing
      // and it's not the current user leaving (they'll be handled by leaveChannel action)
      if (channelId && userId && currentUser?.id && userId !== currentUser.id) {
        // Remove the member from the member list
        dispatch(removeMemberFromChannel({ channelId, userId }));
      }
    });

    // Listen for channel updates (name, topic, privacy changes)
    socketRef.current.on("channel:updated", ({ channel, userId }) => {
      const currentUser = userRef.current;
      // Only update if this event is for the current user
      if (currentUser?.id && channel && userId === currentUser.id) {
        // Sanitize channel data to prevent DM misidentification
        const sanitizedChannel = {
          ...channel,
          name: channel.name || "",
          topic: channel.topic != null ? String(channel.topic) : "",
          is_private: channel.is_private != null ? Number(channel.is_private) : 0,
        };
        
        // If channel has a name, ensure topic doesn't have DM metadata
        if (sanitizedChannel.name && sanitizedChannel.name.trim() !== "") {
          try {
            if (sanitizedChannel.topic) {
              const parsed = JSON.parse(sanitizedChannel.topic);
              if (parsed && parsed.type === "dm") {
                // Topic incorrectly has DM metadata - clear it
                sanitizedChannel.topic = "";
              }
            }
          } catch (e) {
            // Topic is not valid JSON, which is fine for regular channels
          }
        }
        
        dispatch(updateChannelFromSocket(sanitizedChannel));
        
        // Update refs
        if (sanitizedChannel.id) {
          channelsByIdRef.current[sanitizedChannel.id] = sanitizedChannel;
        }
      }
    });

    // Listen for ownership transfer events
    socketRef.current.on("channel:ownership_transferred", ({ channelId, newOwnerId, userId }) => {
      const currentUser = userRef.current;
      const activeChannelIdCurrent = activeChannelIdRef.current;
      // Only process if this event is for the current user
      if (currentUser?.id && channelId && userId === currentUser.id) {
        // If the current user is the new owner, update their role in the channel
        if (newOwnerId === currentUser.id) {
          const channel = channelsByIdRef.current[channelId];
          if (channel) {
            const updatedChannel = {
              ...channel,
              role: "owner",
            };
            dispatch(updateChannelFromSocket(updatedChannel));
            channelsByIdRef.current[channelId] = updatedChannel;
          }
        }
        // Refetch channel members to update roles if this is the active channel
        if (channelId === activeChannelIdCurrent && tokenRef?.current) {
          dispatch(fetchChannelMembers({ token: tokenRef.current, channelId }));
        }
      }
    });

    return () => {
      socketRef.current?.off("receive_message");
      socketRef.current?.off("typing:start");
      socketRef.current?.off("typing:stop");
      socketRef.current?.off("message:edit");
      socketRef.current?.off("message:delete");
      socketRef.current?.off("messages:read");
      socketRef.current?.off("message:reaction");
      socketRef.current?.off("call:started");
      socketRef.current?.off("call:ended");
      socketRef.current?.off("user:online");
      socketRef.current?.off("user:offline");
      socketRef.current?.off("users:online");
      socketRef.current?.off("channel:created");
      socketRef.current?.off("member:added_to_channel");
      socketRef.current?.off("member:left_channel");
      socketRef.current?.off("channel:updated");
      socketRef.current?.off("channel:ownership_transferred");
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [dispatch, user, channelsByIdRef, joinedChannelIdsRef, userRef, activeChannelIdRef, isInCallRef, callChannelIdRef, incomingCallRef, activeThreadIdRef, notificationPreferencesRef, playNotificationSound, setTypingUsers, socketRef, tokenRef]);

  useEffect(() => {
    if (isAuthenticated && user && socketRef.current) {
      if (socketRef.current.connected) {
        socketRef.current.emit("user:online", {
          userId: user.id,
          user: { id: user.id, username: user.username },
        });
      } else {
        socketRef.current.once("connect", () => {
          socketRef.current.emit("user:online", {
            userId: user.id,
            user: { id: user.id, username: user.username },
          });
        });
      }
    }
  }, [isAuthenticated, user, socketRef]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, [socketRef]);

  return {
    socket: socketRef.current,
    socketRef,
    isConnected,
    emit,
  };
}

