import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, User, Mail, LogOut, Settings, Edit2, Save, XCircle } from "lucide-react";
import UserAvatar from "./chat/UserAvatar";
import { setUser } from "../store/slices/authSlice";
import { validateUsername, validateEmail, validatePassword } from "../utils/validation";

export default function ProfileSidebar({
  isOpen,
  onClose,
  user,
  onLogout,
  onOpenSettings,
  onlineUserIds,
  panelPosition = 0, // Position from right (0 = rightmost)
}) {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
    setIsEditing(false);
    setValidationErrors({});
    setError("");
    setSuccess("");
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Calculate right offset: each panel is 28rem wide, position 0 is rightmost
  const rightOffset = panelPosition * 28; // in rem
  const rightStyle = panelPosition === 0 ? {} : { right: `${rightOffset}rem` };

  const isOnline = onlineUserIds?.includes(user.id);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: "" });
    }
    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    const errors = {};
    
    const usernameError = validateUsername(formData.username);
    if (usernameError) errors.username = usernameError;

    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;

    if (formData.newPassword) {
      const passwordError = validatePassword(formData.newPassword);
      if (passwordError) errors.newPassword = passwordError;

      if (formData.newPassword !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }

      if (!formData.currentPassword) {
        errors.currentPassword = "Current password is required to change password";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const updateData = {
        username: formData.username,
        email: formData.email,
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await fetch("/api/users/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Profile updated successfully!");
        dispatch(setUser(data.user));
        setIsEditing(false);
        setFormData({
          ...formData,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update profile");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      username: user.username || "",
      email: user.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setValidationErrors({});
    setError("");
    setSuccess("");
  };

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Profile</h2>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
                aria-label="Edit profile"
                title="Edit profile"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="p-1.5 rounded-full text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10 transition disabled:opacity-50"
                  aria-label="Save changes"
                  title="Save changes"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="p-1.5 rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition disabled:opacity-50"
                  aria-label="Cancel editing"
                  title="Cancel"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition"
              aria-label="Close profile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <UserAvatar username={user.username} size="lg" />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
              )}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {user.username}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-md text-sm">
              {success}
            </div>
          )}

          {/* User Information */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Account Information
              </h4>
              
              <div className="space-y-3">
                {/* Username */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                      <User className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Username</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleChange("username", e.target.value)}
                          className={`w-full mt-1 px-2 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                            validationErrors.username
                              ? "border-red-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {user.username}
                        </p>
                      )}
                    </div>
                  </div>
                  {isEditing && validationErrors.username && (
                    <p className="text-xs text-red-600 dark:text-red-400 px-3">
                      {validationErrors.username}
                    </p>
                  )}
                </div>

                {/* Email */}
                {user.email && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                        <Mail className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                        {isEditing ? (
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className={`w-full mt-1 px-2 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                              validationErrors.email
                                ? "border-red-500"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          />
                        ) : (
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    {isEditing && validationErrors.email && (
                      <p className="text-xs text-red-600 dark:text-red-400 px-3">
                        {validationErrors.email}
                      </p>
                    )}
                  </div>
                )}

                {/* User ID (read-only) */}
                {user.id && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-300">ID</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {user.id}
                      </p>
                    </div>
                  </div>
                )}

                {/* Password Change (only when editing) */}
                {isEditing && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Change Password (Optional)
                    </p>
                    
                    <div className="space-y-1">
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={formData.currentPassword}
                        onChange={(e) => handleChange("currentPassword", e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          validationErrors.currentPassword
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      />
                      {validationErrors.currentPassword && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {validationErrors.currentPassword}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <input
                        type="password"
                        placeholder="New Password"
                        value={formData.newPassword}
                        onChange={(e) => handleChange("newPassword", e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          validationErrors.newPassword
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      />
                      {validationErrors.newPassword && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {validationErrors.newPassword}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleChange("confirmPassword", e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          validationErrors.confirmPassword
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      />
                      {validationErrors.confirmPassword && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {validationErrors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t border-gray-200 dark:border-gray-800 pt-4">
            <button
              onClick={() => {
                onOpenSettings?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
            >
              <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Channel Settings
              </span>
            </button>

            <button
              onClick={() => {
                onLogout?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 dark:border-red-500/40 hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left"
            >
              <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

