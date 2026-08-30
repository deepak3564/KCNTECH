import { useEffect, useState } from "react";
import { api, getToken, saveSession, SessionUser } from "../../../api/client";
import { useI18n } from "../../../i18n";

export function InternetSettingsTab({ user, onUserChange }: { user: SessionUser; onUserChange: (user: SessionUser) => void }) {
  const { t } = useI18n();
  const [internetEnabled, setInternetEnabled] = useState(user.internetEnabled);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ internetEnabled: boolean }>("/auth/internet-settings", { showLoading: false })
      .then((result) => setInternetEnabled(result.internetEnabled))
      .catch((err) => setError(err instanceof Error ? err.message : "Could Not Load Internet Settings"));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const result = await api<{ internetEnabled: boolean }>("/auth/internet-settings", {
        method: "PUT",
        body: JSON.stringify({ internetEnabled })
      });
      const updated = { ...user, internetEnabled: result.internetEnabled };
      saveSession(getToken() ?? "", updated);
      onUserChange(updated);
      setMessage("Internet Settings Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Save Internet Settings");
    }
  }

  return (
    <section className="profile-tab-panel">
      <form className="stack" onSubmit={submit}>
        <label className="checkbox-row">
          <input type="checkbox" checked={internetEnabled} onChange={(event) => setInternetEnabled(event.target.checked)} />
          <span>{t("Enable Internet System")}</span>
        </label>
        <button className="primary save-button">{t("Save Internet Settings")}</button>
      </form>
      {message && <p className="success">{t(message)}</p>}
      {error && <p className="error">{t(error)}</p>}
    </section>
  );
}
