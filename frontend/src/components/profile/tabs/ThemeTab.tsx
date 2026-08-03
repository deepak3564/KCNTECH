import { useState } from "react";
import { api, saveSession, SessionUser } from "../../../api/client";
import { useI18n } from "../../../i18n";

type Theme = SessionUser["preferredTheme"];

export function ThemeTab({ user, onUserChange }: { user: SessionUser; onUserChange: (user: SessionUser) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const currentTheme = user.preferredTheme ?? "professional";

  async function changeTheme(nextTheme: Theme) {
    setError("");
    document.documentElement.dataset.theme = nextTheme;
    try {
      const updated = await api<SessionUser>("/auth/theme", {
        method: "PUT",
        body: JSON.stringify({ preferredTheme: nextTheme })
      });
      saveSession(localStorage.getItem("kcn_token") ?? "", updated);
      onUserChange(updated);
    } catch (err) {
      document.documentElement.dataset.theme = currentTheme;
      setError(err instanceof Error ? err.message : "Could Not Update Theme");
    }
  }

  return (
    <section className="profile-tab-panel">
      <label>
        {t("Select Theme")}
        <select value={currentTheme} onChange={(event) => changeTheme(event.target.value as Theme)}>
          <option value="professional">{t("Professional")}</option>
          <option value="brand">{t("KCN Brand")}</option>
          <option value="light">{t("Light")}</option>
          <option value="dark">{t("Dark")}</option>
        </select>
      </label>
      {error && <p className="error">{t(error)}</p>}
    </section>
  );
}
