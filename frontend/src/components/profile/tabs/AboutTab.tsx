import { SessionUser } from "../../../api/client";
import { useI18n } from "../../../i18n";

export function AboutTab({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  return (
    <section className="profile-tab-panel">
      <div className="profile-detail">
        <span>{t("Organisation")}</span>
        <strong>{user.organisationName}</strong>
      </div>
      <div className="profile-detail">
        <span>{t("Name")}</span>
        <strong>{user.name}</strong>
      </div>
      <div className="profile-detail">
        <span>{t("Email")}</span>
        <strong>{user.email}</strong>
      </div>
      <div className="profile-detail">
        <span>{t("Role")}</span>
        <strong>{t(user.role.replace("_", " "))}</strong>
      </div>
    </section>
  );
}
