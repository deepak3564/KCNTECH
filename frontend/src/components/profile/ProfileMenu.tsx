import { useState } from "react";
import { UserCircle } from "lucide-react";
import { SessionUser } from "../../api/client";
import { useI18n } from "../../i18n";
import type { ProfileToolTabs } from "../Shell";
import { ProfileWindow } from "./ProfileWindow";

export function ProfileMenu({
  user,
  onUserChange,
  onLogout,
  profileTools
}: {
  user: SessionUser;
  onUserChange: (user: SessionUser) => void;
  onLogout: () => void;
  profileTools?: ProfileToolTabs;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <button className="profile-button" onClick={() => setOpen(true)} title={t("Profile")}>
        <UserCircle size={22} />
      </button>
      {open && <ProfileWindow user={user} onUserChange={onUserChange} onLogout={onLogout} onClose={() => setOpen(false)} profileTools={profileTools} />}
    </>
  );
}
