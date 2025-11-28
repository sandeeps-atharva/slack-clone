import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { updateFormData, resetFormData, setValidationError, clearValidationError, clearAllValidationErrors } from "../store/slices/uiSlice";
import { validateEmail } from "../utils/validation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { formData, validationErrors } = useSelector((state) => state.ui);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({ email: false });

  useEffect(() => {
    dispatch(resetFormData());
    setError("");
    setSuccess(false);
  }, [dispatch]);

  const handleBlur = () => {
    setTouched({ email: true });
    const emailError = validateEmail(formData.email);
    if (emailError) {
      dispatch(setValidationError({ field: "email", error: emailError }));
    } else {
      dispatch(clearValidationError("email"));
    }
  };

  const handleChange = (value) => {
    dispatch(updateFormData({ email: value }));
    if (touched.email && validationErrors.email) {
      dispatch(clearValidationError("email"));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearAllValidationErrors());
    setTouched({ email: true });
    setError("");
    setSuccess(false);

    const emailError = validateEmail(formData.email);
    if (emailError) {
      dispatch(setValidationError({ field: "email", error: emailError }));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400 px-4 py-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-white">
            Forgot Password
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter your email to receive a password reset link
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
              <p className="font-medium">Check your email!</p>
              <p className="mt-2">
                If an account with that email exists, a password reset link has been sent.
              </p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white py-2.5 sm:py-3 rounded-xl font-semibold transition text-sm sm:text-base"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <input
                className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                  touched.email && validationErrors.email
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
                }`}
                placeholder="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                required
              />
              {touched.email && validationErrors.email && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {validationErrors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 sm:py-3 rounded-xl font-semibold transition disabled:opacity-50 text-sm sm:text-base"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
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

