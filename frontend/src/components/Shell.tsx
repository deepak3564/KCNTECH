import React from "react";
import { SessionUser } from "../api/client";
import { useI18n } from "../i18n";
import { ProfileMenu } from "./profile/ProfileMenu";

export type ProfileToolTabs = {
  add?: React.ReactNode;
  lists?: React.ReactNode;
  ledger?: React.ReactNode;
  collectionSummary?: React.ReactNode;
  payments?: React.ReactNode;
  deletedCustomers?: React.ReactNode;
  deletedSetTopBoxes?: React.ReactNode;
};

export function Shell({
  user,
  onLogout,
  onUserChange,
  children,
  profileTools
}: {
  user: SessionUser;
  onLogout: () => void;
  onUserChange: (user: SessionUser) => void;
  children: React.ReactNode;
  profileTools?: ProfileToolTabs;
}) {
  const { t } = useI18n();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>{user.organisationName}</strong>
          <span>{user.name} · {t(user.role.replace("_", " "))}</span>
        </div>
        <ProfileMenu user={user} onUserChange={onUserChange} onLogout={onLogout} profileTools={profileTools} />
      </header>
      {children}
    </div>
  );
}
