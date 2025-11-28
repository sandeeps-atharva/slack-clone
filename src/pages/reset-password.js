import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { updateFormData, resetFormData, setValidationError, clearValidationError, clearAllValidationErrors } from "../store/slices/uiSlice";
import { validatePassword, validatePasswordConfirm } from "../utils/validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { formData, validationErrors } = useSelector((state) => state.ui);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });
  const { token } = router.query;

  useEffect(() => {
    if (!token) {
      setError("Invalid reset token");
    }
    dispatch(resetFormData());
    setError("");
    setSuccess(false);
  }, [dispatch, token]);

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    let error = "";
    if (field === "password") {
      error = validatePassword(formData.password);
    } else if (field === "confirmPassword") {
      error = validatePasswordConfirm(formData.password, confirmPassword);
    }
    if (error) {
      dispatch(setValidationError({ field: "password", error }));
    } else {
      dispatch(clearValidationError("password"));
    }
  };

  const handleChange = (field, value) => {
    if (field === "confirmPassword") {
      setConfirmPassword(value);
      if (touched.confirmPassword && validationErrors.password) {
        dispatch(clearValidationError("password"));
      }
    } else {
      dispatch(updateFormData({ [field]: value }));
      if (touched[field] && validationErrors[field]) {
        dispatch(clearValidationError(field));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearAllValidationErrors());
    setTouched({ password: true, confirmPassword: true });
    setError("");
    setSuccess(false);

    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validatePasswordConfirm(formData.password, confirmPassword);

    if (passwordError) {
      dispatch(setValidationError({ field: "password", error: passwordError }));
      return;
    }
    if (confirmPasswordError) {
      dispatch(setValidationError({ field: "password", error: confirmPasswordError }));
      return;
    }

    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password: formData.password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400 px-4 py-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-white mb-4">
              Invalid Reset Link
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The password reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="text-purple-700 dark:text-purple-400 hover:underline font-medium"
            >
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400 px-4 py-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-white">
            Reset Password
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter your new password
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 sm:p-3 rounded-md mb-4 text-center text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-md text-center text-sm">
              <p className="font-medium">Password reset successfully!</p>
              <p className="mt-2">Redirecting to login...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <input
                className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                  touched.password && validationErrors.password
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
                }`}
                placeholder="New Password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                required
              />
              {touched.password && validationErrors.password && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.password}
                </p>
              )}
            </div>

            <div>
              <input
                className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                  touched.confirmPassword && formData.password && formData.password !== confirmPassword
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
                }`}
                placeholder="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                required
              />
              {touched.confirmPassword && formData.password && formData.password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Passwords do not match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 sm:py-3 rounded-xl font-semibold transition disabled:opacity-50 text-sm sm:text-base"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <div className="mt-4 sm:mt-5 text-center">
          <Link
            href="/login"
            className="text-xs sm:text-sm text-purple-700 dark:text-purple-400 hover:underline font-medium"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

