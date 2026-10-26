import React, { useState } from "react";
import {
  HeartPulse,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../config/api";
import "./PortalDashboard.css";
export default function LoginPage() {
  const { login, setCurrentPage } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [forgot, setForgot] = useState(false),
    [sent, setSent] = useState(false),
    [show, setShow] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (forgot) {
        await authFetch("/users/forgot-password", {
          method: "POST",
          body: { email: f.get("email") },
        });
        setSent(true);
      } else await login(f.get("email"), f.get("password"));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="care-entry">
      <section className="care-entry-story">
        <button className="care-brand" onClick={() => setCurrentPage("home")}>
          <span>
            <HeartPulse size={25} />
          </span>
          <div>
            organ<span>sync</span>
            <small>CONNECTED BY CARE</small>
          </div>
        </button>
        <div className="care-entry-copy">
          <span className="care-eyebrow">
            EVIDENCE. CONSENT. COORDINATED CARE.
          </span>
          <h1>
            Every journey
            <br />
            deserves a<br />
            <em>connected team.</em>
          </h1>
          <p>
            A shared workspace for donors, recipients, hospitals, and the people
            coordinating care.
          </p>
          <div className="care-entry-features">
            <span>
              <FileCheck2 size={19} />
              Evidence-led screening
            </span>
            <span>
              <ShieldCheck size={19} />
              Clear consent at every step
            </span>
            <span>
              <HeartPulse size={19} />
              One coordinated care timeline
            </span>
          </div>
        </div>
        <p className="care-entry-footnote">
          Designed to support care teams. Clinical decisions remain with
          qualified professionals.
        </p>
      </section>
      <section className="care-entry-form">
        <div>
          <span className="care-eyebrow">YOUR CARE WORKSPACE</span>
          <h2>{forgot ? "Reset your password" : "Welcome back."}</h2>
          <p>
            {forgot
              ? "We’ll email a reset link if your account exists."
              : "Sign in to take the next step, together."}
          </p>
          {sent ? (
            <div className="care-notice">
              <p>
                If an account exists for this email, a reset link has been sent.
                Check your inbox and spam folder.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label className="care-field">
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  required
                  placeholder="you@example.com"
                />
              </label>
              {!forgot && (
                <label className="care-field">
                  <span>Password</span>
                  <div className="care-password">
                    <input
                      name="password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      maxLength={72}
                      required
                    />
                    <button
                      type="button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
              )}
              {error && (
                <div className="care-error" role="alert">
                  {error}
                </div>
              )}
              <button className="care-button" type="submit" disabled={busy}>
                {busy ? "Please wait…" : forgot ? "Send reset link" : "Sign in"}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
          <button
            className="care-text-button"
            onClick={() => {
              setForgot(!forgot);
              setError("");
              setSent(false);
            }}
          >
            {forgot ? "Back to sign in" : "Forgot your password?"}
          </button>
          {!forgot && (
            <div className="care-entry-register">
              New to OrganSync?{" "}
              <button onClick={() => setCurrentPage("register")}>
                Create an account <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="care-entry-privacy">
            <ShieldCheck size={14} />
            Access is specific to your role and care relationship.
          </div>
        </div>
      </section>
    </div>
  );
}
