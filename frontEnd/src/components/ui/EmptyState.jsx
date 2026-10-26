import React from "react";
import { Inbox } from "lucide-react";
export default function EmptyState({
  title = "Nothing here yet",
  message = "New activity will appear here.",
  children,
}) {
  return (
    <div className="care-empty">
      <span>
        <Inbox size={27} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {children}
    </div>
  );
}
