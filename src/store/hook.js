import { useDispatch, useSelector } from "react-redux";
import { store } from "./store";

// Typed hooks for use in components
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;
