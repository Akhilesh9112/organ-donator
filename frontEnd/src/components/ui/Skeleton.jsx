import React from "react";
export default function Skeleton() {
  return (
    <div className="care-loading" role="status" aria-label="Loading workspace">
      <div />
      <div />
      <div />
      <span>Loading your workspace…</span>
    </div>
  );
}
