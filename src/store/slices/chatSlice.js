// store/slices/chatSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { leaveChannel } from "./channelSlice";

const resolveChannelId = (value) => {
  if (!value && value !== 0) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// Async thunk to fetch messages for a channel
export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async ({ token, channelId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/messages?channelId=${channelId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        
        return { channelId, messages: Array.isArray(data) ? data : [] };
      }
      const errorData = await res.json().catch(() => ({}));
      return rejectWithValue(errorData.error || "Failed to fetch messages");
    } catch (error) {
      return rejectWithValue("Network error occurred");
    }
  }
);

// Async thunk to send message to a channel
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ message, attachment, token, clientId, channelId, threadParentId, mentions = [], messageType }, { rejectWithValue }) => {
    try {
      const payload = {
        message: typeof message === "string" ? message.trim() : "",
        attachment: attachment || null,
        clientId: clientId || null,
        channelId,
        threadParentId: threadParentId || null,
        mentions,
        messageType: messageType || null, // For system messages like call_started, call_ended
      };

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const messageData = await res.json();
        return {
          ...messageData,
          clientId: messageData.clientId || clientId || null,
          channel_id: messageData.channel_id || channelId,
        };
      }
      const errorData = await res.json().catch(() => ({}));
      return rejectWithValue(errorData.error || "Failed to send message");
    } catch (error) {
      return rejectWithValue("Network error. Please try again.");
    }
  }
);

export const updateMessage = createAsyncThunk(
  "chat/updateMessage",
  async ({ token, messageId, message, attachment = null, removeAttachment = false }, { rejectWithValue }) => {
    try {
      const trimmed = typeof message === "string" ? message.trim() : "";
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: trimmed, attachment, removeAttachment }),
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
      const errorData = await res.json().catch(() => ({}));
      return rejectWithValue(errorData.error || "Failed to update message");
    } catch (error) {
      return rejectWithValue("Network error while updating message");
    }
  }
);

// Async thunk to mark messages as read
export const markMessagesAsRead = createAsyncThunk(
  "chat/markMessagesAsRead",
  async ({ token, channelId, messageIds, currentUserId }, { rejectWithValue }) => {
    try {
      const res = await fetch("/api/messages/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageIds, channelId }),
      });

      if (res.ok) {
        const data = await res.json();
        return { channelId, messageIds, markedCount: data.markedCount, currentUserId };
      }
      const errorData = await res.json().catch(() => ({}));
      return rejectWithValue(errorData.error || "Failed to mark messages as read");
    } catch (error) {
      return rejectWithValue("Network error while marking messages as read");
    }
  }
);

export const clearChat = createAsyncThunk(
  "chat/clearChat",
  async ({ token, channelId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/clear`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return { channelId, clearedAt: data.clearedAt };
      }
      const errorData = await res.json().catch(() => ({}));
      return rejectWithValue(errorData.error || "Failed to clear chat");
    } catch (error) {
      return rejectWithValue("Network error while clearing chat");
    }
  }
);

export const deleteMessage = createAsyncThunk(
  "chat/deleteMessage",
  async ({ token, messageId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
      const errorData = await res.json().catch(() => ({}));
      return rejectWithValue(errorData.error || "Failed to delete message");
    } catch (error) {
      return rejectWithValue("Network error while deleting message");
    }
  }
);

const ensureChannelBucket = (state, channelId) => {
  const key = String(channelId);
  if (!state.messagesByChannel[key]) {
    state.messagesByChannel[key] = [];
  }
  return key;
};

const upsertMessage = (state, message, status = "sent") => {
  if (!message) return;

  const channelId =
    resolveChannelId(message.channel_id) ??
    resolveChannelId(message.channelId) ??
    resolveChannelId(message.channel);
  if (!channelId) return;

  const channelKey = ensureChannelBucket(state, channelId);

  const normalizedMessage = {
    ...message,
    channel_id: channelId,
    status: status || message.status || "sent",
    mentions: Array.isArray(message.mentions) ? message.mentions : [],
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    // Preserve wasDelivered flag if it exists
    wasDelivered: message.wasDelivered !== undefined ? message.wasDelivered : false,
  };

  const clientId = normalizedMessage.clientId;
  const id = normalizedMessage.id;

  const messages = state.messagesByChannel[channelKey];
  let index = -1;

  if (clientId) {
    index = messages.findIndex((m) => m.clientId === clientId);
  }

  if (index === -1 && typeof id !== "undefined" && id !== null) {
    index = messages.findIndex((m) => m.id === id);
  }

  if (index !== -1) {
    messages[index] = {
      ...messages[index],
      ...normalizedMessage,
    };
  } else {
    messages.push(normalizedMessage);
  }
};

const removeMessageFromChannel = (state, channelId, messageId) => {
  const key = String(channelId);
  const messages = state.messagesByChannel[key];
  if (!Array.isArray(messages)) return;
  state.messagesByChannel[key] = messages.filter(
    (msg) => msg.id !== messageId && msg.thread_parent_id !== messageId
  );
};

const initialState = {
  messagesByChannel: {},
  channelLoading: {},
  error: null,
  sendingMessage: false,
  loadedChannels: {},
  updatingMessageId: null,
  deletingMessageId: null,
  unreadCountsByChannel: {}, // { channelId: count }
  lastReadTimestampByChannel: {}, // { channelId: timestamp }
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addPendingMessage: (state, action) => {
      const pending = {
        ...action.payload,
        status: action.payload?.status || "pending",
        mentions: Array.isArray(action.payload?.mentions) ? action.payload.mentions : [],
      };
      if (!pending.clientId) {
        pending.clientId = pending.id || `temp-${Date.now()}`;
      }
      upsertMessage(state, pending, pending.status);
    },
    receiveMessage: (state, action) => {
      upsertMessage(state, action.payload, "sent");
    },
    markMessageFailed: (state, action) => {
      const { clientId, channelId } = action.payload;
      if (!clientId) return;
      const resolvedChannelId = resolveChannelId(channelId);
      if (!resolvedChannelId) return;
      const key = String(resolvedChannelId);
      const channelMessages = state.messagesByChannel[key];
      if (!channelMessages) return;
      const index = channelMessages.findIndex((m) => m.clientId === clientId);
      if (index !== -1) {
        channelMessages[index] = {
          ...channelMessages[index],
          status: "failed",
        };
      }
    },
    clearMessages: (state) => {
      state.messagesByChannel = {};
      state.loadedChannels = {};
      state.unreadCountsByChannel = {};
      state.lastReadTimestampByChannel = {};
    },
    markChannelAsRead: (state, action) => {
      const channelId = resolveChannelId(action.payload);
      if (channelId == null) return;
      const channelKey = String(channelId);
      
      // Get the most recent message timestamp, or use current time if no messages
      const messages = state.messagesByChannel[channelKey] || [];
      let lastReadTimestamp = Date.now();
      
      if (messages.length > 0) {
        // Find the most recent message timestamp
        const timestamps = messages
          .map((msg) => {
            if (!msg.created_at) return null;
            return new Date(msg.created_at).getTime();
          })
          .filter((ts) => ts != null);
        
        if (timestamps.length > 0) {
          // Set to the most recent message timestamp
          // This ensures all existing messages are marked as read
          // and only new messages after this will be unread
          lastReadTimestamp = Math.max(...timestamps);
        }
      }
      
      // Reset unread count and update last read timestamp
      state.unreadCountsByChannel[channelKey] = 0;
      state.lastReadTimestampByChannel[channelKey] = lastReadTimestamp;
    },
    setChannelLastReadTimestamp: (state, action) => {
      const { channelId, timestamp } = action.payload;
      const resolvedChannelId = resolveChannelId(channelId);
      if (resolvedChannelId == null || timestamp == null) return;
      const channelKey = String(resolvedChannelId);
      state.lastReadTimestampByChannel[channelKey] = timestamp;
    },
    incrementUnreadCount: (state, action) => {
      const channelId = resolveChannelId(action.payload);
      if (channelId == null) return;
      const channelKey = String(channelId);
      state.unreadCountsByChannel[channelKey] = (state.unreadCountsByChannel[channelKey] || 0) + 1;
    },
    clearChatError: (state) => {
      state.error = null;
    },
    applyIncomingMessageUpdate: (state, action) => {
      upsertMessage(state, action.payload, "sent");
    },
    removeMessage: (state, action) => {
      const { channelId, id } = action.payload || {};
      const resolvedChannelId = resolveChannelId(channelId);
      if (!resolvedChannelId || id == null) return;
      removeMessageFromChannel(state, resolvedChannelId, id);
    },
    updateMessageReadStatus: (state, action) => {
      const { channelId, messageIds, readBy } = action.payload;
      const resolvedChannelId = resolveChannelId(channelId);
      if (!resolvedChannelId) return;
      const channelKey = String(resolvedChannelId);
      const messages = state.messagesByChannel[channelKey] || [];

      // Update read status for messages
      messages.forEach((msg) => {
        if (messageIds.includes(msg.id)) {
          if (!msg.readBy) {
            msg.readBy = [];
          }
          // Add user to readBy if not already present
          if (readBy && !msg.readBy.includes(readBy)) {
            msg.readBy = [...msg.readBy, readBy];
          }
          // Mark as delivered since it was read
          msg.wasDelivered = true;
        }
      });
    },
    markMessageAsDelivered: (state, action) => {
      const { channelId, messageIds } = action.payload;
      const resolvedChannelId = resolveChannelId(channelId);
      if (!resolvedChannelId) return;
      const channelKey = String(resolvedChannelId);
      const messages = state.messagesByChannel[channelKey] || [];

      // Mark messages as delivered (they showed 2 ticks)
      messages.forEach((msg) => {
        if (messageIds.includes(msg.id)) {
          msg.wasDelivered = true;
        }
      });
    },
    updateMessageReaction: (state, action) => {
      const { messageId, channelId, emoji, action: reactionAction, user, currentUserId } = action.payload;
      const resolvedChannelId = resolveChannelId(channelId);
      if (!resolvedChannelId || !messageId) {
        console.warn("updateMessageReaction: Invalid payload", { messageId, channelId, resolvedChannelId });
        return;
      }

      const channelKey = String(resolvedChannelId);
      // Ensure channel bucket exists
      if (!state.messagesByChannel[channelKey]) {
        state.messagesByChannel[channelKey] = [];
      }
      
      const messages = state.messagesByChannel[channelKey];
      if (!Array.isArray(messages)) {
        console.warn("updateMessageReaction: Messages array not found for channel", channelKey);
        return;
      }

      // Compare message IDs as both numbers and strings to handle type mismatches
      const messageIndex = messages.findIndex((m) => {
        const mId = m.id;
        const msgId = messageId;
        return mId === msgId || String(mId) === String(msgId) || Number(mId) === Number(msgId);
      });
      
      if (messageIndex === -1) {
        console.warn("updateMessageReaction: Message not found", { 
          messageId, 
          messageIdType: typeof messageId,
          channelKey, 
          messageCount: messages.length,
          availableMessageIds: messages.map(m => ({ id: m.id, type: typeof m.id })).slice(0, 5)
        });
        return;
      }
      

      const message = messages[messageIndex];
      const reactions = Array.isArray(message.reactions) ? [...message.reactions] : [];

      if (reactionAction === "added") {
        // Find or create reaction group for this emoji
        let reactionGroup = reactions.find((r) => r.emoji === emoji);
        if (!reactionGroup) {
          reactionGroup = { emoji, count: 0, users: [] };
          reactions.push(reactionGroup);
        }
        // Check if user already in the list
        const userExists = reactionGroup.users.some((u) => u.id === user?.id);
        if (!userExists && user) {
          const isCurrentUser = currentUserId != null ? user.id === currentUserId : user.isCurrentUser;
          reactionGroup.users.push({
            id: user.id,
            username: user.username,
            isCurrentUser: Boolean(isCurrentUser),
          });
          reactionGroup.count++;
        }
      } else if (reactionAction === "removed") {
        // Remove user from reaction group
        const reactionGroup = reactions.find((r) => r.emoji === emoji);
        if (reactionGroup) {
          reactionGroup.users = reactionGroup.users.filter((u) => u.id !== user?.id);
          reactionGroup.count = reactionGroup.users.length;
          // Remove reaction group if empty
          if (reactionGroup.count === 0) {
            const groupIndex = reactions.findIndex((r) => r.emoji === emoji);
            if (groupIndex !== -1) {
              reactions.splice(groupIndex, 1);
            }
          }
        }
      }

      // Create new array with updated message to ensure React re-renders
      // IMPORTANT: Create a completely new array and new object to trigger React re-render
      const updatedMessages = messages.map((msg, idx) => {
        if (idx === messageIndex) {
          // Create a completely new message object with updated reactions
          return {
            ...msg,
            reactions: [...reactions],
          };
        }
        return msg;
      });
      
      // Create a new messagesByChannel object to ensure useMemo detects the change
      state.messagesByChannel = {
        ...state.messagesByChannel,
        [channelKey]: updatedMessages,
      };
      
   
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        const channelId = resolveChannelId(action.meta?.arg?.channelId);
        if (!channelId) return;
        state.channelLoading[channelId] = true;
        state.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const channelId = resolveChannelId(action.payload.channelId);
        if (!channelId) return;
        const channelKey = ensureChannelBucket(state, channelId);
        state.channelLoading[channelId] = false;
        state.loadedChannels[channelId] = true;
        state.messagesByChannel[channelKey] = action.payload.messages.map((msg) => ({
          ...msg,
          channel_id: msg.channel_id || channelId,
          status: msg.status || "sent",
          reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
          readBy: Array.isArray(msg.readBy) ? msg.readBy : [],
          allRecipientsRead: msg.allRecipientsRead || false,
          // If message has readBy entries, it was delivered
          wasDelivered: (Array.isArray(msg.readBy) && msg.readBy.length > 0) || msg.wasDelivered || false,
        }));
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const channelId = resolveChannelId(action.meta?.arg?.channelId);
        if (channelId) {
          state.channelLoading[channelId] = false;
        }
        state.error = action.payload;
      })
      .addCase(sendMessage.pending, (state) => {
        state.sendingMessage = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sendingMessage = false;
        upsertMessage(state, action.payload, "sent");
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sendingMessage = false;
        state.error = action.payload;
        const clientId = action.meta?.arg?.clientId;
        const channelId = resolveChannelId(action.meta?.arg?.channelId);
        if (clientId && channelId) {
          const key = String(channelId);
          const channelMessages = state.messagesByChannel[key];
          if (channelMessages) {
            const index = channelMessages.findIndex((m) => m.clientId === clientId);
            if (index !== -1) {
              channelMessages[index] = {
                ...channelMessages[index],
                status: "failed",
              };
            }
          }
        }
      })
      .addCase(updateMessage.pending, (state, action) => {
        state.updatingMessageId = action.meta?.arg?.messageId ?? null;
        state.error = null;
      })
      .addCase(updateMessage.fulfilled, (state, action) => {
        state.updatingMessageId = null;
        upsertMessage(state, action.payload, "sent");
      })
      .addCase(updateMessage.rejected, (state, action) => {
        state.updatingMessageId = null;
        state.error = action.payload;
      })
      .addCase(deleteMessage.pending, (state, action) => {
        state.deletingMessageId = action.meta?.arg?.messageId ?? null;
        state.error = null;
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        state.deletingMessageId = null;
        const resolvedChannelId = resolveChannelId(action.payload.channelId);
        if (!resolvedChannelId) return;
        removeMessageFromChannel(state, resolvedChannelId, action.payload.id);
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.deletingMessageId = null;
        state.error = action.payload;
      })
      .addCase(clearChat.pending, (state) => {
        state.error = null;
      })
      .addCase(clearChat.fulfilled, (state, action) => {
        const channelId = resolveChannelId(action.payload.channelId);
        if (!channelId) return;
        const channelKey = String(channelId);
        // Clear all messages for this channel
        state.messagesByChannel[channelKey] = [];
        // Mark channel as needing reload
        delete state.loadedChannels[channelId];
      })
      .addCase(markMessagesAsRead.fulfilled, (state, action) => {
        const channelId = resolveChannelId(action.payload.channelId);
        if (!channelId) return;
        const channelKey = String(channelId);
        const messages = state.messagesByChannel[channelKey] || [];
        const { messageIds, currentUserId } = action.payload;

        // Update read status for messages
        messages.forEach((msg) => {
          if (messageIds.includes(msg.id)) {
            if (!msg.readBy) {
              msg.readBy = [];
            }
            // Add current user to readBy if not already present
            if (currentUserId && !msg.readBy.includes(currentUserId)) {
              msg.readBy = [...msg.readBy, currentUserId];
            }
            // Mark as delivered since it was read
            msg.wasDelivered = true;
          }
        });
      })
      .addCase(clearChat.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(leaveChannel.fulfilled, (state, action) => {
        const { channelId } = action.payload;
        if (channelId != null) {
          delete state.messagesByChannel[String(channelId)];
          delete state.channelLoading?.[channelId];
          delete state.loadedChannels?.[channelId];
        }
      });
  },
});

export const {
  addPendingMessage,
  receiveMessage,
  markMessageFailed,
  clearMessages,
  clearChatError,
  applyIncomingMessageUpdate,
  removeMessage,
  updateMessageReadStatus,
  markMessageAsDelivered,
  updateMessageReaction,
  markChannelAsRead,
  incrementUnreadCount,
  setChannelLastReadTimestamp,
} = chatSlice.actions;

export default chatSlice.reducer;

