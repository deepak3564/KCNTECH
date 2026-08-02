import { useState } from "react";
import { api, money } from "../api/client";
import { useI18n } from "../i18n";
import { CustomerPlanHistory } from "../types";

export function CustomerPlanHistoryPanel({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CustomerPlanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function togglePlanHistory() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      setHistory(await api<CustomerPlanHistory[]>(`/customers/${customerId}/plan-history`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Load Plan History");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="history-panel">
      <button onClick={togglePlanHistory}>{open ? t("Hide Plan History") : t("View Plan History")}</button>
      {open && (
        <div className="history-list">
          {loading && <p className="empty">{t("Loading Plan History...")}</p>}
          {error && <p className="error">{t(error)}</p>}
          {!loading && !error && history.length === 0 && <p className="empty">{t("No Plan History Recorded Yet.")}</p>}
          {history.map((item) => (
            <article className="history-event" key={item.id}>
              <span>{item.customerName} · {new Date(2024, item.month - 1).toLocaleString("en", { month: "short" })} {item.year}</span>
              <strong>{t("Cable")}: {item.cablePlanName ? `${item.cablePlanName} · ${money(item.cablePrice)}` : "NA"}</strong>
              <strong>{t("Internet")}: {item.internetPlanName ? `${item.internetPlanName} · ${money(item.internetPrice)}` : "NA"}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
