import { useEffect, useState } from "react";
import { clearSession, getSavedUser, SessionUser } from "./api/client";
import { AppErrorAlert } from "./components/AppErrorAlert";
import { Login } from "./components/Login";
import { useI18n } from "./i18n";
import { SuperAdmin } from "./pages/SuperAdmin";
import { Workspace } from "./pages/Workspace";

export function App() {
  const [user, setUser] = useState<SessionUser | null>(getSavedUser());
  const { setLanguage } = useI18n();

  useEffect(() => {
    setLanguage(user?.preferredLanguage ?? "en");
  }, [setLanguage, user?.preferredLanguage]);

  return (
    <>
      <AppErrorAlert />
      {!user ? (
        <Login onLogin={setUser} />
      ) : user.role === "SUPER_ADMIN" ? (
        <SuperAdmin user={user} onLogout={() => logout(setUser)} onUserChange={setUser} />
      ) : (
        <Workspace user={user} onLogout={() => logout(setUser)} onUserChange={setUser} />
      )}
    </>
  );
}

function logout(setUser: (user: SessionUser | null) => void) {
  clearSession();
  setUser(null);
}
