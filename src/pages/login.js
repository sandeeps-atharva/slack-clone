import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Link from "next/link";
import { loginUser, clearError } from "../store/slices/authSlice";
import {
  updateFormData,
  resetFormData,
  setValidationError,
  clearValidationError,
  clearAllValidationErrors,
} from "../store/slices/uiSlice";
import { validateUsername, validatePassword } from "../utils/validation";

export default function LoginPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  const { isLoading, error: authError, isAuthenticated } = useSelector(
    (state) => state.auth
  );
  const { formData, validationErrors } = useSelector((state) => state.ui);

  const [touched, setTouched] = useState({ username: false, password: false });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) router.push("/");
  }, [isAuthenticated, router]);

  // Reset form on mount
  useEffect(() => {
    dispatch(resetFormData());
    dispatch(clearError());
  }, [dispatch]);

  const handleBlur = (field) => {
    setTouched({ ...touched, [field]: true });
    let error =
      field === "username"
        ? validateUsername(formData.username)
        : validatePassword(formData.password);

    if (error) {
      dispatch(setValidationError({ field, error }));
    } else {
      dispatch(clearValidationError(field));
    }
  };

  const handleChange = (field, value) => {
    dispatch(updateFormData({ [field]: value }));
    if (touched[field] && validationErrors[field]) {
      dispatch(clearValidationError(field));
    }
  };

  const validateForm = () => {
    const usernameError = validateUsername(formData.username);
    const passwordError = validatePassword(formData.password);

    if (usernameError) dispatch(setValidationError({ field: "username", error: usernameError }));
    if (passwordError) dispatch(setValidationError({ field: "password", error: passwordError }));

    return !usernameError && !passwordError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearAllValidationErrors());
    setTouched({ username: true, password: true });

    if (!validateForm()) return;

    const result = await dispatch(
      loginUser({
        username: formData.username,
        password: formData.password,
      })
    );

    if (loginUser.fulfilled.match(result)) {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-500 via-pink-400 to-red-400 px-4 py-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-white">
            Welcome Back!
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Sign in to continue to your account
          </p>
        </div>

        {authError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md mb-4 text-center text-sm font-medium">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => handleChange("username", e.target.value)}
              onBlur={() => handleBlur("username")}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                touched.username && validationErrors.username
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
              }`}
              required
            />
            {touched.username && validationErrors.username && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validationErrors.username}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                touched.password && validationErrors.password
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-purple-500"
              }`}
              required
            />
            {touched.password && validationErrors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {validationErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 text-sm"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-purple-700 dark:text-purple-400 hover:underline font-medium"
          >
            Forgot password?
          </Link>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-purple-700 dark:text-purple-400 hover:underline font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
