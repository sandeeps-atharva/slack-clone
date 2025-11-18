import React from "react";

export default function ChatLayout({ sidebar, main, theme, children, hasThreadPanel, hasNotificationPanel, hasSettingsPanel, hasProfilePanel }) {
  // Calculate right margin based on which panels are open
  // Priority: Profile > Settings > Notifications > Thread (highest z-index wins)
  // On mobile, panels are full-width overlays, so no margin needed
  const hasAnyPanel = hasThreadPanel || hasNotificationPanel || hasSettingsPanel || hasProfilePanel;
  const rightMargin = hasAnyPanel ? "md:mr-[28rem]" : "";

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
