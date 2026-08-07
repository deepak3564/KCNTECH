import { type ReactNode, useState } from "react";
import { X } from "lucide-react";
import { SessionUser } from "../../api/client";
import { AboutTab } from "./tabs/AboutTab";
import { ChangePasswordTab } from "./tabs/ChangePasswordTab";
import { LanguageTab } from "./tabs/LanguageTab";
import { LogoutTab } from "./tabs/LogoutTab";
import { MailNotificationTab } from "./tabs/MailNotificationTab";
import { ThemeTab } from "./tabs/ThemeTab";
import { useI18n } from "../../i18n";

type ProfileTab = "about" | "manage" | "mail" | "password" | "language" | "theme" | "logout";

export function ProfileWindow({
  user,
  onUserChange,
  onLogout,
  onClose,
  profileTools
}: {
  user: SessionUser;
  onUserChange: (user: SessionUser) => void;
  onLogout: () => void;
  onClose: () => void;
  profileTools?: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTab>("about");
  const { t } = useI18n();

  return (
    <div className="profile-backdrop" role="dialog" aria-modal="true">
      <section className="profile-window">
        <header className="profile-header">
          <div>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="small-button" onClick={onClose} title={t("Close")}><X size={16} /></button>
        </header>
        <div className="profile-body">
          <nav className="profile-nav">
            <button className={tab === "about" ? "active-tab" : ""} onClick={() => setTab("about")}>{t("About")}</button>
            {profileTools && <button className={tab === "manage" ? "active-tab" : ""} onClick={() => setTab("manage")}>{t("Manage")}</button>}
            {user.role === "ADMIN" && <button className={tab === "mail" ? "active-tab" : ""} onClick={() => setTab("mail")}>{t("Mail Notification")}</button>}
            <button className={tab === "password" ? "active-tab" : ""} onClick={() => setTab("password")}>{t("Change Password")}</button>
            <button className={tab === "language" ? "active-tab" : ""} onClick={() => setTab("language")}>{t("Language")}</button>
            <button className={tab === "theme" ? "active-tab" : ""} onClick={() => setTab("theme")}>{t("Theme")}</button>
            <button className={tab === "logout" ? "active-tab" : ""} onClick={() => setTab("logout")}>{t("Logout")}</button>
          </nav>
          <div className="profile-content">
            {tab === "about" && <AboutTab user={user} />}
            {tab === "manage" && profileTools}
            {tab === "mail" && <MailNotificationTab />}
            {tab === "password" && <ChangePasswordTab user={user} onUserChange={onUserChange} />}
            {tab === "language" && <LanguageTab user={user} onUserChange={onUserChange} />}
            {tab === "theme" && <ThemeTab user={user} onUserChange={onUserChange} />}
            {tab === "logout" && <LogoutTab onLogout={onLogout} />}
          </div>
        </div>
      </section>
    </div>
  );
}
