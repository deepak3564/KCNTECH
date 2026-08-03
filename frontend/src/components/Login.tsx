import React, { useState } from "react";
import { api, saveSession, SessionUser } from "../api/client";
import { useI18n } from "../i18n";

export function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ token: string; user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      saveSession(result.token, result.user);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Sign In");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <img className="login-logo" src="/kcn-tech-logo.png" alt="KCN Tech" />
          <h1>{t("KCN Customer Management")}</h1>
          <p>{t("Sign In")}</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>{t("Email")}<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>{t("Password")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{t(error)}</p>}
          <button className="primary">{t("Sign In")}</button>
        </form>
      </section>
    </main>
  );
}
