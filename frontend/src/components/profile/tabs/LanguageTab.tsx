import { Language, useI18n } from "../../../i18n";

export function LanguageTab() {
  const { language, setLanguage, t } = useI18n();

  return (
    <section className="profile-tab-panel">
      <label>
        {t("Select Language")}
        <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
          <option value="en">{t("English")}</option>
          <option value="mr">{t("Marathi")}</option>
        </select>
      </label>
    </section>
  );
}
