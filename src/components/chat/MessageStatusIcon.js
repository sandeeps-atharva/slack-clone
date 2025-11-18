// components/chat/MessageStatusIcon.js
import { Check, CheckCheck, XCircle } from "lucide-react";

export default function MessageStatusIcon({ status, isOwn }) {
  if (!isOwn) return null;

  switch (status) {
    case "pending":
      return <Check className="w-4 h-4 text-white/70" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-300" />;
    case "sent":
    default:
      return <CheckCheck className="w-4 h-4 text-white" />;
  }
}


