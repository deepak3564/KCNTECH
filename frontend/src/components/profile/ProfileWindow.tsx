import { ReactNode, useEffect, useState } from "react";
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

type ProfileTab = "about" | "add" | "lists" | "ledger" | "collectionSummary" | "payments" | "deletedCustomers" | "deletedSetTopBoxes" | "internet" | "mail" | "password" | "language" | "theme" | "logout";
type ActiveProfileTab = ProfileTab | "";

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
  const [tab, setTab] = useState<ActiveProfileTab>("about");
  const [isMobileProfile, setIsMobileProfile] = useState(false);
  const { t } = useI18n();
  const tabContent = tab ? renderProfileTab(tab, { user, onUserChange, onLogout, profileTools }) : null;
  const tabButtons: Array<{ key: ProfileTab; label: string; visible: boolean }> = [
    { key: "about", label: t("About"), visible: true },
    { key: "add", label: t("Add"), visible: Boolean(profileTools?.add) },
    { key: "lists", label: t("Lists"), visible: Boolean(profileTools?.lists) },
    { key: "ledger", label: t("Employee Ledger"), visible: Boolean(profileTools?.ledger) },
    { key: "collectionSummary", label: t("Employee Collection Summary"), visible: Boolean(profileTools?.collectionSummary) },
    { key: "payments", label: t("Payment History"), visible: Boolean(profileTools?.payments) },
    { key: "deletedCustomers", label: t("Deleted Customers"), visible: Boolean(profileTools?.deletedCustomers) },
    { key: "deletedSetTopBoxes", label: t("Deleted STB"), visible: Boolean(profileTools?.deletedSetTopBoxes) },
    { key: "internet", label: t("Internet Settings"), visible: user.role === "ADMIN" },
    { key: "mail", label: t("Mail Notification"), visible: user.role === "ADMIN" },
    { key: "password", label: t("Change Password"), visible: true },
    { key: "language", label: t("Language"), visible: true },
    { key: "theme", label: t("Theme"), visible: true },
    { key: "logout", label: t("Logout"), visible: true }
  ];

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobileProfile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
            {tabButtons.filter((item) => item.visible).map((item) => (
              <div className="profile-nav-item" key={item.key}>
                <button className={tab === item.key ? "active-tab" : ""} data-profile-tab={item.key} onClick={() => setTab((current) => current === item.key ? "" : item.key)}>{item.label}</button>
                {isMobileProfile && (
                  <div className={`profile-mobile-content ${tab === item.key ? "open" : ""}`}>
                    {tab === item.key && tabContent}
                  </div>
                )}
              </div>
            ))}
          </nav>
          {!isMobileProfile && tabContent && <div className="profile-content">{tabContent}</div>}
        </div>
      </section>
    </div>
  );
}

function renderProfileTab(
  tab: ProfileTab,
  {
    user,
    onUserChange,
    onLogout,
    profileTools
  }: {
    user: SessionUser;
    onUserChange: (user: SessionUser) => void;
    onLogout: () => void;
    profileTools?: ProfileToolTabs;
  }
): ReactNode {
  if (tab === "about") return <AboutTab user={user} />;
  if (tab === "add") return profileTools?.add;
  if (tab === "lists") return profileTools?.lists;
  if (tab === "ledger") return profileTools?.ledger;
  if (tab === "collectionSummary") return profileTools?.collectionSummary;
  if (tab === "payments") return profileTools?.payments;
  if (tab === "deletedCustomers") return profileTools?.deletedCustomers;
  if (tab === "deletedSetTopBoxes") return profileTools?.deletedSetTopBoxes;
  if (tab === "internet") return <InternetSettingsTab user={user} onUserChange={onUserChange} />;
  if (tab === "mail") return <MailNotificationTab />;
  if (tab === "password") return <ChangePasswordTab user={user} onUserChange={onUserChange} />;
  if (tab === "language") return <LanguageTab user={user} onUserChange={onUserChange} />;
  if (tab === "theme") return <ThemeTab user={user} onUserChange={onUserChange} />;
  return <LogoutTab onLogout={onLogout} />;
}
