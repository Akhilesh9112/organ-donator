import React from "react";
export default function StatCard({ label, value, detail, icon: Icon, accent }) {
  return (
    <article className={`care-stat ${accent ? "accent" : ""}`}>
      <div>
        <span>{label}</span>
        {Icon && (
          <span className="care-stat-icon" aria-hidden="true">
            <Icon size={26} strokeWidth={1.8} />
          </span>
        )}
      </div>
      <strong>{value ?? "—"}</strong>
      <small>{detail}</small>
    </article>
  );
}
