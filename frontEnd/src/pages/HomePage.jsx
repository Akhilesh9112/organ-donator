import CareEmblem from "../components/ui/CareEmblem";
import React from "react";
import {
  HeartPulse,
  ArrowRight,
  FileCheck2,
  ShieldCheck,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./PortalDashboard.css";
export default function HomePage() {
  const { setCurrentPage } = useAuth();
  return (
    <div className="care-home">
      <header>
        <span className="care-brand">
          <span>
            <HeartPulse size={24} />
          </span>
          <div>
            organ<span>sync</span>
            <small>CONNECTED BY CARE</small>
          </div>
        </span>
        <button
          className="care-button secondary"
          onClick={() => setCurrentPage("login")}
        >
          Sign in <ArrowRight size={16} />
        </button>
      </header>
      <main>
        <section className="care-home-hero">
          <div className="care-home-copy">
            <span className="care-eyebrow">
              A SHARED WORKSPACE FOR COORDINATED CARE
            </span>
            <h1>
              Bring every step
              <br />
              of care <em>together.</em>
            </h1>
            <p>
              OrganSync connects donors, recipients, hospitals, and
              administrators through evidence, consent, and a clear care
              timeline.
            </p>
            <button
              className="care-button"
              onClick={() => setCurrentPage("register")}
            >
              Create your account <ArrowRight size={16} />
            </button>
          </div>
          <div className="care-home-visual">
            <CareEmblem />
            <div className="care-home-float evidence">
              <FileCheck2 size={22} />
              <div>
                <strong>Evidence reviewed</strong>
                <small>A clear starting point</small>
              </div>
              <CheckCircle2 size={17} />
            </div>
            <div className="care-home-float consent">
              <ShieldCheck size={23} />
              <div>
                <strong>Decisions together</strong>
                <small>Consent at every step</small>
              </div>
            </div>
            <div className="care-home-visual-caption">
              <span /> Your care, connected
            </div>
          </div>
        </section>
        <div className="care-home-cards">
          {[
            [
              FileCheck2,
              "Start with evidence",
              "Submit medical documents for review by your assigned verified hospital.",
            ],
            [
              ShieldCheck,
              "Make informed decisions",
              "Keep screening, donor consent, and clinical approvals as distinct steps.",
            ],
            [
              CalendarDays,
              "Stay connected",
              "Follow case progress and view coordinated care appointments.",
            ],
          ].map(([Icon, title, text]) => (
            <article className="care-panel" key={title}>
              <span className="care-home-feature-icon">
                <Icon size={27} />
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <footer>
          OrganSync supports coordination and basic screening. Qualified
          professionals determine clinical suitability and final allocation.
        </footer>
      </main>
    </div>
  );
}
