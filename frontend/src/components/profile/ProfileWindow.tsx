import { useState } from "react";
import { X } from "lucide-react";
import { SessionUser } from "../../api/client";
import type { ProfileToolTabs } from "../Shell";
import { AboutTab } from "./tabs/AboutTab";
import { ChangePasswordTab } from "./tabs/ChangePasswordTab";
import { LanguageTab } from "./tabs/LanguageTab";
import { LogoutTab } from "./tabs/LogoutTab";
import { InternetSettingsTab } from "./tabs/InternetSettingsTab";
import { MailNotificationTab } from "./tabs/MailNotificationTab";
import { ThemeTab } from "./tabs/ThemeTab";
import { useI18n } from "../../i18n";

type ProfileTab = "about" | "add" | "lists" | "ledger" | "payments" | "internet" | "mail" | "password" | "language" | "theme" | "logout";

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
  profileTools?: ProfileToolTabs;
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
            {profileTools?.add && <button className={tab === "add" ? "active-tab" : ""} onClick={() => setTab("add")}>{t("Add")}</button>}
            {profileTools?.lists && <button className={tab === "lists" ? "active-tab" : ""} onClick={() => setTab("lists")}>{t("Lists")}</button>}
            {profileTools?.ledger && <button className={tab === "ledger" ? "active-tab" : ""} onClick={() => setTab("ledger")}>{t("Employee Ledger")}</button>}
            {profileTools?.payments && <button className={tab === "payments" ? "active-tab" : ""} onClick={() => setTab("payments")}>{t("Payment History")}</button>}
            {user.role === "ADMIN" && <button className={tab === "internet" ? "active-tab" : ""} onClick={() => setTab("internet")}>{t("Internet Settings")}</button>}
            {user.role === "ADMIN" && <button className={tab === "mail" ? "active-tab" : ""} onClick={() => setTab("mail")}>{t("Mail Notification")}</button>}
            <button className={tab === "password" ? "active-tab" : ""} onClick={() => setTab("password")}>{t("Change Password")}</button>
            <button className={tab === "language" ? "active-tab" : ""} onClick={() => setTab("language")}>{t("Language")}</button>
            <button className={tab === "theme" ? "active-tab" : ""} onClick={() => setTab("theme")}>{t("Theme")}</button>
            <button className={tab === "logout" ? "active-tab" : ""} onClick={() => setTab("logout")}>{t("Logout")}</button>
          </nav>
          <div className="profile-content">
            {tab === "about" && <AboutTab user={user} />}
            {tab === "add" && profileTools?.add}
            {tab === "lists" && profileTools?.lists}
            {tab === "ledger" && profileTools?.ledger}
            {tab === "payments" && profileTools?.payments}
            {tab === "internet" && <InternetSettingsTab user={user} onUserChange={onUserChange} />}
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
