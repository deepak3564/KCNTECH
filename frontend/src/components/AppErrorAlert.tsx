import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { useI18n } from "../i18n";

type AppErrorEvent = CustomEvent<{ message: string }>;

export function AppErrorAlert() {
  const [message, setMessage] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    function showError(event: Event) {
      const detail = (event as AppErrorEvent).detail;
      setMessage(detail?.message || "Something Went Wrong. Please Try Again.");
    }

    window.addEventListener("app-error", showError);
    return () => window.removeEventListener("app-error", showError);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div className="app-alert" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>{t("Action Could Not Be Completed")}</strong>
        <span>{t(message)}</span>
      </div>
      <button className="small-button" onClick={() => setMessage("")} title={t("Close Alert")}>
        <X size={15} />
      </button>
    </div>
  );
}
