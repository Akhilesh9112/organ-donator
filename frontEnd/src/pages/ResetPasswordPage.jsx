import React, { useState } from "react";
import { authFetch } from "../config/api";
import "./PortalDashboard.css";
export default function ResetPasswordPage() {
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  const token = new URLSearchParams(window.location.search).get("token");
  async function submit(e) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setError("Passwords must match");
      return;
    }
    setBusy(true);
    try {
      await authFetch(`/users/reset-password/${token}`, {
        method: "POST",
        body: { password: f.get("password") },
      });
      setDone(true);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="care-auth">
      <div className="care-panel">
        <span className="care-eyebrow">ORGANSYNC / ACCOUNT</span>
        <h1>{done ? "Password updated" : "A fresh start"}</h1>
        <p>
          {done
            ? "Sign in with your new password. Previous sessions have been closed."
            : "Choose a secure password for your care workspace."}
        </p>
        {error && (
          <p role="alert" className="care-error">
            {error}
          </p>
        )}
        {done ? (
          <a className="care-button" href="/">
            Back to sign in
          </a>
        ) : (
          <form onSubmit={submit}>
            <label>
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
            <p className="care-muted">
              At least 8 characters, including uppercase, lowercase, number and
              symbol.
            </p>
            <button className="care-button" disabled={busy || !token}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
