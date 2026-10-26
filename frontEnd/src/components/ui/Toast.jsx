import React from "react";
import { CheckCircle2, X } from "lucide-react";
export default function Toast({ message, onClose }) {
  return message ? (
    <div className="care-toast" role="status">
      <CheckCircle2 size={20} />
      {message}
      <button
        className="care-icon"
        aria-label="Dismiss notification"
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  ) : null;
}
