// hooks/useChannelForm.js
import { useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { createChannel, clearChannelError, resetSelectedMembers, addSelectedMember, removeSelectedMember } from "../store/slices/channelSlice";

export default function useChannelForm(token, selectedMemberIds) {
  const dispatch = useDispatch();
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [error, setError] = useState("");

  const resetForm = useCallback(() => {
    setNewChannelName("");
    setNewChannelTopic("");
    setNewChannelPrivate(false);
    setUserSearchQuery("");
    setError("");
    dispatch(resetSelectedMembers());
  }, [dispatch]);

  const toggleForm = useCallback(() => {
    setShowChannelForm((prev) => {
      const next = !prev;
      dispatch(clearChannelError());
      setError("");
      if (!next) {
        resetForm();
      }
      return next;
    });
  }, [dispatch, resetForm]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!token) return;

    if (!newChannelName.trim()) {
      setError("Channel name is required");
      return;
    }

    if (newChannelPrivate && selectedMemberIds.length === 0) {
      setError("Select at least one member for a private channel");
      return;
    }

    const result = await dispatch(
      createChannel({
        token,
        name: newChannelName.trim(),
        topic: newChannelTopic.trim(),
        isPrivate: newChannelPrivate,
        memberIds: selectedMemberIds,
      })
    );

    if (createChannel.fulfilled.match(result)) {
      resetForm();
      setShowChannelForm(false);
    } else if (createChannel.rejected.match(result)) {
      setError(result.payload || "Failed to create channel");
    }
  }, [token, newChannelName, newChannelTopic, newChannelPrivate, selectedMemberIds, dispatch, resetForm]);

  const handleToggleMember = useCallback((memberId) => {
    if (selectedMemberIds.includes(memberId)) {
      dispatch(removeSelectedMember(memberId));
    } else {
      dispatch(addSelectedMember(memberId));
    }
  }, [selectedMemberIds, dispatch]);

  const handleTogglePrivate = useCallback((checked) => {
    setNewChannelPrivate(checked);
    if (!checked) {
      dispatch(resetSelectedMembers());
      setUserSearchQuery("");
    }
  }, [dispatch]);

  return {
    showChannelForm,
    toggleForm,
    name: newChannelName,
    topic: newChannelTopic,
    isPrivate: newChannelPrivate,
    userSearchQuery,
    error,
    onNameChange: setNewChannelName,
    onTopicChange: setNewChannelTopic,
    onTogglePrivate: handleTogglePrivate,
    onUserSearchChange: setUserSearchQuery,
    onSubmit: handleSubmit,
    onToggleMember: handleToggleMember,
  };
}

