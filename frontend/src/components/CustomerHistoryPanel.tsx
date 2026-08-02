import { useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

type CustomerHistory = {
  id: string;
  comment: string;
  createdAt: string;
  user?: { name: string; role: string } | null;
};

export function CustomerHistoryPanel({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CustomerHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function toggleHistory() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      setHistory(await api<CustomerHistory[]>(`/customers/${customerId}/history`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Load History");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="history-panel">
      <button onClick={toggleHistory}>{open ? t("Hide History") : t("View History")}</button>
      {open && (
        <div className="history-list">
          {loading && <p className="empty">{t("Loading History...")}</p>}
          {error && <p className="error">{t(error)}</p>}
          {!loading && !error && history.length === 0 && <p className="empty">{t("No History Recorded Yet.")}</p>}
          {history.map((item) => (
            <article className="history-event" key={item.id}>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              <strong>{item.comment}</strong>
              <small>{item.user ? `${item.user.name} · ${t(item.user.role.replace("_", " "))}` : "System"}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
