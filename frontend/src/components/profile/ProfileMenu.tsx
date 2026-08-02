import { useState } from "react";
import { UserCircle } from "lucide-react";
import { SessionUser } from "../../api/client";
import { useI18n } from "../../i18n";
import { ProfileWindow } from "./ProfileWindow";

export function ProfileMenu({
  user,
  onUserChange,
  onLogout
}: {
  user: SessionUser;
  onUserChange: (user: SessionUser) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <button className="profile-button" onClick={() => setOpen(true)} title={t("Profile")}>
        <UserCircle size={22} />
      </button>
      {open && <ProfileWindow user={user} onUserChange={onUserChange} onLogout={onLogout} onClose={() => setOpen(false)} />}
    </>
  );
}
