import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Link from "next/link";
import { registerUser, clearError } from "../store/slices/authSlice";
import { updateFormData, resetFormData } from "../store/slices/uiSlice";

export default function RegisterPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isLoading, error: authError, isAuthenticated } = useSelector((state) => state.auth);
  const { formData } = useSelector((state) => state.ui);

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
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
          <input
            className="w-full px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="Username"
            value={formData.username}
            onChange={(e) => dispatch(updateFormData({ username: e.target.value }))}
            required
          />

          <input
            className="w-full px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="Email"
            type="email"
            value={formData.email}
            onChange={(e) => dispatch(updateFormData({ email: e.target.value }))}
            required
          />

          <input
            className="w-full px-4 sm:px-5 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="Password"
            type="password"
            value={formData.password}
            onChange={(e) => dispatch(updateFormData({ password: e.target.value }))}
            required
          />

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

