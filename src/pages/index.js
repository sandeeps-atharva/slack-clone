import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

import { logout, clearError, loadUserFromStorage } from "../store/slices/authSlice";
import {
  fetchMessages,
  sendMessage,
  addPendingMessage,
  markMessageFailed,
  clearMessages,
  clearChatError,
  clearChat,
  markChannelAsRead,
  setChannelLastReadTimestamp,
  markMessagesAsRead,
  markMessageAsDelivered,
} from "../store/slices/chatSlice";
import {
  fetchChannels,
  setActiveChannel,
  searchUsers,
  createDM,
  fetchChannelMembers,
  clearChannelError,
  leaveChannel,
} from "../store/slices/channelSlice";
import { setShowEmoji } from "../store/slices/uiSlice";
import { clearCallError, clearIncomingCall, startCall as startCallAction, openCallPanel } from "../store/slices/callSlice";
import {
  selectNotifications,
  selectUnreadNotificationCount,
  selectNotificationPreferences,
  setNotificationPreference,
  resetNotificationPreferences,
  markNotificationsByChannel,
} from "../store/slices/notificationSlice";
import {
  selectCallHistory,
  selectCallHistoryLoading,
  selectCallHistoryError,
  fetchCallHistory,
  removeCallFromHistory,
} from "../store/slices/callHistorySlice";

import useTheme from "../hooks/useTheme";
import useNotificationActions from "../hooks/useNotificationActions";
import useSocket from "../hooks/useSocket";
import useTyping from "../hooks/useTyping";
import useMediaRecorder from "../hooks/useMediaRecorder";
import useCamera from "../hooks/useCamera";
import useFileUpload from "../hooks/useFileUpload";
import useMessageActions from "../hooks/useMessageActions";
import useMessageReactions from "../hooks/useMessageReactions";
import useThreadActions from "../hooks/useThreadActions";
import useChannelForm from "../hooks/useChannelForm";
import useChannelSettings from "../hooks/useChannelSettings";
import useCallActions from "../hooks/useCallActions";

import ChatLayout from "../components/chat/ChatLayout";
import ChatHeader from "../components/chat/ChatHeader";
import ChatFooter from "../components/chat/ChatFooter";
import MessageList from "../components/chat/MessageList";
import ChannelSidebar from "../components/ChannelSidebar";
import NotificationDropdown from "../components/NotificationDropdown";
import CallHistoryDropdown from "../components/CallHistoryDropdown";
import AttachmentPreview from "../components/chat/AttachmentPreview";
import CameraCapture from "../components/chat/CameraCapture";
import ThreadPanel from "../components/ThreadPanel";
import CallPanel from "../components/CallPanel";
import IncomingCallNotification from "../components/IncomingCallNotification";
import UserSearchModal from "../components/UserSearchModal";
import ChannelSettingsModal from "../components/ChannelSettingsModal";
import ProfileSidebar from "../components/ProfileSidebar";
import RoomBookingSidebar from "../components/RoomBookingSidebar";
import { extractMentions } from "../utils/renderMentions";

const parseChannelTopic = (topic) => {
  if (!topic) return null;
  if (typeof topic === "object") {
    return topic;
  }
  if (typeof topic !== "string") {
    return null;
  }
  const trimmed = topic.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return {
      text: trimmed,
    };
  }
};

const normalizeMentionValue = (value) => (value ?? "").toString().trim().toLowerCase();

const computeChannelDisplayName = (channel, currentUser) => {
  if (!channel) return "";
  
  // FIRST: Check if it's a DM channel by looking at metadata
  // This is important because DM channels might have a name set, but we should
  // always show the other participant's name, not the channel name
  const metadata = parseChannelTopic(channel.topic);
  const currentUsername = currentUser?.username?.toLowerCase();
  const currentId = currentUser?.id ? Number(currentUser.id) : null;
  
  if (metadata?.type === "dm" && Array.isArray(metadata.participants)) {
    // Filter out the current user and find the other participant
    const otherParticipants = metadata.participants.filter((participant) => {
      if (!participant) return false;
      
      // First try to match by ID (most reliable)
      if (currentId != null && participant.id != null) {
        const participantId = Number(participant.id);
        if (!isNaN(participantId) && participantId === currentId) {
          return false; // This is the current user, exclude them
        }
      }
      
      // Then try to match by username (fallback)
      if (currentUsername && participant.username) {
        const participantUsername = String(participant.username).toLowerCase().trim();
        if (participantUsername === currentUsername) {
          return false; // This is the current user, exclude them
        }
      }
      
      return true; // This is not the current user, include them
    });
    
    // Return the first other participant's username, or fallback
    if (otherParticipants.length > 0 && otherParticipants[0]?.username) {
      return String(otherParticipants[0].username).trim();
    }
    
    // If no other participant found, fallback to "Direct Message"
    return "Direct Message";
  }
  
  // If it's not a DM, use the channel name
  const channelName = channel.name ? String(channel.name).trim() : "";
  
  if (channelName !== "") {
    return channelName;
  }
  
  // Fallback for private channels without names
  if (channel.is_private) {
    return "Direct Message";
  }
  
  return "Channel";
};

const inferMessageType = (file) => {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("audio/")) return "audio";
  if (file) return "file";
  return "text";
};

const generateClientId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ChatPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  const {
    user,
    token,
    isAuthenticated,
    isHydrated,
    isLoading: authLoading,
    error: authError,
  } = useSelector((state) => state.auth);
  const { showEmoji } = useSelector((state) => state.ui);
  const {
    messagesByChannel,
    error: chatError,
    sendingMessage,
    loadedChannels,
    updatingMessageId,
    deletingMessageId,
    unreadCountsByChannel,
    lastReadTimestampByChannel,
  } = useSelector((state) => state.chat);
  const {
    channels,
    activeChannelId,
    isLoading: channelsLoading,
    error: channelsError,
    creating: creatingChannel,
    availableUsers,
    findingUsers,
    userSearchError,
    selectedMemberIds,
    membersByChannel,
    membersLoading,
  } = useSelector((state) => state.channels);
  const {
    isInCall,
    callChannelId,
    activeCalls,
    incomingCall,
    showCallPanel,
    localStream,
  } = useSelector((state) => state.call);
  const onlineUserIds = useSelector((state) => state.onlineStatus.onlineUserIds);
  const notifications = useSelector(selectNotifications);
  const unreadNotificationCount = useSelector(selectUnreadNotificationCount);
  const notificationPreferences = useSelector(selectNotificationPreferences);
  
  // Call history selectors
  const callHistory = useSelector(selectCallHistory);
  const callHistoryLoading = useSelector(selectCallHistoryLoading);
  const callHistoryError = useSelector(selectCallHistoryError);

  const [newMessage, setNewMessage] = useState("");
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [dmUserSearchQuery, setDmUserSearchQuery] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [pendingCallRejoinId, setPendingCallRejoinId] = useState(null);
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(null);
  const [mentionCaretPosition, setMentionCaretPosition] = useState(null);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [mentionType, setMentionType] = useState(null);
  const [emojiTarget, setEmojiTarget] = useState("main");
  const [editingInitialAttachment, setEditingInitialAttachment] = useState(null);
  const [editingAttachmentMode, setEditingAttachmentMode] = useState("none");
  const [showProfileSidebar, setShowProfileSidebar] = useState(false);
  const [showRoomBooking, setShowRoomBooking] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (typeof window !== "undefined") {
      dispatch(loadUserFromStorage());
    }
  }, [dispatch]);

  // Fetch call history when user is authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      dispatch(fetchCallHistory({ token }));
    }
  }, [isAuthenticated, token, dispatch]);

  const notificationButtonRef = useRef(null);
  const callHistoryButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const notificationPreferencesRef = useRef(notificationPreferences);
  const isUpdatingRouteRef = useRef(false);
  const tokenRef = useRef(token);
  useEffect(() => {
    notificationPreferencesRef.current = notificationPreferences;
  }, [notificationPreferences]);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const normalizeChannelId = useCallback((value) => {
    if (value == null) return null;
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, []);

  const updateRouteChannel = useCallback(
    (channelId) => {
      if (!router.isReady) return;
      // Only update route on the chat page (index page)
      if (router.pathname !== "/") return;
      // Prevent infinite loops
      if (isUpdatingRouteRef.current) return;

      const currentParam = router.query?.channel;
      if (channelId == null) {
        if (currentParam == null) return;
      } else if (
        currentParam != null &&
        String(Array.isArray(currentParam) ? currentParam[0] : currentParam) === String(channelId)
      ) {
        return;
      }

      isUpdatingRouteRef.current = true;
      const nextQuery = { ...router.query };
      if (channelId == null) {
        delete nextQuery.channel;
      } else {
        nextQuery.channel = String(channelId);
      }

      router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true, scroll: false }
      );
      
      // Reset flag after a short delay to allow router to update
      setTimeout(() => {
        isUpdatingRouteRef.current = false;
      }, 200);
    },
    [router]
  );

  const routeChannelParam = router.query?.channel;

  useEffect(() => {
    if (router.isReady) return;
    // Only handle initial channel parameter on the chat page
    if (router.pathname !== "/") return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialChannel = params.get("channel");
    if (initialChannel == null) return;
    const normalized = normalizeChannelId(initialChannel);
    if (normalized == null) return;
    dispatch(setActiveChannel(normalized));
  }, [router.isReady, router.pathname, normalizeChannelId, dispatch]);

  useEffect(() => {
    if (!router.isReady) return;
    // Only handle route parameter on the chat page
    if (router.pathname !== "/") return;
    // Prevent running if we're currently updating the route
    if (isUpdatingRouteRef.current) return;
    if (routeChannelParam == null) return;
    if (channelsLoading) return; // Wait for channels to load before checking membership
    const normalized = normalizeChannelId(routeChannelParam);
    if (normalized == null) return;
    
    // Only set channel from URL if user is actually a member of that channel
    const isMember = channels.some((ch) => ch.id === normalized);
    if (!isMember) {
      // User is not a member of this channel - clear the URL parameter
      // and switch to first available channel if any
      if (channels.length > 0 && activeChannelId !== channels[0].id) {
        dispatch(setActiveChannel(channels[0].id));
      } else {
        updateRouteChannel(null);
      }
      return;
    }
    
    if (activeChannelId == null || String(activeChannelId) !== String(normalized)) {
      dispatch(setActiveChannel(normalized));
    }
  }, [router.isReady, router.pathname, routeChannelParam, normalizeChannelId, dispatch, activeChannelId, channels, channelsLoading, updateRouteChannel]);

  // Update URL when active channel changes (but only if not already in sync with route)
  // This effect is more conservative to prevent loops
  useEffect(() => {
    if (!router.isReady) return;
    // Only update URL on the chat page
    if (router.pathname !== "/") return;
    // Prevent running if we're currently updating the route
    if (isUpdatingRouteRef.current) return;
    // Don't run if channels are still loading
    if (channelsLoading) return;
    
    const routeChannel = normalizeChannelId(routeChannelParam);
    
    // If activeChannelId is null and route has a param, clear it
    if (activeChannelId == null) {
      if (routeChannelParam != null) {
        updateRouteChannel(null);
      }
      return;
    }
    
    // If route parameter matches active channel, we're already in sync
    if (routeChannel != null && String(routeChannel) === String(activeChannelId)) {
      return;
    }
    
    // Only update URL if:
    // 1. Route parameter doesn't match active channel
    // 2. User is a member of the active channel
    // 3. We're not currently updating the route
    const isMember = channels.some((ch) => ch.id === activeChannelId);
    if (isMember && routeChannel !== activeChannelId) {
      // Use a small delay to debounce and prevent rapid updates
      const timeoutId = setTimeout(() => {
        if (!isUpdatingRouteRef.current) {
          updateRouteChannel(activeChannelId);
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    } else if (!isMember && routeChannelParam != null) {
      // User is not a member - clear URL
      updateRouteChannel(null);
    }
  }, [router.isReady, router.pathname, activeChannelId, channels, channelsLoading, routeChannelParam, normalizeChannelId, updateRouteChannel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedChannelId = window.sessionStorage.getItem("call:activeChannelId");
    if (storedChannelId) {
      setPendingCallRejoinId(storedChannelId);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInCall && callChannelId != null) {
      window.sessionStorage.setItem("call:activeChannelId", String(callChannelId));
    } else {
      window.sessionStorage.removeItem("call:activeChannelId");
    }
  }, [isInCall, callChannelId]);

  useEffect(() => {
    if (pendingCallRejoinId == null) return;
    if (!isHydrated || !isAuthenticated || !token) return;
    if (!Array.isArray(channels) || channels.length === 0) return;
    if (isInCall) {
      setPendingCallRejoinId(null);
      return;
    }

    const targetChannelId = normalizeChannelId(pendingCallRejoinId);
    if (targetChannelId == null) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("call:activeChannelId");
      }
      setPendingCallRejoinId(null);
      return;
    }

    const channelExists = channels.some(
      (channel) => String(channel.id) === String(targetChannelId)
    );
    if (!channelExists) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("call:activeChannelId");
      }
      setPendingCallRejoinId(null);
      return;
    }

    if (String(activeChannelId) !== String(targetChannelId)) {
      dispatch(setActiveChannel(targetChannelId));
      updateRouteChannel(targetChannelId);
    }

    dispatch(startCallAction({ channelId: targetChannelId, callType: "video" }));

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("call:activeChannelId", String(targetChannelId));
    }

    setPendingCallRejoinId(null);
  }, [
    pendingCallRejoinId,
    isHydrated,
    isAuthenticated,
    token,
    channels,
    isInCall,
    activeChannelId,
    dispatch,
    normalizeChannelId,
  ]);

  useEffect(() => {
    if (!showEmoji) return;

    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        dispatch(setShowEmoji(false));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showEmoji, dispatch]);

  const notificationActions = useNotificationActions(notifications, notificationPreferences);
  const {
    showNotifications: showNotificationsRaw,
    handleToggleNotifications: handleToggleNotificationsRaw,
    handleNotificationSelect,
    handleNotificationRemove,
    handleMarkAllNotificationsReadClick,
    playNotificationSound,
  } = notificationActions;

  const showNotifications = showNotificationsRaw;

  const handleCallHistoryRefresh = useCallback(() => {
    if (token) {
      dispatch(fetchCallHistory({ token }));
    }
  }, [dispatch, token]);

  const handleCallUser = useCallback((user, callType = "video") => {
    // Implementation would depend on how you want to initiate calls to specific users
    console.log("Call user:", user, callType);
    // You might want to create a DM channel first, then start a call
  }, []);

  const handleRemoveCallFromHistory = useCallback((callId) => {
    dispatch(removeCallFromHistory(callId));
    // Also remove from database
    if (token) {
      fetch(`/api/call-history?callId=${callId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(console.error);
    }
  }, [dispatch, token]);

  const {
    selectedFile,
    previewUrl,
    uploadError,
    isUploading,
    fileInputRef,
    handleFileSelect,
    removeFile,
    uploadFile,
    reset: resetAttachment,
  } = useFileUpload();

  const {
    isRecording,
    recordingTime,
    error: recordingError,
    recordedFile,
    toggleRecording,
    stopRecording,
    clearRecording,
  } = useMediaRecorder();

  const {
    isCameraOpen,
    cameraError,
    videoRef,
    openCamera,
    closeCamera,
    capturePhoto,
    capturedFile,
    clearCapturedFile,
  } = useCamera();

  const {
    selectedFile: editSelectedFile,
    previewUrl: editPreviewUrl,
    uploadError: editUploadError,
    isUploading: editIsUploading,
    fileInputRef: editFileInputRef,
    handleFileSelect: handleEditFileSelect,
    removeFile: removeEditFile,
    uploadFile: uploadEditFile,
    reset: resetEditAttachment,
  } = useFileUpload();

  const {
    isRecording: editIsRecording,
    recordingTime: editRecordingTime,
    error: editRecordingError,
    recordedFile: editRecordedFile,
    toggleRecording: toggleEditRecording,
    stopRecording: stopEditRecording,
    clearRecording: clearEditRecording,
  } = useMediaRecorder();

  const {
    isCameraOpen: isEditCameraOpen,
    cameraError: editCameraError,
    videoRef: editVideoRef,
    openCamera: openEditCamera,
    closeCamera: closeEditCamera,
    capturePhoto: captureEditPhoto,
    capturedFile: editCapturedFile,
    clearCapturedFile: clearEditCapturedFile,
  } = useCamera();

  const {
    selectedFile: threadSelectedFile,
    previewUrl: threadPreviewUrl,
    uploadError: threadUploadError,
    isUploading: threadIsUploading,
    fileInputRef: threadFileInputRef,
    handleFileSelect: handleThreadFileSelect,
    removeFile: removeThreadFile,
    uploadFile: uploadThreadFile,
    reset: resetThreadAttachment,
  } = useFileUpload();

  const {
    isRecording: threadIsRecording,
    recordingTime: threadRecordingTime,
    error: threadRecordingError,
    recordedFile: threadRecordedFile,
    toggleRecording: toggleThreadRecording,
    stopRecording: stopThreadRecording,
    clearRecording: clearThreadRecording,
  } = useMediaRecorder();

  const {
    isCameraOpen: isThreadCameraOpen,
    cameraError: threadCameraError,
    videoRef: threadVideoRef,
    openCamera: openThreadCamera,
    closeCamera: closeThreadCamera,
    capturePhoto: captureThreadPhoto,
    capturedFile: threadCapturedFile,
    clearCapturedFile: clearThreadCapturedFile,
  } = useCamera();

  useEffect(() => {
    if (recordedFile) {
      handleFileSelect(recordedFile);
      clearRecording();
    }
  }, [recordedFile, handleFileSelect, clearRecording]);

  useEffect(() => {
    if (capturedFile) {
      handleFileSelect(capturedFile);
      clearCapturedFile();
    }
  }, [capturedFile, handleFileSelect, clearCapturedFile]);

  useEffect(() => {
    if (editRecordedFile) {
      setEditingAttachmentMode("replace");
      handleEditFileSelect(editRecordedFile);
      clearEditRecording();
    }
  }, [editRecordedFile, handleEditFileSelect, clearEditRecording]);

  useEffect(() => {
    if (editCapturedFile) {
      setEditingAttachmentMode("replace");
      handleEditFileSelect(editCapturedFile);
      clearEditCapturedFile();
    }
  }, [editCapturedFile, handleEditFileSelect, clearEditCapturedFile]);

  useEffect(() => {
    if (threadRecordedFile) {
      handleThreadFileSelect(threadRecordedFile);
      clearThreadRecording();
    }
  }, [threadRecordedFile, handleThreadFileSelect, clearThreadRecording]);

  useEffect(() => {
    if (threadCapturedFile) {
      handleThreadFileSelect(threadCapturedFile);
      clearThreadCapturedFile();
    }
  }, [threadCapturedFile, handleThreadFileSelect, clearThreadCapturedFile]);

  const channelsWithDisplay = useMemo(
    () =>
      channels.map((channel) => ({
        ...channel,
        metadata: parseChannelTopic(channel.topic),
        displayName: computeChannelDisplayName(channel, user),
        unreadCount: unreadCountsByChannel[String(channel.id)] || 0,
      })),
    [channels, user, unreadCountsByChannel]
  );

  const activeChannel = useMemo(
    () => channelsWithDisplay.find((channel) => channel.id === activeChannelId) || null,
    [channelsWithDisplay, activeChannelId]
  );

  const activeMessages = useMemo(() => {
    if (activeChannelId == null) return [];
    const key = String(activeChannelId);
    return messagesByChannel[key] || [];
  }, [messagesByChannel, activeChannelId]);

  const messageMap = useMemo(() => {
    const map = new Map();
    activeMessages.forEach((msg) => {
      if (msg?.id != null) map.set(msg.id, msg);
    });
    return map;
  }, [activeMessages]);

  const rootMessages = useMemo(
    () => activeMessages.filter((msg) => !msg.thread_parent_id),
    [activeMessages]
  )

  const threadCounts = useMemo(() => {
    const counts = {};
    activeMessages.forEach((msg) => {
      if (msg.thread_parent_id) {
        counts[msg.thread_parent_id] = (counts[msg.thread_parent_id] || 0) + 1;
      }
    });
    return counts;
  }, [activeMessages]);

  const socketRef = useRef(null);
  const messageInputRef = useRef(null);
  const userRef = useRef(user);
  const activeChannelIdRef = useRef(activeChannelId);
  const isInCallRef = useRef(isInCall);
  const callChannelIdRef = useRef(callChannelId);
  const incomingCallRef = useRef(incomingCall);
  const localStreamRef = useRef(localStream);
  const activeThreadIdRef = useRef(null);
  const channelsByIdRef = useRef({});
  const joinedChannelIdsRef = useRef(new Set());

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);
  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);
  useEffect(() => {
    callChannelIdRef.current = callChannelId;
  }, [callChannelId]);
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const map = {};
    channelsWithDisplay.forEach((channel) => {
      if (channel && channel.id != null) map[channel.id] = channel;
    });
    channelsByIdRef.current = map;
    joinedChannelIdsRef.current = new Set(channels.map((c) => Number(c.id)));
  }, [channelsWithDisplay, channels]);

  // Create channelsById map for easy lookup
  const channelsById = useMemo(() => {
    const map = {};
    channels.forEach((channel) => {
      if (channel && channel.id != null) {
        map[channel.id] = channel;
      }
    });
    return map;
  }, [channels]);

  const typing = useTyping(socketRef, activeChannelId, user);
  const {
    isTyping,
    typingUsers,
    setTypingUsers,
    handleMessageChange: trackTyping,
    emitTyping,
    resetTyping,
  } = typing;

  const { socket } = useSocket({
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
    socketRef,
    tokenRef,
  });

  const {
    activeThreadId,
    setActiveThreadId: setActiveThreadIdRaw,
    threadDraft,
    setThreadDraft,
    openThread,
    closeThread,
    sendThreadReply,
    error: threadError,
  } = useThreadActions(token, socketRef, activeChannelId, user);

  const handleThreadReplySend = useCallback(async () => {
    if (!user || !token || !activeThreadId || activeChannelId == null) return;
    if (threadIsUploading) return;

    const trimmed = threadDraft.trim();
    const hasAttachment = Boolean(threadSelectedFile);
    if (!trimmed && !hasAttachment) return;

    let attachmentPayload = null;
    try {
      if (threadSelectedFile) {
        attachmentPayload = await uploadThreadFile(threadSelectedFile);
      }
      await sendThreadReply({ attachment: attachmentPayload });
      resetThreadAttachment();
    } catch (error) {
      console.error("Failed to send thread reply:", error);
    }
  }, [
    user,
    token,
    activeThreadId,
    activeChannelId,
    threadDraft,
    threadIsUploading,
    threadSelectedFile,
    uploadThreadFile,
    sendThreadReply,
    resetThreadAttachment,
  ]);

  useEffect(() => {
    if (!activeThreadId) {
      resetThreadAttachment();
      clearThreadRecording();
      clearThreadCapturedFile();
    }
  }, [activeThreadId, resetThreadAttachment, clearThreadRecording, clearThreadCapturedFile]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const {
    editingMessageId,
    editingText,
    setEditingText,
    startEdit,
    saveEdit,
    deleteMsg,
    cancelEdit,
    error: messageActionError,
    errorId: messageActionErrorId,
  } = useMessageActions(token, socketRef, activeThreadId, setActiveThreadIdRaw, setThreadDraft);

  const { toggleReaction } = useMessageReactions(socketRef, token);

  const resetEditingAttachmentState = useCallback(() => {
    resetEditAttachment();
    setEditingInitialAttachment(null);
    setEditingAttachmentMode("none");
  }, [resetEditAttachment]);

  const handleStartEdit = useCallback(
    (message) => {
      resetEditAttachment();
      if (message?.file_url) {
        setEditingInitialAttachment({
          fileUrl: message.file_url,
          fileName: message.file_name,
          mimeType: message.mime_type,
          messageType: message.message_type,
        });
        setEditingAttachmentMode("keep");
      } else {
        setEditingInitialAttachment(null);
        setEditingAttachmentMode("none");
      }
      startEdit(message);
    },
    [startEdit, resetEditAttachment]
  );

  const handleCancelEdit = useCallback(() => {
    cancelEdit();
    resetEditingAttachmentState();
  }, [cancelEdit, resetEditingAttachmentState]);

  const handleRemoveExistingAttachment = useCallback(() => {
    if (!editingInitialAttachment) return;
    setEditingAttachmentMode("remove");
  }, [editingInitialAttachment]);

  const handleRestoreExistingAttachment = useCallback(() => {
    if (!editingInitialAttachment) return;
    setEditingAttachmentMode("keep");
  }, [editingInitialAttachment]);

  const handleEditFileChange = useCallback(
    (file) => {
      if (!file) return;
      setEditingAttachmentMode("replace");
      handleEditFileSelect(file);
    },
    [handleEditFileSelect]
  );

  const handleEditRemoveNewAttachment = useCallback(() => {
    removeEditFile();
    setEditingAttachmentMode(editingInitialAttachment ? "keep" : "none");
  }, [removeEditFile, editingInitialAttachment]);

  const handleToggleEmojiFor = useCallback(
    (target) => {
      if (showEmoji && emojiTarget === target) {
        dispatch(setShowEmoji(false));
        return;
      }
      setEmojiTarget(target);
      dispatch(setShowEmoji(true));
    },
    [dispatch, showEmoji, emojiTarget]
  );

  const handleSaveEditMessage = useCallback(async () => {
    let attachmentPayload = null;
    const shouldReplace = editingAttachmentMode === "replace" && editSelectedFile;
    const shouldRemove = editingAttachmentMode === "remove" && Boolean(editingInitialAttachment);

    try {
      if (shouldReplace) {
        attachmentPayload = await uploadEditFile(editSelectedFile);
      }

      await saveEdit({
        attachment: attachmentPayload,
        removeAttachment: shouldRemove && !shouldReplace,
      });
      resetEditingAttachmentState();
    } catch (error) {
      console.error("Failed to save message edit:", error);
    }
  }, [
    editingAttachmentMode,
    editSelectedFile,
    editingInitialAttachment,
    uploadEditFile,
    saveEdit,
    resetEditingAttachmentState,
  ]);

  const handleThreadFileChange = useCallback(
    (file) => {
      if (!file) return;
      handleThreadFileSelect(file);
    },
    [handleThreadFileSelect]
  );

  const handleThreadRemoveAttachment = useCallback(() => {
    removeThreadFile();
  }, [removeThreadFile]);

  const selectedMembersDisplay = useMemo(
    () =>
      selectedMemberIds.map(
        (id) => availableUsers.find((candidate) => candidate.id === id) || { id, username: `User ${id}` }
      ),
    [selectedMemberIds, availableUsers]
  );

  const membersLoadingState = activeChannelId != null ? Boolean(membersLoading?.[activeChannelId]) : false;
  const activeMembers = useMemo(
    () => (activeChannelId != null ? membersByChannel[activeChannelId] || [] : []),
    [membersByChannel, activeChannelId]
  );

  const activeChannelMetadata = activeChannel?.topic ? parseChannelTopic(activeChannel.topic) : null;
  const isDirectMessageChannel = activeChannelMetadata?.type === "dm";
  const ownerCount = activeMembers.filter((member) => member.role === "owner").length;
  const isCurrentUserOwner = activeMembers.some((member) => member.role === "owner" && member.id === user?.id);
  // Owners can always leave (ownership will be automatically transferred if they're the last owner)
  const canLeaveChannel = true;
  const canEditChannel = !isDirectMessageChannel && activeChannel?.role === "owner";
  const canManageMembers = !isDirectMessageChannel && activeChannel?.role === "owner";

  const channelForm = useChannelForm(token, selectedMemberIds);
  const channelSettings = useChannelSettings(token, activeChannelId, canLeaveChannel);

  const {
    showChannelForm,
    toggleForm: toggleChannelForm,
    name: newChannelName,
    topic: newChannelTopic,
    isPrivate: newChannelPrivate,
    userSearchQuery: channelUserSearchQuery,
    error: channelFormError,
    onNameChange: setNewChannelName,
    onTopicChange: setNewChannelTopic,
    onTogglePrivate: toggleChannelPrivate,
    onUserSearchChange: setChannelUserSearch,
    onSubmit: submitChannelForm,
    onToggleMember: toggleChannelMember,
  } = channelForm;


  const {
    showChannelSettings,
    openSettings,
    closeSettings,
    name: settingsName,
    topic: settingsTopic,
    isPrivate: settingsPrivate,
    error: settingsError,
    userQuery: settingsUserQuery,
    selectedUserIds: settingsSelectedUserIds,
    onNameChange: setSettingsName,
    onTopicChange: setSettingsTopic,
    onPrivateChange: setSettingsPrivate,
    onUserQueryChange: setSettingsUserQuery,
    onSubmit: submitChannelSettings,
    onLeave: leaveChannel,
    onRemoveMember,
    onAddMembers,
    onToggleSelected: toggleSettingsSelected,
  } = channelSettings;

  // Helper function to manage panel limit (max 2 panels at a time)
  // Priority order (lowest to highest - lower priority gets closed first):
  // 1. Thread (lowest)
  // 2. Room Booking
  // 3. Call History
  // 4. Notifications
  // 5. Settings
  // 6. Profile (highest)
  const managePanelLimit = useCallback((panelToOpen) => {
    const openPanels = {
      thread: Boolean(activeThreadId),
      roomBooking: showRoomBooking,
      callHistory: showCallHistory,
      notifications: showNotifications,
      settings: showChannelSettings,
      profile: showProfileSidebar,
    };
    
    const openCount = Object.values(openPanels).filter(Boolean).length;
    
    // If opening this panel would exceed 2, close the lowest priority panel
    if (openCount >= 2 && !openPanels[panelToOpen]) {
      // Priority order: thread < roomBooking < callHistory < notifications < settings < profile
      const priorityOrder = ['thread', 'roomBooking', 'callHistory', 'notifications', 'settings', 'profile'];
      
      // Find the lowest priority open panel (excluding the one we're trying to open)
      for (const panel of priorityOrder) {
        if (openPanels[panel] && panel !== panelToOpen) {
          // Close this panel
          switch (panel) {
            case 'thread':
              closeThread();
              break;
            case 'roomBooking':
              setShowRoomBooking(false);
              break;
            case 'callHistory':
              setShowCallHistory(false);
              break;
            case 'notifications':
              handleToggleNotificationsRaw();
              break;
            case 'settings':
              closeSettings();
              break;
            case 'profile':
              setShowProfileSidebar(false);
              break;
          }
          break;
        }
      }
    }
  }, [activeThreadId, showRoomBooking, showCallHistory, showNotifications, showChannelSettings, showProfileSidebar, closeThread, handleToggleNotificationsRaw, closeSettings]);

  // Wrapper for notifications toggle with panel limit
  const handleToggleNotifications = useCallback(() => {
    if (!showNotificationsRaw) {
      // Opening - check limit
      managePanelLimit('notifications');
    }
    handleToggleNotificationsRaw();
  }, [showNotificationsRaw, handleToggleNotificationsRaw, managePanelLimit]);

  // Wrapper for openSettings that respects panel limit
  const openSettingsWithLimit = useCallback(() => {
    if (!showChannelSettings) {
      managePanelLimit('settings');
    }
    openSettings();
  }, [managePanelLimit, openSettings, showChannelSettings]);
  
  // Wrapper for opening room booking with panel limit
  const handleOpenRoomBooking = useCallback(() => {
    if (!showRoomBooking) {
      managePanelLimit('roomBooking');
    }
    setShowRoomBooking(true);
  }, [managePanelLimit, showRoomBooking]);

  // Wrapper for opening profile sidebar with panel limit
  const handleOpenProfile = useCallback(() => {
    if (!showProfileSidebar) {
      managePanelLimit('profile');
    }
    setShowProfileSidebar(true);
  }, [managePanelLimit, showProfileSidebar]);
  
  // Wrapper for opening thread with panel limit
  const handleOpenThread = useCallback((message) => {
    if (!activeThreadId) {
      managePanelLimit('thread');
    }
    openThread(message);
  }, [managePanelLimit, activeThreadId, openThread]);

  // Wrapper for setActiveThreadId with panel limit (defined after managePanelLimit)
  const setActiveThreadId = useCallback((threadId) => {
    if (threadId && !activeThreadId) {
      // Opening a thread - check limit
      managePanelLimit('thread');
    }
    setActiveThreadIdRaw(threadId);
  }, [activeThreadId, managePanelLimit, setActiveThreadIdRaw]);

  // Call history handlers (defined after managePanelLimit)
  const handleToggleCallHistory = useCallback(() => {
    setShowCallHistory((prev) => {
      if (!prev) {
        // Opening - check limit
        managePanelLimit('callHistory');
      }
      return !prev;
    });
  }, [managePanelLimit]);

const settingsSelectedMembersDisplay = useMemo(
  () =>
    settingsSelectedUserIds.map(
      (id) => availableUsers.find((candidate) => candidate.id === id) || { id, username: `User ${id}` }
    ),
  [settingsSelectedUserIds, availableUsers]
);

  const callActions = useCallActions(socketRef, activeChannelId, incomingCall);

  const handleReopenCallPanel = useCallback(() => {
    if (!isInCall) return;
    dispatch(openCallPanel());
  }, [dispatch, isInCall]);

  const activeThreadRoot = activeThreadId ? messageMap.get(activeThreadId) || null : null;

  const typingNames = useMemo(() => {
    const channelKey =
      activeChannelId == null ? null : String(activeChannelId);
    const channelTyping =
      channelKey != null ? typingUsers[channelKey] || {} : {};
    return Object.values(channelTyping)
      .filter((participant) => participant.id !== user?.id)
      .map((participant) =>
        participant.displayName || participant.username || participant.email || "Someone"
      )
      .filter(Boolean);
  }, [typingUsers, activeChannelId, user?.id]);

  useEffect(() => {
    if (isAuthenticated && token) {
      dispatch(fetchChannels(token));
    }
  }, [dispatch, isAuthenticated, token]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !token ||
      activeChannelId == null ||
      chatError ||
      loadedChannels?.[activeChannelId]
    ) {
      return;
    }
    dispatch(fetchMessages({ token, channelId: activeChannelId }));
    dispatch(fetchChannelMembers({ token, channelId: activeChannelId }));
  }, [dispatch, isAuthenticated, token, activeChannelId, chatError, loadedChannels]);

  // Track if we've initialized the lastReadTimestamp for a channel
  const initializedReadTimestampRef = useRef(new Set());
  const markedAsReadRef = useRef(new Set());
  
  useEffect(() => {
    if (activeChannelId != null && loadedChannels?.[activeChannelId]) {
      const channelKey = String(activeChannelId);
      const loadKey = `${activeChannelId}-${loadedChannels[activeChannelId]}`;
      const messages = messagesByChannel[channelKey] || [];
      
      // Initialize lastReadTimestamp if not set and there are unread messages
      if (!initializedReadTimestampRef.current.has(channelKey)) {
        const unreadCount = unreadCountsByChannel[channelKey] || 0;
        const existingLastRead = lastReadTimestampByChannel[channelKey];
        
        // If there are unread messages, find the timestamp before the unread messages
        if (unreadCount > 0 && messages.length > 0 && !existingLastRead) {
          // Sort messages by timestamp and find the message before the unread ones
          const sortedMessages = [...messages]
            .filter(msg => msg.created_at)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          if (sortedMessages.length > unreadCount) {
            // Get the timestamp of the message that's before the unread messages
            const indexBeforeUnread = sortedMessages.length - unreadCount - 1;
            const timestampBeforeUnread = new Date(sortedMessages[indexBeforeUnread].created_at).getTime();
            dispatch(setChannelLastReadTimestamp({ 
              channelId: activeChannelId, 
              timestamp: timestampBeforeUnread 
            }));
          } else {
            // All messages are unread, set to 0
            dispatch(setChannelLastReadTimestamp({ 
              channelId: activeChannelId, 
              timestamp: 0 
            }));
          }
        }
        initializedReadTimestampRef.current.add(channelKey);
      }
      
      // Mark as read after a delay to allow divider to render
      if (!markedAsReadRef.current.has(loadKey)) {
        const timer = setTimeout(() => {
          dispatch(markChannelAsRead(activeChannelId));
          // Also mark all notifications for this channel as read
          dispatch(markNotificationsByChannel(activeChannelId));
          
          // Mark all messages in the channel as read (for WhatsApp-style read receipts)
          const unreadMessageIds = messages
            .filter((msg) => {
              // Only mark messages that are not from the current user and haven't been read by current user
              const isOwnMessage = msg.user_id === user?.id;
              const readBy = msg.readBy || [];
              const isReadByCurrentUser = user?.id && readBy.includes(user.id);
              return !isOwnMessage && !isReadByCurrentUser && msg.id;
            })
            .map((msg) => msg.id)
            .filter(Boolean);
          
          if (unreadMessageIds.length > 0 && token && user?.id) {
            dispatch(
              markMessagesAsRead({
                token,
                channelId: activeChannelId,
                messageIds: unreadMessageIds,
                currentUserId: user.id,
              })
            );
          }
          
          markedAsReadRef.current.add(loadKey);
        }, 1000); // Delay to ensure divider shows before marking as read
        
        return () => clearTimeout(timer);
      }
    }
  }, [dispatch, activeChannelId, loadedChannels, unreadCountsByChannel, lastReadTimestampByChannel, messagesByChannel, user, token]);
  
  // Clear tracking when channel changes
  useEffect(() => {
    initializedReadTimestampRef.current.clear();
    markedAsReadRef.current.clear();
  }, [activeChannelId]);

  // Mark messages as delivered when recipient comes online
  useEffect(() => {
    if (!activeChannelId || !user?.id) return;
    
    const channelKey = String(activeChannelId);
    const messages = messagesByChannel[channelKey] || [];
    const channelMembers = membersByChannel[activeChannelId] || [];
    
    // Find messages that should be marked as delivered
    const messagesToMark = messages
      .filter((msg) => {
        // Only own messages
        const isOwnMsg = msg.user_id === user.id;
        if (!isOwnMsg) return false;
        
        // Not already marked as delivered
        if (msg.wasDelivered) return false;
        
        // Not read yet
        const readBy = msg.readBy || [];
        const recipients = channelMembers
          .map((m) => m.id)
          .filter((memberId) => memberId !== msg.user_id);
        const isRead = recipients.length > 0 && recipients.every((recipientId) => readBy.includes(recipientId));
        if (isRead) return false;
        
        // Recipient is currently online
        const anyRecipientOnline = recipients.some((recipientId) =>
          onlineUserIds.includes(recipientId)
        );
        
        return anyRecipientOnline && msg.id;
      })
      .map((msg) => msg.id)
      .filter(Boolean);
    
    if (messagesToMark.length > 0) {
      dispatch(markMessageAsDelivered({
        channelId: activeChannelId,
        messageIds: messagesToMark,
      }));
    }
  }, [activeChannelId, messagesByChannel, membersByChannel, onlineUserIds, user?.id, dispatch]);

  useEffect(() => {
    if (!showChannelForm || !token) return;
    const timeout = setTimeout(() => {
      dispatch(searchUsers({ token, query: channelUserSearchQuery.trim() }));
    }, 250);
    return () => clearTimeout(timeout);
  }, [dispatch, token, showChannelForm, channelUserSearchQuery]);

  useEffect(() => {
    if (!showChannelSettings || !token) return;
    const timeout = setTimeout(() => {
      dispatch(searchUsers({ token, query: settingsUserQuery.trim() }));
    }, 250);
    return () => clearTimeout(timeout);
  }, [dispatch, token, showChannelSettings, settingsUserQuery]);

  useEffect(() => {
    if (!showUserSearchModal || !token) return;
    const timeout = setTimeout(() => {
      dispatch(searchUsers({ token, query: dmUserSearchQuery.trim() }));
    }, 250);
    return () => clearTimeout(timeout);
  }, [dispatch, token, showUserSearchModal, dmUserSearchQuery]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && isHydrated) {
      router.push("/login");
    }
  }, [isAuthenticated, isHydrated, router]);

  const handleSelectChannel = useCallback(
    (channelId) => {
      dispatch(clearChatError());
      dispatch(clearChannelError());
      dispatch(setActiveChannel(channelId));
      updateRouteChannel(channelId);
      setIsMobileSidebarOpen(false);
    },
    [dispatch, updateRouteChannel]
  );

  const handleClearChat = useCallback(async () => {
    if (!token || !activeChannelId || isClearingChat) return;
    
    setIsClearingChat(true);
    try {
      const result = await dispatch(clearChat({ token, channelId: activeChannelId }));
      if (clearChat.fulfilled.match(result)) {
        // Refetch messages - they will now be filtered by cleared_at timestamp
        dispatch(fetchMessages({ token, channelId: activeChannelId }));
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
    } finally {
      setIsClearingChat(false);
    }
  }, [dispatch, token, activeChannelId, isClearingChat]);



  const clearMentionState = useCallback(() => {
    setMentionActive(false);
    setMentionQuery("");
    setMentionTriggerIndex(null);
    setMentionCaretPosition(null);
    setMentionHighlightIndex(0);
    setMentionType(null);
  }, []);

  const handleMessageInputChange = useCallback(
    (event) => {
      const value = event.target.value;
      const caretPosition = event.target.selectionStart ?? value.length;
    setNewMessage(value);
    trackTyping(value);

      const textBeforeCaret = value.slice(0, caretPosition);
      let triggerIndex = -1;

      for (let index = textBeforeCaret.length - 1; index >= 0; index -= 1) {
        const char = textBeforeCaret[index];
        if (char === "@" || char === "#") {
          const prevChar = textBeforeCaret[index - 1];
          if (!prevChar || /\s/.test(prevChar)) {
            triggerIndex = index;
            setMentionType(char === "@" ? "user" : "channel");
          }
          break;
        }
        if (/\s/.test(char)) {
          break;
        }
      }

      if (triggerIndex >= 0) {
        const query = textBeforeCaret.slice(triggerIndex + 1);
        if (!/\s/.test(query)) {
          setMentionActive(true);
          setMentionQuery(query);
          setMentionTriggerIndex(triggerIndex);
          setMentionCaretPosition(caretPosition);
          setMentionHighlightIndex(0);
          return;
        }
      }

      clearMentionState();
    },
    [trackTyping, clearMentionState]
  );

 
  const userMentionCandidates = useMemo(() => {
    const map = new Map();
    activeMembers.forEach((member) => {
      if (!member?.username) return;
      map.set(member.id ?? member.username, member);
    });
    availableUsers.forEach((userCandidate) => {
      if (!userCandidate?.username) return;
      const key = userCandidate.id ?? userCandidate.username;
      if (!map.has(key)) {
        map.set(key, userCandidate);
      }
    });
    return Array.from(map.values()).map((candidate) => ({
      ...candidate,
      type: "user",
      mentionText: candidate.username || candidate.name,
      displayName: candidate.username || candidate.name,
    }));
  }, [activeMembers, availableUsers]);

  const channelMentionCandidates = useMemo(() => {
    const map = new Map();
    channelsWithDisplay.forEach((channel) => {
      if (!channel) return;
      const key = channel.id ?? channel.name ?? channel.displayName;
      if (!key) return;
      const rawName = channel.name || channel.displayName || `channel-${channel.id}`;
      const mentionValue =
        typeof rawName === "string"
          ? rawName.trim().replace(/\s+/g, "-").toLowerCase()
          : `channel-${channel.id}`;
      map.set(key, {
        ...channel,
        type: "channel",
        mentionText: mentionValue,
        displayName: channel.displayName || channel.name || rawName,
      });
    });
    return Array.from(map.values());
  }, [channelsWithDisplay]);

  const channelMentionMap = useMemo(() => {
    const map = new Map();
    channelMentionCandidates.forEach((channel) => {
      const key = normalizeMentionValue(channel.mentionText || channel.displayName || channel.name);
      if (!key) return;
      const metadata = parseChannelTopic(channel.topic);
      map.set(key, {
        id: channel.id,
        displayName: channel.displayName || channel.name || `channel-${channel.id}`,
        isDM: metadata?.type === "dm",
        raw: channel,
      });
    });
    return map;
  }, [channelMentionCandidates]);

  const userMentionMap = useMemo(() => {
    const map = new Map();
    userMentionCandidates.forEach((candidate) => {
      const key = normalizeMentionValue(
        candidate.mentionText || candidate.username || candidate.name || candidate.displayName
      );
      if (!key) return;
      map.set(key, {
        id: candidate.id,
        username: candidate.username || candidate.name || candidate.displayName || candidate.mentionText,
      });
    });
    return map;
  }, [userMentionCandidates]);

  const dmChannelByUserId = useMemo(() => {
    const map = new Map();
    channelsWithDisplay.forEach((channel) => {
      if (!channel) return;
      const metadata = parseChannelTopic(channel.topic);
      if (metadata?.type !== "dm" || !Array.isArray(metadata.participants)) return;
      metadata.participants.forEach((participant) => {
        if (participant?.id != null) {
          map.set(participant.id, channel.id);
        }
      });
    });
    return map;
  }, [channelsWithDisplay]);

  const resolveMentionEntity = useCallback(
    (mention) => {
      if (!mention) return null;
      const type = mention.type === "channel" ? "channel" : "user";
      const normalizedValue = normalizeMentionValue(
        mention.value || mention.mentionText || mention.username || mention.name || ""
      );
      if (!normalizedValue) return null;

      if (type === "channel") {
        const entry = channelMentionMap.get(normalizedValue);
        if (!entry) return null;
        return {
          type: "channel",
          value: mention.value || mention.mentionText || entry.displayName,
          channelId: entry.id ?? null,
          channelName: entry.displayName,
          isDM: entry.isDM ?? false,
          link: entry.id != null ? `/?channel=${entry.id}` : null,
        };
      }

      const entry = userMentionMap.get(normalizedValue);
      if (!entry) return null;
      const dmChannelId = entry.id != null ? dmChannelByUserId.get(entry.id) : null;
      return {
        type: "user",
        value: mention.value || entry.username,
        userId: entry.id ?? null,
        username: entry.username,
        dmChannelId: dmChannelId ?? null,
        link: dmChannelId != null ? `/?channel=${dmChannelId}` : null,
      };
    },
    [channelMentionMap, userMentionMap, dmChannelByUserId]
  );

  const buildMentionEntitiesForMessage = useCallback(
    (message) => {
      if (!message) return [];
      const sourceMentions =
        Array.isArray(message.mentions) && message.mentions.length > 0
          ? message.mentions
          : extractMentions(message.message || "");
      return sourceMentions
        .map((mention) => {
          if (!mention) return null;
          const normalizedMention = {
            type: mention.type === "channel" ? "channel" : "user",
            value:
              mention.value ||
              mention.mentionText ||
              mention.username ||
              mention.name ||
              mention.displayName ||
              "",
            ...mention,
          };
          if (!normalizedMention.value) return null;
          const resolved = resolveMentionEntity(normalizedMention);
          if (resolved) {
            return { ...normalizedMention, ...resolved };
          }
          return normalizedMention;
        })
        .filter((mention) => mention && mention.type && mention.value);
    },
    [resolveMentionEntity]
  );
  const handleSendMessage = useCallback(async () => {
    if (!user || !token || activeChannelId == null) return;
    if (isRecording) {
      setThreadDraft("");
      return;
    }

    const trimmed = newMessage.trim();
    const fileToUpload = selectedFile;
    if (!trimmed && !fileToUpload) return;

    clearMentionState();
    if (showEmoji) {
      dispatch(setShowEmoji(false));
    }

    const clientId = generateClientId();
    const pendingType = inferMessageType(fileToUpload);

    const mentions = extractMentions(trimmed)
      .map((mention) => {
        if (!mention) return null;
        const resolved = resolveMentionEntity(mention);
        if (resolved) {
          return { ...mention, ...resolved };
        }
        return mention;
      })
      .filter((mention) => mention && mention.type && mention.value);

    dispatch(
      addPendingMessage({
        id: clientId,
        clientId,
        user_id: user.id,
        username: user.username,
        message: trimmed || null,
        message_type: pendingType,
        file_url: null,
        file_name: fileToUpload?.name || null,
        mime_type: fileToUpload?.type || null,
        created_at: new Date().toISOString(),
        status: "pending",
        channel_id: activeChannelId,
        mentions,
      })
    );

    setNewMessage("");
    resetTyping();
    emitTyping(false);

    let attachment = null;
    try {
      if (fileToUpload) {
        attachment = await uploadFile(fileToUpload);
      }
      const result = await dispatch(
        sendMessage({
          message: trimmed,
          attachment,
          token,
          clientId,
          channelId: activeChannelId,
          mentions,
        })
      ).unwrap();

      const payloadWithClient = {
        ...result,
        clientId: result?.clientId || clientId,
      };
      socketRef.current?.emit("send_message", payloadWithClient);
      resetAttachment();
    } catch (error) {
      dispatch(markMessageFailed({ clientId, channelId: activeChannelId }));
    }
  }, [
    user,
    token,
    activeChannelId,
    isRecording,
    newMessage,
    selectedFile,
    clearMentionState,
    showEmoji,
    dispatch,
    setThreadDraft,
    generateClientId,
    uploadFile,
    sendMessage,
    socketRef,
    resetAttachment,
    resolveMentionEntity,
  ]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionActive || !mentionType) return [];
    const normalizedQuery = mentionQuery.trim().toLowerCase();
    const source =
      mentionType === "user" ? userMentionCandidates : channelMentionCandidates;
    const filtered = source.filter((candidate) => {
      const label =
        candidate.displayName ||
        candidate.username ||
        candidate.name ||
        candidate.mentionText ||
        "";
      if (!label) return false;
      if (!normalizedQuery) return true;
      return label.toLowerCase().includes(normalizedQuery);
    });
    return filtered.slice(0, 8);
  }, [
    mentionActive,
    mentionQuery,
    mentionType,
    userMentionCandidates,
    channelMentionCandidates,
  ]);

  const showMentionSuggestions = mentionActive && mentionSuggestions.length > 0;

  const handleMentionSelect = useCallback(
    (selectedUser) => {
      if (!selectedUser) return;
      const mentionValue =
        selectedUser.mentionText ||
        selectedUser.username ||
        selectedUser.name ||
        selectedUser.displayName;
      if (!mentionValue && mentionValue !== "") return;
      const textarea = messageInputRef.current;
      const triggerIndex = mentionTriggerIndex ?? 0;
      const caretPosition = mentionCaretPosition ?? triggerIndex;
      const prefix = mentionType === "channel" ? "#" : "@";
      const mentionText = `${prefix}${mentionValue}`;

      const before = newMessage.slice(0, triggerIndex);
      const after = newMessage.slice(caretPosition);
      const updatedMessage = `${before}${mentionText} ${after}`;

      setNewMessage(updatedMessage);
      trackTyping(updatedMessage);
      clearMentionState();

      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          const newCaret = before.length + mentionText.length + 1;
          textarea.setSelectionRange(newCaret, newCaret);
        }
      });
    },
    [
      mentionType,
      mentionCaretPosition,
      mentionTriggerIndex,
      newMessage,
      trackTyping,
      clearMentionState,
    ]
  );

  const handleMentionHover = useCallback((index) => {
    setMentionHighlightIndex(index);
  }, []);

  const handleMessageKeyDown = useCallback(
    (event) => {
      if (showMentionSuggestions && mentionSuggestions.length > 0) {
        if (event.key === "ArrowDown" || event.key === "Tab") {
          event.preventDefault();
          setMentionHighlightIndex((prev) => (prev + 1) % mentionSuggestions.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setMentionHighlightIndex((prev) =>
            prev - 1 < 0 ? mentionSuggestions.length - 1 : prev - 1
          );
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          handleMentionSelect(mentionSuggestions[mentionHighlightIndex] || mentionSuggestions[0]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          clearMentionState();
          return;
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [
      showMentionSuggestions,
      mentionSuggestions,
      mentionHighlightIndex,
      handleMentionSelect,
      clearMentionState,
      handleSendMessage,
    ]
  );

  const handleRemoveAttachment = useCallback(() => {
    removeFile();
    clearRecording();
    clearCapturedFile();
  }, [removeFile, clearRecording, clearCapturedFile]);

  const handleNotificationPick = (notification) => {
    handleNotificationSelect(notification, handleSelectChannel, setActiveThreadId);
  };

  const openUserSearch = () => {
    setShowUserSearchModal(true);
    setDmUserSearchQuery("");
    if (token) dispatch(searchUsers({ token, query: "" }));
  };

  const handleSelectUserForDM = async (selectedUser) => {
    if (!token || !selectedUser) return;
    const existing = channels.find((channel) => {
      if (!channel.is_private) return false;
      const metadata = parseChannelTopic(channel.topic);
      if (metadata?.type === "dm" && Array.isArray(metadata.participants)) {
        return metadata.participants.some((participant) => participant.id === selectedUser.id);
      }
      return channel.name === selectedUser.username;
    });
    if (existing) {
      handleSelectChannel(existing.id);
      setShowUserSearchModal(false);
      return;
    }
    const result = await dispatch(
      createDM({ token, userId: selectedUser.id, username: selectedUser.username })
    );
    if (createDM.fulfilled.match(result)) {
      setShowUserSearchModal(false);
      setDmUserSearchQuery("");
    }
  };

  const handleNotificationPreferenceToggle = useCallback(
    (key, value) => {
      dispatch(setNotificationPreference({ key, value }));
    },
    [dispatch]
  );

  const handleResetNotificationPreferences = useCallback(() => {
    dispatch(resetNotificationPreferences());
  }, [dispatch]);

  const handleMentionNavigate = useCallback(
    async (mention) => {
      if (!mention) return;
      if (mention.type === "channel") {
        if (mention.channelId != null) {
          handleSelectChannel(mention.channelId);
        }
        return;
      }
      if (mention.type === "user") {
        const targetUserId = mention.userId;
        if (!targetUserId || targetUserId === user?.id) return;
        const existingChannelId = dmChannelByUserId.get(targetUserId);
        if (existingChannelId != null) {
          handleSelectChannel(existingChannelId);
          return;
        }
        if (!token) return;
        const username = mention.username || mention.value;
        const result = await dispatch(createDM({ token, userId: targetUserId, username }));
        if (createDM.fulfilled.match(result)) {
          handleSelectChannel(result.payload.id);
        }
      }
    },
    [handleSelectChannel, dmChannelByUserId, dispatch, token, user?.id]
  );

  const renderMessageProps = useCallback(
    (msg) => {
      // Determine recipients and read status for WhatsApp-style ticks
      const isOwn = msg.user_id != null ? msg.user_id === user?.id : msg.username === user?.username;
      let hasRecipientOnline = false;
      let isRead = false;

      if (isOwn && activeChannelId) {
        // Get channel members (recipients)
        const channelMembers = membersByChannel[activeChannelId] || [];
        const recipients = channelMembers
          .map((m) => m.id)
          .filter((memberId) => memberId !== msg.user_id);

        if (recipients.length > 0) {
          // Check if all recipients have read the message
          const readBy = msg.readBy || [];
          isRead = recipients.every((recipientId) => readBy.includes(recipientId));

          // For delivered status (two ticks):
          // Once a message shows two ticks, it should NEVER go back to one tick
          // Message is considered "delivered" (show two ticks) if:
          // 1. It has been read (definitely delivered - stays two ticks forever, colored)
          // 2. It was previously delivered (wasDelivered flag is true)
          // 3. Any recipient is currently online (delivered now - show two ticks)
          
          const anyRecipientOnline = recipients.some((recipientId) =>
            onlineUserIds.includes(recipientId)
          );
          
          // Check if message was ever delivered (showed 2 ticks before)
          const wasDelivered = msg.wasDelivered === true;
          
          // Message is delivered (show two ticks) if:
          // - It has been read (always show two ticks, colored when all read)
          // - It was previously delivered (wasDelivered flag)
          // - Recipient is currently online (show two light ticks)
          hasRecipientOnline = isRead || wasDelivered || anyRecipientOnline;
        }
      }

      return {
        isOwn,
      onEdit: () => handleStartEdit(msg),
      onDelete: () => deleteMsg(msg),
        onThreadOpen: () => handleOpenThread(msg),
      isEditing: editingMessageId === msg.id,
      editingText,
      onEditChange: setEditingText,
      onSaveEdit: handleSaveEditMessage,
      onCancelEdit: handleCancelEdit,
      isUpdating: updatingMessageId === msg.id,
      isDeleting: deletingMessageId === msg.id,
      threadCount: threadCounts[msg.id] || 0,
      showThreadActions: true,
      onlineUserIds,
      error: messageActionError,
      showError: messageActionErrorId === msg.id,
      timestamp: msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "",
      mentionEntities: buildMentionEntitiesForMessage(msg),
      onMentionClick: handleMentionNavigate,
      onToggleReaction: (messageId, emoji) => toggleReaction(messageId, emoji, activeChannelId),
      currentUserId: user?.id,
      channelId: activeChannelId,
        hasRecipientOnline,
        isRead,
      editAttachmentProps: {
        mode: editingAttachmentMode,
        initialAttachment: editingInitialAttachment,
        newFile: editSelectedFile,
        previewUrl: editPreviewUrl,
        uploadError: editUploadError,
        isUploading: editIsUploading,
        isRecording: editIsRecording,
        recordingTime: editRecordingTime,
        recordingError: editRecordingError,
        onOpenFilePicker: () => editFileInputRef.current?.click(),
        onOpenCamera: openEditCamera,
        onToggleRecording: toggleEditRecording,
        onToggleEmoji: () => handleToggleEmojiFor("edit"),
        onRemoveNewFile: handleEditRemoveNewAttachment,
        onFileChange: handleEditFileChange,
        onRemoveExisting: handleRemoveExistingAttachment,
        onRestoreExisting: handleRestoreExistingAttachment,
      },
      editFileInputRef,
      };
    },
    [
      user?.id,
      user?.username,
      handleStartEdit,
      deleteMsg,
      openThread,
      editingMessageId,
      editingText,
      setEditingText,
      handleSaveEditMessage,
      handleCancelEdit,
      threadCounts,
      onlineUserIds,
      messageActionError,
      messageActionErrorId,
      updatingMessageId,
      deletingMessageId,
      buildMentionEntitiesForMessage,
      handleMentionNavigate,
      editingAttachmentMode,
      editingInitialAttachment,
      editSelectedFile,
      editPreviewUrl,
      editUploadError,
      editIsUploading,
      editIsRecording,
      editRecordingTime,
      editRecordingError,
      editFileInputRef,
      openEditCamera,
      toggleEditRecording,
      handleToggleEmojiFor,
      handleEditRemoveNewAttachment,
      handleEditFileChange,
      handleRemoveExistingAttachment,
      handleRestoreExistingAttachment,
      toggleReaction,
      activeChannelId,
      membersByChannel,
    ]
  );

  // if (!isHydrated) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400">
  //       <div className="flex flex-col items-center gap-4 text-white">
  //         <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/40 border-t-white" />
  //         <p className="text-xs sm:text-sm font-medium tracking-wide opacity-90">
  //           Loading your workspace...
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // Show loading state while checking authentication
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400">
        <div className="flex flex-col items-center gap-4 text-white">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/40 border-t-white" />
          <p className="text-xs sm:text-sm font-medium tracking-wide opacity-90">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated (handled by useEffect above)
  if (!isAuthenticated) {
    return null;
  }

  const mainContent = (
    <>
      <ChatHeader
        onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        channelName={activeChannel?.displayName}
        channelTopic={activeChannel?.topic}
        isPrivate={activeChannel?.is_private}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onOpenSettings={openSettingsWithLimit}
        onOpenProfile={handleOpenProfile}
        onOpenRoomBooking={handleOpenRoomBooking}
        onLogout={() => {
          dispatch(logout());
          dispatch(clearMessages());
          dispatch(setActiveChannel(null));
          dispatch(clearChannelError());
          setIsMobileSidebarOpen(false);
        }}
        isInCall={isInCall}
        hasActiveCall={Boolean(activeCalls[activeChannelId || ""])}
        isCallInActiveChannel={callChannelId == null || callChannelId === activeChannelId}
        onStartCall={callActions.startCall}
        onJoinCall={callActions.joinCall}
        onEndCall={() => callActions.endCall(callChannelId)}
        isCallPanelVisible={showCallPanel}
        onReopenCallPanel={handleReopenCallPanel}
        hasIncomingCall={Boolean(incomingCall && incomingCall.channelId === activeChannelId)}
        unreadNotifications={unreadNotificationCount}
        onNotificationClick={handleToggleNotifications}
        notificationAnchorRef={notificationButtonRef}
        onCallHistoryClick={handleToggleCallHistory}
        callHistoryAnchorRef={callHistoryButtonRef}
      />

      <MessageList
        messages={rootMessages}
        isLoading={channelsLoading}
        error={chatError}
        onDismissError={() => dispatch(clearChatError())}
        typingUsers={typingNames}
        renderMessageProps={renderMessageProps}
        lastReadTimestamp={activeChannelId != null ? (lastReadTimestampByChannel[String(activeChannelId)] || null) : null}
        currentUserId={user?.id}
      />

      <ChatFooter
        message={newMessage}
        onMessageChange={handleMessageInputChange}
        onKeyDown={handleMessageKeyDown}
        onSend={handleSendMessage}
        isDisabled={sendingMessage || isUploading || isRecording}
        isSending={sendingMessage}
        isRecording={isRecording}
        recordingTime={recordingTime}
        onToggleRecording={toggleRecording}
        onOpenCamera={() => {
          openCamera();
          dispatch(setShowEmoji(false));
          clearMentionState();
        }}
        onOpenFilePicker={() => fileInputRef.current?.click()}
        onToggleEmoji={() => {
          handleToggleEmojiFor("main");
          clearMentionState();
        }}
        typingUsers={typingNames}
        inputRef={messageInputRef}
        showMentionSuggestions={showMentionSuggestions}
        mentionSuggestions={mentionSuggestions}
        mentionHighlightIndex={mentionHighlightIndex}
        onMentionSelect={handleMentionSelect}
        onMentionHover={handleMentionHover}
      />
    </>
  );

  // Calculate panel positions for side-by-side display
  // Order from right to left: Profile > Settings > Notifications > Call History > Room Booking > Thread
  const panelOrder = {
    profile: showProfileSidebar,
    settings: showChannelSettings,
    notifications: showNotifications,
    callHistory: showCallHistory,
    roomBooking: showRoomBooking,
    thread: Boolean(activeThreadId),
  };
  
  // Calculate position index for each panel (0 = rightmost, 1 = second from right, etc.)
  const getPanelPosition = (panelName) => {
    const order = ['profile', 'settings', 'notifications', 'callHistory', 'roomBooking', 'thread'];
    const openPanels = order.filter(name => panelOrder[name]);
    const index = openPanels.indexOf(panelName);
    return index >= 0 ? index : -1;
  };
  
  const threadPosition = getPanelPosition('thread');
  const roomBookingPosition = getPanelPosition('roomBooking');
  const notificationsPosition = getPanelPosition('notifications');
  const callHistoryPosition = getPanelPosition('callHistory');
  const settingsPosition = getPanelPosition('settings');
  const profilePosition = getPanelPosition('profile');

  return (
    <ChatLayout
      theme={theme}
      hasThreadPanel={Boolean(activeThreadId)}
      hasNotificationPanel={showNotifications}
      hasCallHistoryPanel={showCallHistory}
      hasRoomBookingPanel={showRoomBooking}
      hasSettingsPanel={showChannelSettings}
      hasProfilePanel={showProfileSidebar}
      sidebar={
      <ChannelSidebar
        channels={channelsWithDisplay}
        activeChannelId={activeChannelId}
        isLoading={channelsLoading}
        error={channelsError}
        showForm={showChannelForm}
        onToggleForm={toggleChannelForm}
        onSelectChannel={(id) => {
          handleSelectChannel(id);
          setIsMobileSidebarOpen(false);
        }}
        onOpenDM={openUserSearch}
        form={{
          name: newChannelName,
          topic: newChannelTopic,
          isPrivate: newChannelPrivate,
          onNameChange: setNewChannelName,
          onTopicChange: setNewChannelTopic,
          onTogglePrivate: toggleChannelPrivate,
          onSubmit: submitChannelForm,
          creating: creatingChannel,
          formError: channelFormError,
          userSearchQuery: channelUserSearchQuery,
          onUserSearchChange: setChannelUserSearch,
          findingUsers,
          userSearchError,
          availableUsers,
          selectedMembersDisplay,
          selectedMemberIds,
          onToggleMember: toggleChannelMember,
        }}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onMobileSidebarToggle={() => setIsMobileSidebarOpen(false)}
        onlineUserIds={onlineUserIds}
        currentUserId={user?.id}
      />
      }
      main={mainContent}
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={(event) => handleFileSelect(event.target.files?.[0])}
      />

      {showEmoji && (
        <div ref={emojiPickerRef} className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40">
          <Picker
            data={data}
            onEmojiSelect={(emoji) => {
              if (emojiTarget === "thread") {
                setThreadDraft((prev) => (prev || "") + emoji.native);
              } else if (emojiTarget === "edit") {
                setEditingText((prev) => (prev || "") + emoji.native);
              } else {
                setNewMessage((prev) => prev + emoji.native);
              }
              dispatch(setShowEmoji(false));
            }}
          />
            </div>
      )}

      <NotificationDropdown
        notifications={notifications}
        onClose={handleToggleNotifications}
        onSelect={handleNotificationPick}
        onRemove={handleNotificationRemove}
        onMarkAllRead={handleMarkAllNotificationsReadClick}
        anchorRef={notificationButtonRef}
        preferences={notificationPreferences}
        onPreferenceToggle={handleNotificationPreferenceToggle}
        onResetPreferences={handleResetNotificationPreferences}
        isOpen={showNotifications}
        panelPosition={notificationsPosition}
      />

      <CallHistoryDropdown
        calls={callHistory}
        isLoading={callHistoryLoading}
        error={callHistoryError}
        isOpen={showCallHistory}
        onClose={handleToggleCallHistory}
        onCallUser={handleCallUser}
        onRemoveCall={handleRemoveCallFromHistory}
        onRefresh={handleCallHistoryRefresh}
        currentUserId={user?.id}
        panelPosition={callHistoryPosition}
      />

      <AttachmentPreview file={selectedFile} previewUrl={previewUrl} onRemove={handleRemoveAttachment} />
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={closeCamera}
        onCapture={capturePhoto}
        videoRef={videoRef}
        error={cameraError}
      />
      <CameraCapture
        isOpen={isEditCameraOpen}
        onClose={closeEditCamera}
        onCapture={captureEditPhoto}
        videoRef={editVideoRef}
        error={editCameraError}
      />
      <CameraCapture
        isOpen={isThreadCameraOpen}
        onClose={closeThreadCamera}
        onCapture={captureThreadPhoto}
        videoRef={threadVideoRef}
        error={threadCameraError}
      />

      {incomingCall && (
        <IncomingCallNotification
          incomingCall={incomingCall}
          channel={incomingCall?.channelId ? channelsById[incomingCall.channelId] : null}
          onJoin={callActions.joinCall}
          onDecline={callActions.declineCall}
        />
      )}

      {showCallPanel && (
        <CallPanel socket={socket} channel={activeChannel} />
      )}

      {activeThreadRoot && (
        <ThreadPanel
          rootMessage={activeThreadRoot}
          replies={activeMessages.filter((msg) => msg.thread_parent_id === activeThreadId)}
          currentUser={user}
          editingMessageId={editingMessageId}
          editingMessageText={editingText}
          onChangeEditingText={setEditingText}
          updatingMessageId={updatingMessageId}
          deletingMessageId={deletingMessageId}
          onStartEditing={handleStartEdit}
          onCancelEditing={handleCancelEdit}
          onSaveEditing={handleSaveEditMessage}
          onDeleteMessage={deleteMsg}
          onReply={handleThreadReplySend}
          replyDraft={threadDraft}
          onChangeReplyDraft={setThreadDraft}
          isSending={sendingMessage}
          threadError={threadError}
          onClose={closeThread}
          isOpen={Boolean(activeThreadId)}
          resolveMentionEntities={buildMentionEntitiesForMessage}
          onMentionClick={handleMentionNavigate}
          onToggleReaction={(messageId, emoji) => toggleReaction(messageId, emoji, activeChannelId)}
          channelId={activeChannelId}
          panelPosition={threadPosition}
          attachmentControls={{
            onOpenFilePicker: () => threadFileInputRef.current?.click(),
            onOpenCamera: openThreadCamera,
            onToggleRecording: toggleThreadRecording,
            onToggleEmoji: () => handleToggleEmojiFor("thread"),
            isRecording: threadIsRecording,
            recordingTime: threadRecordingTime,
            isDisabled: threadIsUploading || sendingMessage,
          }}
          attachmentState={{
            file: threadSelectedFile,
            previewUrl: threadPreviewUrl,
            uploadError: threadUploadError,
            isUploading: threadIsUploading,
            recordingError: threadRecordingError,
          }}
          onAttachmentRemove={handleThreadRemoveAttachment}
          onThreadFileChange={(event) => handleThreadFileChange(event.target.files?.[0])}
          threadFileInputRef={threadFileInputRef}
        />
      )}

      <UserSearchModal
        isOpen={showUserSearchModal}
        onClose={() => setShowUserSearchModal(false)}
        onSelectUser={handleSelectUserForDM}
        availableUsers={availableUsers}
        findingUsers={findingUsers}
        userSearchError={userSearchError}
        searchQuery={dmUserSearchQuery}
        onSearchChange={setDmUserSearchQuery}
        onlineUserIds={onlineUserIds}
      />

        <ChannelSettingsModal
        isOpen={showChannelSettings}
          channel={activeChannel}
        onClose={closeSettings}
        isDirectMessageChannel={isDirectMessageChannel}
        settingsName={settingsName}
        settingsTopic={settingsTopic}
        settingsPrivate={settingsPrivate}
        onChangeName={setSettingsName}
        onChangeTopic={setSettingsTopic}
        onChangePrivate={setSettingsPrivate}
        onSubmit={submitChannelSettings}
        canEditChannel={canEditChannel}
        canEditPrivacy={canEditChannel}
        canManageMembers={canManageMembers}
        canLeaveChannel={canLeaveChannel}
        onLeave={leaveChannel}
        isLeaving={false}
        errors={settingsError ? [settingsError] : []}
        members={activeMembers}
        membersLoading={membersLoadingState}
        currentUserId={user?.id}
        onRemoveMember={onRemoveMember}
        removingMemberId={null}
        availableUsers={availableUsers}
        settingsUserQuery={settingsUserQuery}
        onSettingsUserQueryChange={setSettingsUserQuery}
        settingsSelectedMembersDisplay={settingsSelectedMembersDisplay}
        onToggleSettingsSelected={toggleSettingsSelected}
        onInviteMembers={onAddMembers}
        addingMembers={false}
        addMembersError={null}
        findingUsers={findingUsers}
        userSearchError={userSearchError}
        updatingChannel={false}
        onClearChat={handleClearChat}
        isClearingChat={isClearingChat}
        panelPosition={settingsPosition}
      />

      <ProfileSidebar
        isOpen={showProfileSidebar}
        onClose={() => setShowProfileSidebar(false)}
        user={user}
        onLogout={() => {
          dispatch(logout());
          dispatch(clearMessages());
          dispatch(setActiveChannel(null));
          dispatch(clearChannelError());
          setIsMobileSidebarOpen(false);
        }}
        onOpenSettings={openSettingsWithLimit}
        onlineUserIds={onlineUserIds}
        panelPosition={profilePosition}
      />

      <RoomBookingSidebar
        isOpen={showRoomBooking}
        onClose={() => setShowRoomBooking(false)}
        panelPosition={roomBookingPosition}
      />
    </ChatLayout>
  );
}