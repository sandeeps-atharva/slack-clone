// store/slices/uiSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isLogin: true,
  showEmoji: false,
  formData: {
    username: "",
    email: "",
    password: "",
  },
  validationErrors: {
    username: "",
    email: "",
    password: "",
  },
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleAuthMode: (state) => {
      state.isLogin = !state.isLogin;
    },
    setIsLogin: (state, action) => {
      state.isLogin = action.payload;
    },
    toggleEmojiPicker: (state) => {
      state.showEmoji = !state.showEmoji;
    },
    setShowEmoji: (state, action) => {
      state.showEmoji = action.payload;
    },
    updateFormData: (state, action) => {
      state.formData = { ...state.formData, ...action.payload };
    },
    resetFormData: (state) => {
      state.formData = {
        username: "",
        email: "",
        password: "",
      };
      state.validationErrors = {
        username: "",
        email: "",
        password: "",
      };
    },
    setValidationError: (state, action) => {
      const { field, error } = action.payload;
      state.validationErrors[field] = error;
    },
    clearValidationError: (state, action) => {
      const field = action.payload;
      state.validationErrors[field] = "";
    },
    clearAllValidationErrors: (state) => {
      state.validationErrors = {
        username: "",
        email: "",
        password: "",
      };
    },
  },
});

export const {
  toggleAuthMode,
  setIsLogin,
  toggleEmojiPicker,
  setShowEmoji,
  updateFormData,
  resetFormData,
  setValidationError,
  clearValidationError,
  clearAllValidationErrors,
} = uiSlice.actions;

export default uiSlice.reducer;
