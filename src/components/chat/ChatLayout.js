import React from "react";

export default function ChatLayout({ sidebar, main, theme, children, hasThreadPanel, hasNotificationPanel, hasRoomBookingPanel, hasSettingsPanel, hasProfilePanel, hasCallHistoryPanel }) {
  // Calculate right margin based on how many panels are open
  // Panels stack from right to left: Profile > Settings > Notifications > Call History > Room Booking > Thread
  // Each panel is 28rem (448px) wide
  // On mobile, panels are full-width overlays, so no margin needed
  
  const panelCount = [hasThreadPanel, hasNotificationPanel, hasCallHistoryPanel, hasRoomBookingPanel, hasSettingsPanel, hasProfilePanel].filter(Boolean).length;
  
  // Calculate right margin - use Tailwind's arbitrary values
  // Each panel is 28rem wide, so margin = panelCount * 28rem
  const marginRem = panelCount * 28;
  const rightMargin = panelCount > 0 ? `md:mr-[${marginRem}rem]` : "";

  return (
    <div
      className={`flex h-screen overflow-hidden ${
        theme === "dark" ? "dark bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {sidebar}
      <div className={`relative flex flex-col flex-1 overflow-hidden min-w-0 transition-all ${rightMargin}`}>
        {main}
        {children}
      </div>
    </div>
  );
}
