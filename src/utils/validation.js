// Validation utility functions

export const validateUsername = (username) => {
  if (!username || username.trim().length === 0) {
    return "Username is required";
  }
  if (username.length < 3) {
    return "Username must be at least 3 characters";
  }
  if (username.length > 50) {
    return "Username must be less than 50 characters";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Username can only contain letters, numbers, and underscores";
  }
  return "";
};

export const validateEmail = (email) => {
  if (!email || email.trim().length === 0) {
    return "Email is required";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  return "";
};

export const validatePassword = (password) => {
  if (!password || password.length === 0) {
    return "Password is required";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }
  if (password.length > 100) {
    return "Password must be less than 100 characters";
  }
  return "";
};

export const validatePasswordConfirm = (password, confirmPassword) => {
  if (!confirmPassword || confirmPassword.length === 0) {
    return "Please confirm your password";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  return "";
};

