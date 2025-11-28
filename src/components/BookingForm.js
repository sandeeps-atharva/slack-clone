import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, Calendar, Clock, Users, FileText, XCircle } from "lucide-react";
import { fetchRooms } from "../store/slices/roomSlice";
import { createBooking, updateBooking, checkAvailability } from "../store/slices/bookingSlice";
import { searchUsers } from "../store/slices/channelSlice";

// Predefined list of booking purposes
const BOOKING_PURPOSES = [
  "Team Meeting",
  "Client Meeting",
  "Project Discussion",
  "Internal / Project Discussion",
  "Interview",
  "Training Session",
  "Workshop",
  "Conference Call",
  "Presentation",
  "Review Meeting",
  "Planning Session",
  "Stand-up Meeting",
  "One-on-One",
  "Board Meeting",
  "Sales Meeting",
  "HR Meeting",
  "Technical Discussion",
  "Design Review",
  "Code Review",
  "Other",
];

export default function BookingForm({
  isOpen,
  onClose,
  onSuccess,
  initialBooking = null,
  panelPosition = 0,
}) {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const { rooms } = useSelector((state) => state.rooms);
  const { availability, isLoading } = useSelector((state) => state.bookings);
  const { availableUsers, findingUsers } = useSelector((state) => state.channels);
  const [formData, setFormData] = useState({
    room_id: "",
    purpose: "",
    description: "",
    start_time: "",
    end_time: "",
    participants: [], // Array of user IDs
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAvailabilityCheck, setShowAvailabilityCheck] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchRooms());
      // Fetch all users from users table for participant selection
      // This calls /api/users which queries the users table
      if (token) {
        dispatch(searchUsers({ token, query: "" }));
      }
      if (initialBooking) {
        // Convert participants to array of IDs - handle all possible formats
        let participantIds = [];
        
        // Try to get participants from different possible fields
        const participantsData = initialBooking.participants || initialBooking.participants_json;
        
        if (participantsData) {
          if (Array.isArray(participantsData)) {
            // Already an array - extract IDs
            participantIds = participantsData
              .map(id => {
                // If it's an object with id property, extract the id
                if (typeof id === 'object' && id !== null && id.id) {
                  return id.id;
                }
                // Otherwise use the value directly
                return id;
              })
              .filter(id => id != null && !isNaN(id))
              .map(id => Number(id));
          } else if (typeof participantsData === 'string') {
            try {
              const parsed = JSON.parse(participantsData);
              if (Array.isArray(parsed)) {
                participantIds = parsed
                  .map(id => typeof id === 'object' && id !== null && id.id ? id.id : id)
                  .filter(id => id != null && !isNaN(id))
                  .map(id => Number(id));
              } else if (parsed != null) {
                participantIds = [Number(parsed)].filter(id => !isNaN(id));
              }
            } catch (e) {
              console.error('Error parsing participants for edit:', e);
            }
          } else if (typeof participantsData === 'number') {
            participantIds = [participantsData];
          }
        }
        
        // If we have participantDetails but no participants array, extract IDs from details
        if (participantIds.length === 0 && initialBooking.participantDetails && Array.isArray(initialBooking.participantDetails)) {
          participantIds = initialBooking.participantDetails
            .map(p => p.id)
            .filter(id => id != null && !isNaN(id))
            .map(id => Number(id));
        }
        
        // Debug log (can be removed in production)
        if (participantIds.length > 0) {
          console.log('Edit Booking - Participants loaded:', {
            rawParticipants: initialBooking.participants,
            rawParticipantDetails: initialBooking.participantDetails,
            normalizedIds: participantIds
          });
        }
        
        // Convert dates to local time format for datetime-local input
        // datetime-local expects format: YYYY-MM-DDTHH:mm in local timezone
        const formatDateForInput = (dateString) => {
          if (!dateString) return "";
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return "";
          
          // Get local date components
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        setFormData({
          room_id: initialBooking.room_id.toString(),
          purpose: initialBooking.purpose,
          description: initialBooking.description || "",
          start_time: formatDateForInput(initialBooking.start_time),
          end_time: formatDateForInput(initialBooking.end_time),
          participants: participantIds,
        });
      } else {
        setFormData({
          room_id: "",
          purpose: "",
          description: "",
          start_time: "",
          end_time: "",
          participants: [],
        });
      }
      setErrors({});
      setShowAvailabilityCheck(false);
      setParticipantSearchQuery("");
      setShowParticipantDropdown(false);
    }
  }, [isOpen, initialBooking, dispatch, token]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
    setShowAvailabilityCheck(false);
  };

  const handleCheckAvailability = async () => {
    if (!formData.room_id || !formData.start_time || !formData.end_time) {
      setErrors({
        room_id: !formData.room_id ? "Please select a room" : "",
        start_time: !formData.start_time ? "Start time is required" : "",
        end_time: !formData.end_time ? "End time is required" : "",
      });
      return;
    }

    const startTime = new Date(formData.start_time).toISOString();
    const endTime = new Date(formData.end_time).toISOString();

    await dispatch(
      checkAvailability({
        room_id: parseInt(formData.room_id),
        start_time: startTime,
        end_time: endTime,
      })
    );
    setShowAvailabilityCheck(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors = {};
    if (!formData.room_id) newErrors.room_id = "Room is required";
    if (!formData.purpose) newErrors.purpose = "Purpose is required";
    if (!formData.start_time) newErrors.start_time = "Start time is required";
    if (!formData.end_time) newErrors.end_time = "End time is required";

    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      const now = new Date();
      
      if (start >= end) {
        newErrors.end_time = "End time must be after start time";
      }
      
      // Only validate "cannot book in past" if:
      // 1. Creating a new booking (no initialBooking)
      // 2. OR updating the start time (start time changed from original)
      const isStartTimeChanged = initialBooking && 
        new Date(initialBooking.start_time).getTime() !== start.getTime();
      
      if (!initialBooking || isStartTimeChanged) {
        // For new bookings or when start time is changed, don't allow past start times
        if (start < now) {
          newErrors.start_time = "Cannot book rooms in the past";
        }
      } else {
        // For extending meetings (only end time changed), allow past start times
        // But ensure end time is in the future
        if (end < now) {
          newErrors.end_time = "End time must be in the future";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const bookingData = {
        room_id: parseInt(formData.room_id),
        purpose: formData.purpose,
        description: formData.description || null,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        participants: formData.participants.length > 0 
          ? formData.participants.map(id => parseInt(id)).filter(id => !isNaN(id))
          : null,
      };

      let result;
      if (initialBooking) {
        result = await dispatch(updateBooking({ bookingId: initialBooking.id, bookingData }));
      } else {
        result = await dispatch(createBooking(bookingData));
      }

      // Check if there was an error
      if (result.type && result.type.endsWith('/rejected')) {
        throw new Error(result.payload || "Failed to save booking");
      }

      onSuccess();
    } catch (error) {
      setErrors({ submit: error.message || "Failed to save booking" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoized filtered users list that updates when formData.participants changes
  const filteredAvailableUsers = useMemo(() => {
    const participantIds = Array.isArray(formData.participants) 
      ? formData.participants.map(id => Number(id))
      : [];
    const currentUserId = user?.id ? Number(user.id) : null;
    
    return availableUsers.filter((u) => {
      const userId = Number(u.id);
      return userId !== currentUserId && !participantIds.includes(userId);
    });
  }, [availableUsers, formData.participants, user?.id]);

  if (!isOpen) return null;

  const rightOffset = panelPosition * 28;
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full"
        style={rightStyle}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {initialBooking ? "Edit Booking" : "Book a Room"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Room Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Room
            </label>
            <select
              value={formData.room_id}
              onChange={(e) => handleChange("room_id", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.room_id ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              disabled={!!initialBooking}
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} {room.floor ? `(${room.floor})` : ""} - Capacity: {room.capacity}
                </option>
              ))}
            </select>
            {errors.room_id && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.room_id}</p>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Purpose
            </label>
            <select
              value={formData.purpose}
              onChange={(e) => handleChange("purpose", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.purpose ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
            >
              <option value="">Select a purpose</option>
              {BOOKING_PURPOSES.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {purpose}
                </option>
              ))}
            </select>
            {errors.purpose && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.purpose}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Additional details about the meeting..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Start Time
            </label>
            <input
              type="datetime-local"
              value={formData.start_time}
              onChange={(e) => handleChange("start_time", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.start_time ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
            />
            {errors.start_time && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.start_time}</p>
            )}
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              End Time
            </label>
            <input
              type="datetime-local"
              value={formData.end_time}
              onChange={(e) => handleChange("end_time", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.end_time ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
            />
            {errors.end_time && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.end_time}</p>
            )}
          </div>

          {/* Availability Check */}
          {formData.room_id && formData.start_time && formData.end_time && (
            <div>
              <button
                type="button"
                onClick={handleCheckAvailability}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {isLoading ? "Checking..." : "Check Availability"}
              </button>
              {showAvailabilityCheck && availability && (
                <div
                  className={`mt-2 p-3 rounded-lg ${
                    availability.available
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  }`}
                >
                  {availability.available ? (
                    <p className="text-sm">✓ Room is available for this time slot</p>
                  ) : (
                    <p className="text-sm">
                      ✗ Room is not available. {availability.conflicting_bookings} conflicting
                      booking(s) found.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Participants (Multi-select) */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Participants (Optional)
            </label>
            
            {/* Selected Participants Display */}
            {formData.participants.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.participants.map((participantId) => {
                  const participant = availableUsers.find((u) => u.id === participantId);
                  // Show participant even if user data not loaded yet
                  return (
                    <span
                      key={participantId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm"
                    >
                      {participant ? participant.username : `User ${participantId}`}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentId = Number(participantId);
                          setFormData((prevFormData) => ({
                            ...prevFormData,
                            participants: prevFormData.participants
                              .map(id => Number(id))
                              .filter((id) => id !== currentId)
                          }));
                        }}
                        className="hover:text-purple-900 dark:hover:text-purple-100"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Participant Search Input - Users fetched from users table via /api/users */}
            <div className="relative">
              <input
                type="text"
                value={participantSearchQuery}
                onChange={(e) => {
                  setParticipantSearchQuery(e.target.value);
                  // Search users from users table
                  if (token) {
                    dispatch(searchUsers({ token, query: e.target.value }));
                  }
                  setShowParticipantDropdown(true);
                }}
                onFocus={() => setShowParticipantDropdown(true)}
                placeholder="Search users from database..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              
              {/* Dropdown with users from users table */}
              {showParticipantDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowParticipantDropdown(false);
                    }}
                  />
                  <div 
                    className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {findingUsers ? (
                      <div className="p-3 text-center text-sm text-gray-500">Searching users...</div>
                    ) : filteredAvailableUsers.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">
                        {availableUsers.length === 0 ? "No users found in database" : "No more users to add"}
                      </div>
                    ) : (
                      <div className="py-1">
                        {filteredAvailableUsers.map((userOption) => (
                          <button
                            key={userOption.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newParticipantId = Number(userOption.id);
                              // Use functional update to ensure we have the latest state
                              setFormData((prevFormData) => {
                                const currentParticipants = Array.isArray(prevFormData.participants) 
                                  ? prevFormData.participants.map(id => Number(id))
                                  : [];
                                
                                if (!currentParticipants.includes(newParticipantId)) {
                                  return {
                                    ...prevFormData,
                                    participants: [...currentParticipants, newParticipantId]
                                  };
                                }
                                return prevFormData;
                              });
                              // Clear search query
                              setParticipantSearchQuery("");
                              // Keep dropdown open for multiple selections
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center gap-2"
                          >
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-300 font-semibold text-sm">
                              {userOption.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 dark:text-gray-100 truncate">
                                {userOption.username}
                              </div>
                              {userOption.email && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {userOption.email}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Search and select users to add as participants
            </p>
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : initialBooking ? "Update Booking" : "Book Room"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}