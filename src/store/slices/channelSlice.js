import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchChannels = createAsyncThunk(
  "channels/fetchChannels",
  async (token, { rejectWithValue }) => {
    try {
      const res = await fetch("/api/channels", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to load channels");
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return rejectWithValue("Network error while fetching channels");
    }
  }
);

export const createChannel = createAsyncThunk(
  "channels/createChannel",
  async ({ token, name, topic = "", isPrivate = false, memberIds = [] }, { rejectWithValue }) => {
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, topic, isPrivate, memberIds }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to create channel");
      }

      const channel = await res.json();
      return channel;
    } catch (error) {
      return rejectWithValue("Network error while creating channel");
    }
  }
);

// Create a DM (Direct Message) - a private channel with exactly 2 members
export const createDM = createAsyncThunk(
  "channels/createDM",
  async ({ token, userId, username }, { rejectWithValue, getState }) => {
    try {
      const state = getState();
      const currentUser = state?.auth?.user;

      if (!currentUser?.id || !currentUser?.username) {
        return rejectWithValue("Unable to resolve current user for DM creation");
      }

      const dmMetadata = {
        type: "dm",
        participants: [
          { id: currentUser.id, username: currentUser.username },
          { id: userId, username },
        ],
      };

      const targetName = username || "Direct Message";

      const res = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: targetName,
          topic: JSON.stringify(dmMetadata),
          isPrivate: true,
          memberIds: [userId],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to create DM");
      }

      const channel = await res.json();
      return channel;
    } catch (error) {
      return rejectWithValue("Network error while creating DM");
    }
  }
);

export const searchUsers = createAsyncThunk(
  "channels/searchUsers",
  async ({ token, query }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to search users");
      }

      const users = await res.json();
      return Array.isArray(users) ? users : [];
    } catch (error) {
      return rejectWithValue("Network error while searching users");
    }
  }
);

export const fetchChannelMembers = createAsyncThunk(
  "channels/fetchChannelMembers",
  async ({ token, channelId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to load members");
      }

      const members = await res.json();
      return { channelId, members: Array.isArray(members) ? members : [] };
    } catch (error) {
      return rejectWithValue("Network error while loading members");
    }
  }
);

export const updateChannel = createAsyncThunk(
  "channels/updateChannel",
  async ({ token, channelId, name, topic, isPrivate }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/channels/${channelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, topic, isPrivate }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to update channel");
      }

      const channel = await res.json();
      return channel;
    } catch (error) {
      return rejectWithValue("Network error while updating channel");
    }
  }
);

export const leaveChannel = createAsyncThunk(
  "channels/leaveChannel",
  async ({ token, channelId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members/me`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to leave channel");
      }

      return { channelId };
    } catch (error) {
      return rejectWithValue("Network error while leaving channel");
    }
  }
);

export const removeChannelMember = createAsyncThunk(
  "channels/removeChannelMember",
  async ({ token, channelId, userId }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to remove member");
      }

      const data = await res.json().catch(() => ({ channelId, userId }));
      return { channelId: data.channelId ?? channelId, userId: data.userId ?? userId };
    } catch (error) {
      return rejectWithValue("Network error while removing member");
    }
  }
);

export const addChannelMembers = createAsyncThunk(
  "channels/addChannelMembers",
  async ({ token, channelId, memberIds }, { rejectWithValue }) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ memberIds }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return rejectWithValue(errorData.error || "Failed to add members");
      }

      const members = await res.json();
      return { channelId, members: Array.isArray(members) ? members : [] };
    } catch (error) {
      return rejectWithValue("Network error while adding members");
    }
  }
);

const initialState = {
  channels: [],
  activeChannelId: null,
  isLoading: false,
  error: null,
  creating: false,
  availableUsers: [],
  findingUsers: false,
  userSearchError: null,
  selectedMemberIds: [],
  membersByChannel: {},
  membersLoading: {},
  membersError: null,
  updatingChannel: false,
  updateError: null,
  leavingChannelId: null,
  removingMember: null,
  addingMembers: false,
  addMembersError: null,
};

const channelSlice = createSlice({
  name: "channels",
  initialState,
  reducers: {
    setActiveChannel: (state, action) => {
      state.activeChannelId = action.payload;
    },
    clearChannelError: (state) => {
      state.error = null;
      state.updateError = null;
      state.userSearchError = null;
      state.membersError = null;
      state.addMembersError = null;
    },
    setSelectedMemberIds: (state, action) => {
      state.selectedMemberIds = Array.isArray(action.payload)
        ? action.payload
        : [];
    },
    addSelectedMember: (state, action) => {
      const id = action.payload;
      if (id == null) return;
      if (!state.selectedMemberIds.includes(id)) {
        state.selectedMemberIds.push(id);
      }
    },
    removeSelectedMember: (state, action) => {
      const id = action.payload;
      state.selectedMemberIds = state.selectedMemberIds.filter((mid) => mid !== id);
    },
    resetSelectedMembers: (state) => {
      state.selectedMemberIds = [];
    },
    addChannel: (state, action) => {
      const channel = action.payload;
      if (!channel || !channel.id) return;
      
      // Sanitize channel data to prevent DM misidentification
      const sanitizedChannel = {
        ...channel,
        name: channel.name || "",
        topic: channel.topic != null ? String(channel.topic) : "",
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
        }
      }
      
      // Check if channel already exists
      const exists = state.channels.some((c) => c.id === sanitizedChannel.id);
      if (!exists) {
        state.channels.push(sanitizedChannel);
      } else {
        // Update existing channel with sanitized data
        const index = state.channels.findIndex((c) => c.id === sanitizedChannel.id);
        if (index !== -1) {
          state.channels[index] = sanitizedChannel;
        }
      }
    },
    removeMemberFromChannel: (state, action) => {
      const { channelId, userId } = action.payload;
      if (!channelId || !userId) return;
      
      const members = state.membersByChannel[channelId];
      if (Array.isArray(members)) {
        state.membersByChannel[channelId] = members.filter((member) => member.id !== userId);
      }
    },
    updateChannelFromSocket: (state, action) => {
      const channel = action.payload;
      if (!channel || !channel.id) return;
      
      const index = state.channels.findIndex((c) => c.id === channel.id);
      if (index !== -1) {
        // Update existing channel
        state.channels[index] = {
          ...state.channels[index],
          ...channel,
        };
      } else {
        // Channel doesn't exist yet, add it
        state.channels.push(channel);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChannels.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChannels.fulfilled, (state, action) => {
        state.isLoading = false;
        state.channels = action.payload;
        if (!state.activeChannelId && action.payload.length > 0) {
          state.activeChannelId = action.payload[0].id;
        }
      })
      .addCase(fetchChannels.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createChannel.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.creating = false;
        state.channels.push(action.payload);
        state.activeChannelId = action.payload.id;
        state.selectedMemberIds = [];
      })
      .addCase(createChannel.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })
      .addCase(createDM.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createDM.fulfilled, (state, action) => {
        state.creating = false;
        // Check if DM already exists (same private channel with same member)
        const existingDM = state.channels.find(
          (c) => c.id === action.payload.id || 
          (c.is_private && c.name === action.payload.name)
        );
        if (!existingDM) {
          state.channels.push(action.payload);
        }
        state.activeChannelId = action.payload.id;
      })
      .addCase(createDM.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })
      .addCase(searchUsers.pending, (state) => {
        state.findingUsers = true;
        state.userSearchError = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.findingUsers = false;
        state.availableUsers = action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.findingUsers = false;
        state.userSearchError = action.payload;
      })
      .addCase(fetchChannelMembers.pending, (state, action) => {
        const channelId = action.meta?.arg?.channelId;
        if (channelId != null) {
          state.membersLoading[channelId] = true;
        }
        state.membersError = null;
      })
      .addCase(fetchChannelMembers.fulfilled, (state, action) => {
        const { channelId, members } = action.payload;
        state.membersLoading[channelId] = false;
        state.membersByChannel[channelId] = members;
      })
      .addCase(fetchChannelMembers.rejected, (state, action) => {
        const channelId = action.meta?.arg?.channelId;
        if (channelId != null) {
          state.membersLoading[channelId] = false;
        }
        state.membersError = action.payload;
      })
      .addCase(updateChannel.pending, (state) => {
        state.updatingChannel = true;
        state.updateError = null;
      })
      .addCase(updateChannel.fulfilled, (state, action) => {
        state.updatingChannel = false;
        const updated = action.payload;
        const index = state.channels.findIndex((c) => c.id === updated.id);
        if (index !== -1) {
          state.channels[index] = {
            ...state.channels[index],
            ...updated,
          };
        }
      })
      .addCase(updateChannel.rejected, (state, action) => {
        state.updatingChannel = false;
        state.updateError = action.payload;
      })
      .addCase(leaveChannel.pending, (state, action) => {
        state.leavingChannelId = action.meta?.arg?.channelId ?? null;
        state.error = null;
      })
      .addCase(leaveChannel.fulfilled, (state, action) => {
        state.leavingChannelId = null;
        const { channelId } = action.payload;
        state.channels = state.channels.filter((channel) => channel.id !== channelId);
        delete state.membersByChannel[channelId];
        delete state.membersLoading[channelId];
        if (state.activeChannelId === channelId) {
          state.activeChannelId = state.channels.length > 0 ? state.channels[0].id : null;
        }
      })
      .addCase(leaveChannel.rejected, (state, action) => {
        state.leavingChannelId = null;
        state.error = action.payload;
      })
      .addCase(removeChannelMember.pending, (state, action) => {
        const { userId } = action.meta.arg;
        state.removingMember = userId;
        state.membersError = null;
      })
      .addCase(removeChannelMember.fulfilled, (state, action) => {
        state.removingMember = null;
        const { channelId, userId } = action.payload;
        const members = state.membersByChannel[channelId];
        if (Array.isArray(members)) {
          state.membersByChannel[channelId] = members.filter((member) => member.id !== userId);
        }
      })
      .addCase(removeChannelMember.rejected, (state, action) => {
        state.removingMember = null;
        state.membersError = action.payload;
      })
      .addCase(addChannelMembers.pending, (state) => {
        state.addingMembers = true;
        state.addMembersError = null;
      })
      .addCase(addChannelMembers.fulfilled, (state, action) => {
        state.addingMembers = false;
        const { channelId, members } = action.payload;
        if (!Array.isArray(members) || members.length === 0) return;
        const existing = state.membersByChannel[channelId] || [];
        const existingIds = new Set(existing.map((member) => member.id));
        const merged = [...existing];
        members.forEach((member) => {
          if (!existingIds.has(member.id)) {
            merged.push(member);
          }
        });
        state.membersByChannel[channelId] = merged;
      })
      .addCase(addChannelMembers.rejected, (state, action) => {
        state.addingMembers = false;
        state.addMembersError = action.payload;
      });
  },
});

export const {
  setActiveChannel,
  clearChannelError,
  setSelectedMemberIds,
  addSelectedMember,
  removeSelectedMember,
  resetSelectedMembers,
  addChannel,
  removeMemberFromChannel,
  updateChannelFromSocket,
} = channelSlice.actions;

export default channelSlice.reducer;


