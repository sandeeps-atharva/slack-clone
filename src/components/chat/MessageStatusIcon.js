// components/chat/MessageStatusIcon.js
import { Check, CheckCheck, XCircle } from "lucide-react";

/**
 * WhatsApp-style message status icon
 * @param {string} status - Message status: "pending", "sent", "failed"
 * @param {boolean} isOwn - Whether this is the current user's message
 * @param {boolean} hasRecipientOnline - Whether any recipient is currently online
 * @param {boolean} isRead - Whether all recipients have read the message
 */
export default function MessageStatusIcon({ status, isOwn, hasRecipientOnline = false, isRead = false }) {
  if (!isOwn) return null;

  // Failed messages show error icon
  if (status === "failed") {
    return <XCircle className="w-4 h-4 text-red-300" />;
  }

  // Pending messages show one light tick
  if (status === "pending") {
    return <Check className="w-4 h-4 text-white/70" />;
  }

  // Sent messages: show status based on read state and recipient online status
  // Priority: Read > Online > Offline
  
  // Two colored ticks: message has been read (highest priority)
  if (isRead) {
    return <CheckCheck className="w-4 h-4 text-blue-300" />;
  }

  // Two light ticks: receiver is online but hasn't read yet
  if (hasRecipientOnline) {
    return <CheckCheck className="w-4 h-4 text-white/70" />;
  }

  // One light tick: receiver is offline (lowest priority)
  return <Check className="w-4 h-4 text-white/70" />;
}


