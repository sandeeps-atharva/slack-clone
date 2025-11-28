import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Link from "next/link";
import { registerUser, clearError } from "../store/slices/authSlice";
import { updateFormData, resetFormData, setValidationError, clearValidationError, clearAllValidationErrors } from "../store/slices/uiSlice";
import { validateUsername, validateEmail, validatePassword, validatePasswordConfirm } from "../utils/validation";

export default function RegisterPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isLoading, error: authError, isAuthenticated } = useSelector((state) => state.auth);
  const { formData, validationErrors } = useSelector((state) => state.ui);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({ username: false, email: false, password: false, confirmPassword: false });

  useEffect(() => {
    // Redirect to home if already authenticated
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Reset form data on mount
    dispatch(resetFormData());
    dispatch(clearError());
    setConfirmPassword("");
  }, [dispatch]);

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    let error = "";
    if (field === "username") {
      error = validateUsername(formData.username);
    } else if (field === "email") {
      error = validateEmail(formData.email);
    } else if (field === "password") {
      error = validatePassword(formData.password);
    } else if (field === "confirmPassword") {
      error = validatePasswordConfirm(formData.password, confirmPassword);
    }
    if (error) {
      dispatch(setValidationError({ field, error }));
    } else {
      dispatch(clearValidationError(field));
    }
  };

  const handleChange = (field, value) => {
    if (field === "confirmPassword") {
      setConfirmPassword(value);
      // Clear error when user starts typing
      if (touched.confirmPassword && validationErrors.password) {
        dispatch(clearValidationError("password"));
      }
    } else {
      dispatch(updateFormData({ [field]: value }));
      // Clear error when user starts typing
      if (touched[field] && validationErrors[field]) {
        dispatch(clearValidationError(field));
      }
    }
  };

  const validateForm = () => {
    const usernameError = validateUsername(formData.username);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validatePasswordConfirm(formData.password, confirmPassword);

    if (usernameError) {
      dispatch(setValidationError({ field: "username", error: usernameError }));
    }
    if (emailError) {
      dispatch(setValidationError({ field: "email", error: emailError }));
    }
    if (passwordError) {
      dispatch(setValidationError({ field: "password", error: passwordError }));
    }
    if (confirmPasswordError) {
      dispatch(setValidationError({ field: "password", error: confirmPasswordError }));
    }

    return !usernameError && !emailError && !passwordError && !confirmPasswordError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearAllValidationErrors());
    setTouched({ username: true, email: true, password: true, confirmPassword: true });

    if (!validateForm()) {
      return;
    }

    const result = await dispatch(
      registerUser({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
    );

    if (registerUser.fulfilled.match(result)) {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400 px-4 py-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-white">
            Create Account
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Sign up to get started
          </p>
        </div>

        {authError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 sm:p-3 rounded-md mb-4 text-center text-xs sm:text-sm font-medium">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <input
              className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                touched.username && validationErrors.username
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
              }`}
              placeholder="Username"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
              onBlur={() => handleBlur("username")}
              required
            />
            {touched.username && validationErrors.username && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validationErrors.username}
              </p>
            )}
          </div>

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
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              required
            />
            {touched.email && validationErrors.email && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validationErrors.email}
              </p>
            )}
          </div>

          <div>
            <input
              className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                touched.password && validationErrors.password
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
              }`}
              placeholder="Password"
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
              placeholder="Confirm Password"
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
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-4 sm:mt-5 text-center">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-purple-700 dark:text-purple-400 hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

