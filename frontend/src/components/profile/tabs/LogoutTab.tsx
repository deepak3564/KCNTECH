import { useI18n } from "../../../i18n";

export function LogoutTab({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n();
  return (
    <section className="profile-tab-panel">
      <div className="profile-detail">
        <span>{t("Current Session")}</span>
        <strong>{t("You Are Signed In On This Device")}</strong>
      </div>
      <button className="logout-button" onClick={onLogout}>{t("Logout")}</button>
    </section>
  );
}
