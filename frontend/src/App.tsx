import { useCallback, useEffect, useState } from "react";
import { clearSession, getSavedUser, SessionUser } from "./api/client";
import { AppErrorAlert } from "./components/AppErrorAlert";
import { Login } from "./components/Login";
import { useApiLoading } from "./hooks/useApiLoading";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { useI18n } from "./i18n";
import { SuperAdmin } from "./pages/SuperAdmin";
import { Workspace } from "./pages/Workspace";

export function App() {
  const [user, setUser] = useState<SessionUser | null>(getSavedUser());
  const { setLanguage, t } = useI18n();
  const { isLoading: isApiLoading, progress: apiProgress } = useApiLoading();
  const handleLogout = useCallback(() => logout(setUser), []);

  const { secondsRemaining, staySignedIn } = useSessionTimeout(Boolean(user), handleLogout);

  useEffect(() => {
    setLanguage(user?.preferredLanguage ?? "en");
  }, [setLanguage, user?.preferredLanguage]);

  useEffect(() => {
    document.documentElement.dataset.theme = user?.preferredTheme ?? "professional";
  }, [user?.preferredTheme]);

  return (
    <>
      <AppErrorAlert />
      {isApiLoading && (
        <div className="api-loading-backdrop" role="status" aria-live="polite">
          <div className="api-loading">
            <span className="api-loader-mark">
              <span />
              <span />
              <span />
            </span>
            <strong>{apiProgress}%</strong>
            <div className="api-progress-track">
              <span style={{ width: `${apiProgress}%` }} />
            </div>
            <div>
              <strong>{t("Please Wait")}</strong>
              <small>{t("Syncing Latest Business Data")}</small>
            </div>
          </div>
        </div>
      )}
      {user && secondsRemaining !== null && (
        <section className="session-warning" role="alert" aria-live="polite">
          <div>
            <strong>You Will Be Logged Out Soon</strong>
            <span>You will be logged out in {secondsRemaining} seconds.</span>
          </div>
          <button onClick={staySignedIn}>Stay Signed In</button>
        </section>
      )}
      {!user ? (
        <Login onLogin={setUser} />
      ) : user.role === "SUPER_ADMIN" ? (
        <SuperAdmin user={user} onLogout={handleLogout} onUserChange={setUser} />
      ) : (
        <Workspace user={user} onLogout={handleLogout} onUserChange={setUser} />
      )}
    </>
  );
}

function logout(setUser: (user: SessionUser | null) => void) {
  clearSession();
  setUser(null);
}
