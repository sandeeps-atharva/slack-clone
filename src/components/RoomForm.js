import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function RoomForm({
  isOpen,
  onClose,
  onSuccess,
  initialRoom = null,
  panelPosition = 0,
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    capacity: 10,
    floor: "",
    amenities: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialRoom) {
      setFormData({
        name: initialRoom.name || "",
        description: initialRoom.description || "",
        capacity: initialRoom.capacity || 10,
        floor: initialRoom.floor || "",
        amenities: initialRoom.amenities
          ? typeof initialRoom.amenities === "string"
            ? initialRoom.amenities
            : JSON.stringify(initialRoom.amenities)
          : "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        capacity: 10,
        floor: "",
        amenities: "",
      });
    }
    setError("");
  }, [initialRoom, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Parse amenities if provided
      let amenities = null;
      if (formData.amenities.trim()) {
        try {
          // Try parsing as JSON first
          amenities = JSON.parse(formData.amenities);
        } catch {
          // If not valid JSON, treat as comma-separated list
          amenities = formData.amenities
            .split(",")
            .map((a) => a.trim())
            .filter((a) => a.length > 0);
        }
      }

      const roomData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        capacity: parseInt(formData.capacity, 10) || 10,
        floor: formData.floor.trim() || null,
        amenities: amenities,
      };

      if (onSuccess) {
        await onSuccess(roomData);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save room");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const rightOffset = panelPosition * 28;
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };

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
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {initialRoom ? "Edit Room" : "Add New Room"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Room Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Room Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Conference Room A"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Room description and features"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Capacity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacity: parseInt(e.target.value, 10) || 1,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Floor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Floor
              </label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) =>
                  setFormData({ ...formData, floor: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., 1st Floor"
              />
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amenities
              </label>
              <input
                type="text"
                value={formData.amenities}
                onChange={(e) =>
                  setFormData({ ...formData, amenities: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Comma-separated or JSON array, e.g., Projector, Whiteboard, WiFi"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter amenities separated by commas or as a JSON array
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : initialRoom ? "Update Room" : "Create Room"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

