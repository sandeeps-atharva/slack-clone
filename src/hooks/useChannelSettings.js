// hooks/useChannelSettings.js
import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { updateChannel, leaveChannel, removeChannelMember, addChannelMembers, clearChannelError } from "../store/slices/channelSlice";

export default function useChannelSettings(token, activeChannelId, canLeaveChannel) {
  const dispatch = useDispatch();
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsTopic, setSettingsTopic] = useState("");
  const [settingsPrivate, setSettingsPrivate] = useState(false);
  const [error, setError] = useState(null);
  const [settingsUserQuery, setSettingsUserQuery] = useState("");
  const [settingsSelectedUserIds, setSettingsSelectedUserIds] = useState([]);

  const openSettings = useCallback(() => {
    if (!activeChannelId) return;
    dispatch(clearChannelError());
    setShowChannelSettings(true);
  }, [activeChannelId, dispatch]);

  const closeSettings = useCallback(() => {
    setShowChannelSettings(false);
    setError(null);
    setSettingsUserQuery("");
    setSettingsSelectedUserIds([]);
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!token || !activeChannelId) return;

    const trimmedName = settingsName.trim();
    if (!trimmedName) {
      setError("Channel name cannot be empty");
      return;
    }

    const result = await dispatch(
      updateChannel({
        token,
        channelId: activeChannelId,
        name: trimmedName,
        topic: settingsTopic,
        isPrivate: settingsPrivate,
      })
    );

    if (updateChannel.fulfilled.match(result)) {
      setShowChannelSettings(false);
      setError(null);
    } else if (updateChannel.rejected.match(result)) {
      setError(result.payload || "Failed to update channel");
    }
  }, [token, activeChannelId, settingsName, settingsTopic, settingsPrivate, dispatch]);

  const handleLeave = useCallback(async () => {
    if (!activeChannelId || !token) return;
    if (!canLeaveChannel) {
      setError("Transfer ownership before leaving the channel");
      return;
    }
    const confirmed = window.confirm("Leave this channel?");
    if (!confirmed) return;

    const result = await dispatch(
      leaveChannel({
        token,
        channelId: activeChannelId,
      })
    );

    if (leaveChannel.fulfilled.match(result)) {
      setShowChannelSettings(false);
      setError(null);
    } else if (leaveChannel.rejected.match(result)) {
      setError(result.payload || "Failed to leave channel");
    }
  }, [activeChannelId, token, canLeaveChannel, dispatch]);

  const handleRemoveMember = useCallback(async (memberId, username) => {
    if (!activeChannelId || !token) return;
    const confirmed = window.confirm(`Remove ${username} from this channel?`);
    if (!confirmed) return;

    const result = await dispatch(
      removeChannelMember({ token, channelId: activeChannelId, userId: memberId })
    );

    if (removeChannelMember.rejected.match(result)) {
      setError(result.payload || "Failed to remove member");
    }
  }, [activeChannelId, token, dispatch]);

  const handleAddMembers = useCallback(async () => {
    if (!token || !activeChannelId || settingsSelectedUserIds.length === 0) return;
    const result = await dispatch(
      addChannelMembers({
        token,
        channelId: activeChannelId,
        memberIds: settingsSelectedUserIds,
      })
    );

    if (addChannelMembers.fulfilled.match(result)) {
      setSettingsSelectedUserIds([]);
      setSettingsUserQuery("");
    } else if (addChannelMembers.rejected.match(result)) {
      setError(result.payload || "Failed to add members");
    }
  }, [token, activeChannelId, settingsSelectedUserIds, dispatch]);

  const handleToggleSelected = useCallback((userId) => {
    setSettingsSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  }, []);

  return {
    showChannelSettings,
    openSettings,
    closeSettings,
    name: settingsName,
    topic: settingsTopic,
    isPrivate: settingsPrivate,
    error,
    userQuery: settingsUserQuery,
    selectedUserIds: settingsSelectedUserIds,
    onNameChange: setSettingsName,
    onTopicChange: setSettingsTopic,
    onPrivateChange: setSettingsPrivate,
    onUserQueryChange: setSettingsUserQuery,
    onSubmit: handleSubmit,
    onLeave: handleLeave,
    onRemoveMember: handleRemoveMember,
    onAddMembers: handleAddMembers,
    onToggleSelected: handleToggleSelected,
  };
}


