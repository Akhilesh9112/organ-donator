import React from "react";
export default function Badge({ children }) {
  const text = String(children || "Pending"),
    tone = /Verified|Completed|completed|Active|Accepted|Extracted/.test(text)
      ? "good"
      : /Rejected|Suspended|Cancelled|canceled|Withdrawn|Failed/.test(text)
        ? "bad"
        : /Scheduled|scheduled|Review|Recommended/.test(text)
          ? "info"
          : "waiting";
  return (
    <span className={`care-badge ${tone}`}>
      <i />
      {text}
    </span>
  );
}
