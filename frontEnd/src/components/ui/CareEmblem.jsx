import React from "react";
import { HeartPulse, ShieldCheck } from "lucide-react";
export default function CareEmblem() {
  return (
    <div className="care-orbit" aria-hidden="true">
      <div className="care-orbit-ring one" />
      <div className="care-orbit-ring two" />
      <span className="care-orbit-heart">
        <HeartPulse size={76} strokeWidth={1.8} />
      </span>
      <span className="care-orbit-shield">
        <ShieldCheck size={31} />
      </span>
      <span className="care-orbit-chip">
        <ShieldCheck size={15} /> Connected care
      </span>
      <i />
      <b />
      <span className="care-orbit-spark" />
    </div>
  );
}
