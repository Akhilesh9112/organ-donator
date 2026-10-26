import React, { useState } from "react";
import { HeartPulse, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./PortalDashboard.css";
export default function RegisterPage() {
  const { register, setCurrentPage } = useAuth();
  const [role, setRole] = useState("donor"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm"))
      return setError("Passwords must match");
    setBusy(true);
    try {
      await register({
        ...Object.fromEntries(f),
        role,
        consent: f.get("consent") === "on",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="care-entry care-registration">
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
          <span className="care-eyebrow">A CLEARER PATH, TOGETHER</span>
          <h1>
            Care starts
            <br />
            with a<br />
            <em>connection.</em>
          </h1>
          <p>
            Create your account, choose your verified care hospital, and keep
            every step in view.
          </p>
        </div>
        <p className="care-entry-footnote">
          Hospital accounts require administrator verification before accessing
          clinical records.
        </p>
      </section>
      <section className="care-entry-form">
        <div>
          <button
            className="care-text-button"
            onClick={() => setCurrentPage("login")}
          >
            <ArrowLeft size={15} />
            Back to sign in
          </button>
          <h2>Join your care network.</h2>
          <p>Choose the workspace that’s right for you.</p>
          <div
            className="care-role-picker"
            role="group"
            aria-label="Account role"
          >
            {["donor", "recipient", "hospital"].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => {
                  setRole(r);
                  setError("");
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <form onSubmit={submit}>
            <div className="care-form-grid">
              <label className="care-field">
                <span>
                  {role === "hospital" ? "Hospital name" : "Full name"}
                </span>
                <input
                  name="fullName"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label className="care-field">
                <span>Indian mobile number</span>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  pattern="[6-9][0-9]{9}"
                  placeholder="10-digit number"
                  required
                />
              </label>
            </div>
            <label className="care-field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            {role === "hospital" ? (
              <label className="care-field">
                <span>Hospital registration / licence number</span>
                <input name="license" minLength={4} maxLength={150} required />
              </label>
            ) : (
              <div className="care-form-grid">
                <label className="care-field">
                  <span>Blood group (self-reported)</span>
                  <select name="bloodGroup" required>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (b) => (
                        <option key={b}>{b}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="care-field">
                  <span>
                    {role === "recipient"
                      ? "Organ required"
                      : "Organ of interest"}
                  </span>
                  <select name="organ" required>
                    {[
                      "Kidney",
                      "Liver",
                      "Heart",
                      "Lungs",
                      "Pancreas",
                      "Cornea",
                    ].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <div className="care-form-grid">
              <label className="care-field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}"
                  required
                />
              </label>
              <label className="care-field">
                <span>Confirm password</span>
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>
            <p className="care-muted">
              At least 8 characters with uppercase, lowercase, number and
              symbol.
            </p>
            <label className="care-checkbox">
              <input name="consent" type="checkbox" required />
              <span>
                I agree to create an account and share my submitted care
                information with my selected hospital. This does not grant
                consent to a donation or procedure.
              </span>
            </label>
            {error && (
              <div className="care-error" role="alert">
                {error}
              </div>
            )}
            <button className="care-button" type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
