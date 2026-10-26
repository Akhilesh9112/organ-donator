import React from "react";
export default function Button({
  children,
  secondary = false,
  danger = false,
  busy = false,
  ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`care-button ${secondary ? "secondary" : ""} ${danger ? "danger" : ""} ${props.className || ""}`}
    >
      {busy ? "Saving…" : children}
    </button>
  );
}
