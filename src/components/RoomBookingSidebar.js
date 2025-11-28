import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, Calendar, Plus, Clock, Users, MapPin, Edit2, Trash2, Settings } from "lucide-react";
import { fetchRooms, updateRoom, deleteRoom, createRoom } from "../store/slices/roomSlice";
import { fetchBookings, cancelBooking } from "../store/slices/bookingSlice";
import BookingForm from "./BookingForm";
import RoomForm from "./RoomForm";

export default function RoomBookingSidebar({
  isOpen,
  onClose,
  panelPosition = 0,
}) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { rooms, isLoading: roomsLoading } = useSelector((state) => state.rooms);
  const { bookings, upcomingBookings, isLoading: bookingsLoading } = useSelector((state) => state.bookings);
  console.log("upcomingBookings", upcomingBookings);
  
  // Calculate occupied/active bookings (currently running)
  const occupiedBookings = bookings.filter((booking) => {
    if (booking.status !== 'confirmed') return false;
    const now = new Date();
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    return now >= start && now <= end;
  });
  
  // Calculate completed bookings (past end time but still confirmed)
  const completedBookings = bookings.filter((booking) => {
    if (booking.status !== 'confirmed') return false;
    const now = new Date();
    const end = new Date(booking.end_time);
    return now > end;
  });
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming"); // "upcoming", "occupied", or "rooms"
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchRooms());
      // Fetch all confirmed bookings (not just upcoming) to show occupied and completed
      dispatch(fetchBookings({ status: "confirmed" }));
    }
  }, [dispatch, isOpen]);
  
  // Auto-refresh bookings every minute to update occupied status
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      dispatch(fetchBookings({ status: "confirmed" }));
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [dispatch, isOpen]);

  const handleCreateBooking = () => {
    setSelectedBooking(null);
    setShowBookingForm(true);
  };

  const handleEditBooking = (booking) => {
    setSelectedBooking(booking);
    setShowBookingForm(true);
  };

  const handleCancelBooking = async (bookingId) => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      await dispatch(cancelBooking(bookingId));
      dispatch(fetchBookings({ status: "confirmed" }));
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getTimeUntil = (dateString) => {
    const now = new Date();
    const bookingTime = new Date(dateString);
    const diff = bookingTime - now;
    
    if (diff < 0) return "Past";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? "s" : ""}`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!isOpen) return null;

  const rightOffset = panelPosition * 28;
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };

  const handleCreateRoom = async (roomData) => {
    try {
      await dispatch(createRoom(roomData)).unwrap();
      dispatch(fetchRooms());
    } catch (error) {
      throw error;
    }
  };

  const handleUpdateRoom = async (roomData) => {
    try {
      await dispatch(updateRoom({ roomId: selectedRoom.id, roomData })).unwrap();
      dispatch(fetchRooms());
      dispatch(fetchBookings({ status: "confirmed" })); // Refresh bookings to show updated room names
      setSelectedRoom(null);
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm("Are you sure you want to delete this room? All future bookings for this room will be cancelled.")) {
      return;
    }
    try {
      await dispatch(deleteRoom(roomId)).unwrap();
      dispatch(fetchRooms());
      dispatch(fetchBookings({ status: "confirmed" })); // Refresh bookings
    } catch (error) {
      alert(error || "Failed to delete room");
    }
  };

  if (showRoomForm) {
    return (
      <RoomForm
        isOpen={showRoomForm}
        onClose={() => {
          setShowRoomForm(false);
          setSelectedRoom(null);
        }}
        onSuccess={selectedRoom ? handleUpdateRoom : handleCreateRoom}
        initialRoom={selectedRoom}
        panelPosition={panelPosition}
      />
    );
  }

  if (showBookingForm) {
    return (
      <BookingForm
        isOpen={showBookingForm}
        onClose={() => {
          setShowBookingForm(false);
          setSelectedBooking(null);
        }}
        onSuccess={() => {
          setShowBookingForm(false);
          setSelectedBooking(null);
          dispatch(fetchBookings({ status: "confirmed" }));
        }}
        initialBooking={selectedBooking}
        panelPosition={panelPosition}
      />
    );
  }

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full md:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-full"
        style={rightStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Room Bookings</h2>
          <div className="flex items-center gap-2">
            {activeTab === "rooms" && (
              <button
                onClick={() => {
                  setSelectedRoom(null);
                  setShowRoomForm(true);
                }}
                className="p-1.5 rounded-full text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30 transition"
                aria-label="Add Room"
                title="Add New Room"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === "upcoming"
                ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab("occupied")}
            className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition relative ${
              activeTab === "occupied"
                ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            Occupied
            {occupiedBookings.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {occupiedBookings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("rooms")}
            className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition ${
              activeTab === "rooms"
                ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            Rooms
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === "upcoming" ? (
            <div className="space-y-4">
              <button
                onClick={handleCreateBooking}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
              >
                <Plus className="w-4 h-4" />
                Book a Room
              </button>

              {bookingsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading bookings...</div>
              ) : upcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No upcoming bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => {
                    const { date, time } = formatDateTime(booking.start_time);
                    const endTime = new Date(booking.end_time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isOwner = booking.user_id === user?.id;
                    
                    // Normalize participants data - handle all possible formats
                    let participants = [];
                    if (booking.participants !== null && booking.participants !== undefined) {
                      if (Array.isArray(booking.participants)) {
                        participants = booking.participants.filter(id => id != null);
                      } else if (typeof booking.participants === 'string') {
                        try {
                          const parsed = JSON.parse(booking.participants);
                          participants = Array.isArray(parsed) ? parsed.filter(id => id != null) : [];
                        } catch (e) {
                          // If parsing fails, try to extract numbers from string
                          const numbers = booking.participants.match(/\d+/g);
                          participants = numbers ? numbers.map(Number).filter(id => !isNaN(id)) : [];
                        }
                      } else if (typeof booking.participants === 'number') {
                        participants = [booking.participants];
                      }
                    }
                    
                    // Normalize participantDetails - should be array of user objects
                    let participantDetails = [];
                    if (booking.participantDetails) {
                      if (Array.isArray(booking.participantDetails)) {
                        participantDetails = booking.participantDetails.filter(p => p && p.id);
                      }
                    }

                    return (
                      <div
                        key={booking.id}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                              {booking.room_name}
                            </h3>
                            {booking.floor && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {booking.floor}
                              </p>
                            )}
                          </div>
                          {isOwner && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditBooking(booking)}
                                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                title="Cancel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700 dark:text-gray-300 font-medium">
                            {booking.purpose}
                          </p>
                          {booking.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-xs">
                              {booking.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {date} • {time} - {endTime}
                            </span>
                          </div>
                          
                          {/* Participants Display - Show if participants exist */}
                          {participants.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Participants ({participants.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {participantDetails.length > 0 ? (
                                  // Show participant names if details are available
                                  participantDetails.map((participant) => (
                                    <span
                                      key={participant.id}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium"
                                      title={participant.email || `User ID: ${participant.id}`}
                                    >
                                      <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-500/30 flex items-center justify-center text-[10px] font-semibold text-purple-700 dark:text-purple-200">
                                        {participant.username ? participant.username.charAt(0).toUpperCase() : '?'}
                                      </span>
                                      <span>{participant.username || `User ${participant.id}`}</span>
                                    </span>
                                  ))
                                ) : (
                                  // Fallback: Show user IDs if details aren't loaded yet
                                  participants.map((participantId) => (
                                    <span
                                      key={participantId}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium"
                                    >
                                      <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-semibold">
                                        {String(participantId).charAt(0)}
                                      </span>
                                      User {participantId}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-2">
                            <span className="text-xs text-purple-600 dark:text-purple-400">
                              {getTimeUntil(booking.start_time)} until start
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === "occupied" ? (
            <div className="space-y-4">
              {/* Currently Active Bookings */}
              {occupiedBookings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Currently Active ({occupiedBookings.length})
                  </h3>
                  <div className="space-y-3">
                    {occupiedBookings.map((booking) => {
                      const { date, time } = formatDateTime(booking.start_time);
                      const endTime = new Date(booking.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isOwner = booking.user_id === user?.id;
                      
                      // Normalize participants
                      let participants = [];
                      if (booking.participants !== null && booking.participants !== undefined) {
                        if (Array.isArray(booking.participants)) {
                          participants = booking.participants.filter(id => id != null);
                        } else if (typeof booking.participants === 'string') {
                          try {
                            const parsed = JSON.parse(booking.participants);
                            participants = Array.isArray(parsed) ? parsed.filter(id => id != null) : [];
                          } catch (e) {}
                        }
                      }
                      let participantDetails = Array.isArray(booking.participantDetails) ? booking.participantDetails : [];
                      
                      // Calculate time remaining
                      const now = new Date();
                      const end = new Date(booking.end_time);
                      const remainingMs = end - now;
                      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                      const timeRemaining = remainingHours > 0 
                        ? `${remainingHours}h ${remainingMinutes}m remaining`
                        : `${remainingMinutes}m remaining`;

                      return (
                        <div
                          key={booking.id}
                          className="p-4 border-2 border-green-500 dark:border-green-400 rounded-lg bg-green-50 dark:bg-green-900/20"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                                  {booking.room_name}
                                </h3>
                                <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded">
                                  ACTIVE
                                </span>
                              </div>
                              {booking.floor && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {booking.floor}
                                </p>
                              )}
                            </div>
                            {isOwner && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditBooking(booking)}
                                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                  title="Cancel"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-sm">
                            <p className="text-gray-700 dark:text-gray-300 font-medium">
                              {booking.purpose}
                            </p>
                            {booking.description && (
                              <p className="text-gray-600 dark:text-gray-400 text-xs">
                                {booking.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {date} • {time} - {endTime}
                              </span>
                            </div>
                            
                            {/* Participants Display */}
                            {participants.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Participants ({participants.length})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {participantDetails.length > 0 ? (
                                    participantDetails.map((participant) => (
                                      <span
                                        key={participant.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium"
                                        title={participant.email || `User ID: ${participant.id}`}
                                      >
                                        <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-500/30 flex items-center justify-center text-[10px] font-semibold text-purple-700 dark:text-purple-200">
                                          {participant.username ? participant.username.charAt(0).toUpperCase() : '?'}
                                        </span>
                                        <span>{participant.username || `User ${participant.id}`}</span>
                                      </span>
                                    ))
                                  ) : (
                                    participants.map((participantId) => (
                                      <span
                                        key={participantId}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-semibold">
                                          {String(participantId).charAt(0)}
                                        </span>
                                        User {participantId}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                {timeRemaining}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Completed Bookings (still visible) */}
              {completedBookings.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Recently Completed ({completedBookings.length})
                  </h3>
                  <div className="space-y-3">
                    {completedBookings.map((booking) => {
                      const { date, time } = formatDateTime(booking.start_time);
                      const endTime = new Date(booking.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isOwner = booking.user_id === user?.id;
                      
                      // Normalize participants
                      let participants = [];
                      if (booking.participants !== null && booking.participants !== undefined) {
                        if (Array.isArray(booking.participants)) {
                          participants = booking.participants.filter(id => id != null);
                        } else if (typeof booking.participants === 'string') {
                          try {
                            const parsed = JSON.parse(booking.participants);
                            participants = Array.isArray(parsed) ? parsed.filter(id => id != null) : [];
                          } catch (e) {}
                        }
                      }
                      let participantDetails = Array.isArray(booking.participantDetails) ? booking.participantDetails : [];

                      return (
                        <div
                          key={booking.id}
                          className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 opacity-75"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                                  {booking.room_name}
                                </h3>
                                <span className="px-2 py-0.5 text-xs font-semibold bg-gray-400 text-white rounded">
                                  COMPLETED
                                </span>
                              </div>
                              {booking.floor && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {booking.floor}
                                </p>
                              )}
                            </div>
                            {isOwner && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-sm">
                            <p className="text-gray-700 dark:text-gray-300 font-medium">
                              {booking.purpose}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {date} • {time} - {endTime}
                              </span>
                            </div>
                            
                            {/* Participants Display */}
                            {participants.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Participants ({participants.length})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {participantDetails.length > 0 ? (
                                    participantDetails.map((participant) => (
                                      <span
                                        key={participant.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-500/30 flex items-center justify-center text-[10px] font-semibold">
                                          {participant.username ? participant.username.charAt(0).toUpperCase() : '?'}
                                        </span>
                                        <span>{participant.username || `User ${participant.id}`}</span>
                                      </span>
                                    ))
                                  ) : (
                                    participants.map((participantId) => (
                                      <span
                                        key={participantId}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-semibold">
                                          {String(participantId).charAt(0)}
                                        </span>
                                        User {participantId}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {occupiedBookings.length === 0 && completedBookings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No occupied or completed bookings</p>
                </div>
              )}
            </div>
          ) : activeTab === "occupied" ? (
            <div className="space-y-4">
              {/* Currently Active Bookings */}
              {occupiedBookings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Currently Active ({occupiedBookings.length})
                  </h3>
                  <div className="space-y-3">
                    {occupiedBookings.map((booking) => {
                      const { date, time } = formatDateTime(booking.start_time);
                      const endTime = new Date(booking.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isOwner = booking.user_id === user?.id;
                      
                      // Normalize participants
                      let participants = [];
                      if (booking.participants !== null && booking.participants !== undefined) {
                        if (Array.isArray(booking.participants)) {
                          participants = booking.participants.filter(id => id != null);
                        } else if (typeof booking.participants === 'string') {
                          try {
                            const parsed = JSON.parse(booking.participants);
                            participants = Array.isArray(parsed) ? parsed.filter(id => id != null) : [];
                          } catch (e) {}
                        }
                      }
                      let participantDetails = Array.isArray(booking.participantDetails) ? booking.participantDetails : [];
                      
                      // Calculate time remaining
                      const now = new Date();
                      const end = new Date(booking.end_time);
                      const remainingMs = end - now;
                      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                      const timeRemaining = remainingHours > 0 
                        ? `${remainingHours}h ${remainingMinutes}m remaining`
                        : `${remainingMinutes}m remaining`;

                      return (
                        <div
                          key={booking.id}
                          className="p-4 border-2 border-green-500 dark:border-green-400 rounded-lg bg-green-50 dark:bg-green-900/20"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                                  {booking.room_name}
                                </h3>
                                <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded">
                                  ACTIVE
                                </span>
                              </div>
                              {booking.floor && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {booking.floor}
                                </p>
                              )}
                            </div>
                            {isOwner && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditBooking(booking)}
                                  className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                  title="Cancel"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-sm">
                            <p className="text-gray-700 dark:text-gray-300 font-medium">
                              {booking.purpose}
                            </p>
                            {booking.description && (
                              <p className="text-gray-600 dark:text-gray-400 text-xs">
                                {booking.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {date} • {time} - {endTime}
                              </span>
                            </div>
                            
                            {/* Participants Display */}
                            {participants.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Participants ({participants.length})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {participantDetails.length > 0 ? (
                                    participantDetails.map((participant) => (
                                      <span
                                        key={participant.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium"
                                        title={participant.email || `User ID: ${participant.id}`}
                                      >
                                        <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-500/30 flex items-center justify-center text-[10px] font-semibold text-purple-700 dark:text-purple-200">
                                          {participant.username ? participant.username.charAt(0).toUpperCase() : '?'}
                                        </span>
                                        <span>{participant.username || `User ${participant.id}`}</span>
                                      </span>
                                    ))
                                  ) : (
                                    participants.map((participantId) => (
                                      <span
                                        key={participantId}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-semibold">
                                          {String(participantId).charAt(0)}
                                        </span>
                                        User {participantId}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                {timeRemaining}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Completed Bookings (still visible, not removed) */}
              {completedBookings.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Recently Completed ({completedBookings.length})
                  </h3>
                  <div className="space-y-3">
                    {completedBookings.map((booking) => {
                      const { date, time } = formatDateTime(booking.start_time);
                      const endTime = new Date(booking.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isOwner = booking.user_id === user?.id;
                      
                      // Normalize participants
                      let participants = [];
                      if (booking.participants !== null && booking.participants !== undefined) {
                        if (Array.isArray(booking.participants)) {
                          participants = booking.participants.filter(id => id != null);
                        } else if (typeof booking.participants === 'string') {
                          try {
                            const parsed = JSON.parse(booking.participants);
                            participants = Array.isArray(parsed) ? parsed.filter(id => id != null) : [];
                          } catch (e) {}
                        }
                      }
                      let participantDetails = Array.isArray(booking.participantDetails) ? booking.participantDetails : [];

                      return (
                        <div
                          key={booking.id}
                          className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 opacity-75"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                                  {booking.room_name}
                                </h3>
                                <span className="px-2 py-0.5 text-xs font-semibold bg-gray-400 text-white rounded">
                                  COMPLETED
                                </span>
                              </div>
                              {booking.floor && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {booking.floor}
                                </p>
                              )}
                            </div>
                            {isOwner && (
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-1 text-sm">
                            <p className="text-gray-700 dark:text-gray-300 font-medium">
                              {booking.purpose}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {date} • {time} - {endTime}
                              </span>
                            </div>
                            
                            {/* Participants Display */}
                            {participants.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Participants ({participants.length})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {participantDetails.length > 0 ? (
                                    participantDetails.map((participant) => (
                                      <span
                                        key={participant.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-500/30 flex items-center justify-center text-[10px] font-semibold">
                                          {participant.username ? participant.username.charAt(0).toUpperCase() : '?'}
                                        </span>
                                        <span>{participant.username || `User ${participant.id}`}</span>
                                      </span>
                                    ))
                                  ) : (
                                    participants.map((participantId) => (
                                      <span
                                        key={participantId}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-md text-xs font-medium"
                                      >
                                        <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-semibold">
                                          {String(participantId).charAt(0)}
                                        </span>
                                        User {participantId}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {occupiedBookings.length === 0 && completedBookings.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No occupied or completed bookings</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {roomsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading rooms...</div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No rooms available</div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{room.name}</h3>
                        {room.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {room.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {room.floor && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {room.floor}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Capacity: {room.capacity}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedRoom(room);
                            setShowRoomForm(true);
                          }}
                          className="p-1.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                          title="Edit Room"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                          title="Delete Room"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

