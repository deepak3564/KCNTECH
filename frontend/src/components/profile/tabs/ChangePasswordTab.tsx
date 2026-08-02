import { useState } from "react";
import { api, saveSession, SessionUser } from "../../../api/client";
import { useI18n } from "../../../i18n";

export function ChangePasswordTab({ user, onUserChange }: { user: SessionUser; onUserChange: (user: SessionUser) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      const updated = { ...user, mustChangePassword: false };
      saveSession(localStorage.getItem("kcn_token") ?? "", updated);
      onUserChange(updated);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password Changed Successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Change Password");
    }
  }

  return (
    <section className="profile-tab-panel">
      {user.mustChangePassword && <p className="profile-alert">{t("Please Change Your Temporary Password.")}</p>}
      <form className="stack" onSubmit={submit}>
        <label>{t("Current Password")}<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
        <label>{t("New Password")}<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <button className="primary">{t("Update Password")}</button>
      </form>
      {message && <p className="success">{t(message)}</p>}
      {error && <p className="error">{t(error)}</p>}
    </section>
  );
}
