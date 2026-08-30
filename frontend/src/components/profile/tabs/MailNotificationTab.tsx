import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { useI18n } from "../../../i18n";

export function MailNotificationTab() {
  const { t } = useI18n();
  const [notificationEmail, setNotificationEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ notificationEmail: string }>("/auth/mail-notification", { showLoading: false })
      .then((result) => setNotificationEmail(result.notificationEmail))
      .catch((err) => setError(err instanceof Error ? err.message : "Could Not Load Mail Notification"));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const result = await api<{ notificationEmail: string }>("/auth/mail-notification", {
        method: "PUT",
        body: JSON.stringify({ notificationEmail })
      });
      setNotificationEmail(result.notificationEmail);
      setMessage("Mail Notification Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Save Mail Notification");
    }
  }

  return (
    <section className="profile-tab-panel">
      <form className="stack" onSubmit={submit}>
        <label>
          {t("Payment Alert Email")}
          <input type="email" value={notificationEmail} onChange={(event) => setNotificationEmail(event.target.value)} placeholder="admin@example.com" />
        </label>
        <button className="primary save-button">{t("Save Mail Notification")}</button>
      </form>
      {message && <p className="success">{t(message)}</p>}
      {error && <p className="error">{t(error)}</p>}
    </section>
  );
}
