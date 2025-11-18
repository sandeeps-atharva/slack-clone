import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  // Call state
  isInCall: false,
  callChannelId: null,
  callType: null, // 'video' or 'audio'
  
  // Local media
  localStream: null,
  isLocalVideoEnabled: true,
  isLocalAudioEnabled: true,
  isScreenSharing: false,
  
  // Remote participants
  participants: {}, // { userId: { stream, user, connection } }
  
  // UI state
  showCallPanel: false,
  callError: null,
  
  // Connection state
  isConnecting: false,
  connectionError: null,
  
  // Active calls tracking (channels with ongoing calls)
  activeCalls: {}, // { channelId: { startedBy, callType, participantCount, startTime } }
  
  // Incoming call notification
  incomingCall: null, // { channelId, startedBy, callType }
  
  // Call start time tracking
  callStartTime: null, // Timestamp when current call started
  lastCallEnded: null, // { channelId, duration } - for system message
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    startCall: (state, action) => {
      const { channelId, callType } = action.payload;
      state.isInCall = true;
      state.callChannelId = channelId;
      state.callType = callType || "video";
      state.showCallPanel = true;
      state.callError = null;
      state.connectionError = null;
      state.participants = {};
      state.isLocalVideoEnabled = true;
      state.isLocalAudioEnabled = true;
      state.isScreenSharing = false;
      state.callStartTime = Date.now(); // Track when call started
    },
    
    endCall: (state, action) => {
      const expectedChannelId = action?.payload ?? null;
      if (expectedChannelId != null && state.callChannelId !== expectedChannelId) {
        return;
      }
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(state.participants || {}).forEach((participant) => {
        participant?.stream?.getTracks?.().forEach((track) => track.stop());
      });
      state.isInCall = false;
      const endedChannelId = state.callChannelId;
      const callDuration = state.callStartTime ? Date.now() - state.callStartTime : null;
      state.callChannelId = null;
      state.callType = null;
      state.showCallPanel = false;
      state.localStream = null;
      state.isLocalVideoEnabled = false;
      state.isLocalAudioEnabled = false;
      state.isScreenSharing = false;
      state.participants = {};
      state.callError = null;
      state.connectionError = null;
      state.isConnecting = false;
      state.callStartTime = null;
      // Store duration and channelId in state for system message
      state.lastCallEnded = { channelId: endedChannelId, duration: callDuration };
    },
    
    clearLastCallEnded: (state) => {
      state.lastCallEnded = null;
    },
    
    setLocalStream: (state, action) => {
      state.localStream = action.payload;
    },
    
    toggleLocalVideo: (state) => {
      state.isLocalVideoEnabled = !state.isLocalVideoEnabled;
      if (state.localStream) {
        const videoTrack = state.localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = state.isLocalVideoEnabled;
        }
      }
    },
    
    toggleLocalAudio: (state) => {
      state.isLocalAudioEnabled = !state.isLocalAudioEnabled;
      if (state.localStream) {
        const audioTrack = state.localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = state.isLocalAudioEnabled;
        }
      }
    },
    
    setScreenSharing: (state, action) => {
      state.isScreenSharing = action.payload;
    },
    
    addParticipant: (state, action) => {
      const { userId, user, stream } = action.payload;
      state.participants[userId] = {
        user,
        stream,
        videoEnabled: true,
        audioEnabled: true,
      };
    },
    
    removeParticipant: (state, action) => {
      const userId = action.payload;
      if (state.participants[userId]?.stream) {
        state.participants[userId].stream.getTracks().forEach((track) => track.stop());
      }
      delete state.participants[userId];
    },
    
    updateParticipantStream: (state, action) => {
      const { userId, stream } = action.payload;
      if (state.participants[userId]) {
        state.participants[userId].stream = stream;
      }
    },
    
    setCallError: (state, action) => {
      state.callError = action.payload;
    },
    
    clearCallError: (state) => {
      state.callError = null;
      state.connectionError = null;
    },
    
    setConnecting: (state, action) => {
      state.isConnecting = action.payload;
    },
    
    setConnectionError: (state, action) => {
      state.connectionError = action.payload;
      state.isConnecting = false;
    },
    
    toggleCallPanel: (state) => {
      state.showCallPanel = !state.showCallPanel;
    },

    openCallPanel: (state) => {
      if (state.isInCall) {
        state.showCallPanel = true;
      }
    },

    closeCallPanel: (state) => {
      state.showCallPanel = false;
    },
    
    setActiveCall: (state, action) => {
      const { channelId, startedBy, callType, participantCount } = action.payload;
      state.activeCalls[channelId] = {
        startedBy,
        callType: callType || "video",
        participantCount: participantCount || 0,
      };
    },
    
    removeActiveCall: (state, action) => {
      const channelId = action.payload;
      delete state.activeCalls[channelId];
    },
    
    updateActiveCallParticipants: (state, action) => {
      const { channelId, participantCount } = action.payload;
      if (state.activeCalls[channelId]) {
        state.activeCalls[channelId].participantCount = participantCount;
      }
    },
    
    setIncomingCall: (state, action) => {
      state.incomingCall = action.payload;
    },
    
    clearIncomingCall: (state) => {
      state.incomingCall = null;
    },
  },
});

export const {
  startCall,
  endCall,
  setLocalStream,
  toggleLocalVideo,
  toggleLocalAudio,
  setScreenSharing,
  addParticipant,
  removeParticipant,
  updateParticipantStream,
  setCallError,
  clearCallError,
  setConnecting,
  setConnectionError,
  toggleCallPanel,
  openCallPanel,
  closeCallPanel,
  setActiveCall,
  removeActiveCall,
  updateActiveCallParticipants,
  setIncomingCall,
  clearIncomingCall,
  clearLastCallEnded,
} = callSlice.actions;

export default callSlice.reducer;

