import React, { useState } from "react";
import { Cable } from "lucide-react";
import { api, saveSession, SessionUser } from "../api/client";
import { useI18n } from "../i18n";

export function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("admin@kcn.local");
  const [password, setPassword] = useState("Admin@123");
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
        <div>
          <span className="brand-mark"><Cable size={26} /></span>
          <h1>{t("KCN Customer Management")}</h1>
          <p>{t("Organisation Sign In")}</p>
        </div>
        <form onSubmit={submit} className="stack">
          <label>{t("Email")}<input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>{t("Password")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{t(error)}</p>}
          <button className="primary">{t("Sign In")}</button>
        </form>
        <div className="hint">
          <strong>{t("Demo Logins")}</strong>
          <span>Admin: admin@kcn.local / Admin@123</span>
          <span>Employee: employee@kcn.local / Employee@123</span>
          <span>Super Admin: superadmin@kcn.local / SuperAdmin@123</span>
        </div>
      </section>
    </main>
  );
}
