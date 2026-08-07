import { useState } from "react";
import { api, getToken, saveSession, SessionUser } from "../../../api/client";
import { Language, useI18n } from "../../../i18n";

export function LanguageTab({ user, onUserChange }: { user: SessionUser; onUserChange: (user: SessionUser) => void }) {
  const { language, setLanguage, t } = useI18n();
  const [error, setError] = useState("");

  async function changeLanguage(nextLanguage: Language) {
    setError("");
    setLanguage(nextLanguage);
    try {
      const updated = await api<SessionUser>("/auth/language", {
        method: "PUT",
        body: JSON.stringify({ preferredLanguage: nextLanguage })
      });
      saveSession(getToken() ?? "", updated);
      onUserChange(updated);
    } catch (err) {
      setLanguage(user.preferredLanguage);
      setError(err instanceof Error ? err.message : "Could Not Update Language");
    }
  }

  return (
    <section className="profile-tab-panel">
      <label>
        {t("Select Language")}
        <select value={language} onChange={(event) => changeLanguage(event.target.value as Language)}>
          <option value="en">{t("English")}</option>
          <option value="mr">{t("Marathi")}</option>
        </select>
      </label>
      {error && <p className="error">{t(error)}</p>}
    </section>
  );
}
