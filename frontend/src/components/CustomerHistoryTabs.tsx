import { useState } from "react";
import { api, money } from "../api/client";
import { useI18n } from "../i18n";
import { CustomerPlanHistory } from "../types";

type CustomerHistory = {
  id: string;
  comment: string;
  createdAt: string;
  user?: { name: string; role: string } | null;
};

type ActiveHistoryTab = "history" | "plans" | null;

export function CustomerHistoryTabs({ customerId, internetEnabled }: { customerId: string; internetEnabled: boolean }) {
  const [activeTab, setActiveTab] = useState<ActiveHistoryTab>(null);
  const [history, setHistory] = useState<CustomerHistory[]>([]);
  const [planHistory, setPlanHistory] = useState<CustomerPlanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function showHistory() {
    if (activeTab === "history") {
      setActiveTab(null);
      return;
    }
    setActiveTab("history");
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

  async function showPlanHistory() {
    if (activeTab === "plans") {
      setActiveTab(null);
      return;
    }
    setActiveTab("plans");
    setLoading(true);
    setError("");
    try {
      setPlanHistory(await api<CustomerPlanHistory[]>(`/customers/${customerId}/plan-history`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Load Plan History");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="customer-history-tabs">
      <div className="customer-history-tab-buttons">
        <button className={activeTab === "history" ? "active-tab" : ""} onClick={showHistory}>{activeTab === "history" ? t("Hide Customer History") : t("Customer History")}</button>
        <button className={activeTab === "plans" ? "active-tab" : ""} onClick={showPlanHistory}>{activeTab === "plans" ? t("Hide Plan History") : t("Plan History")}</button>
      </div>
      {activeTab && (
        <div className="customer-history-tab-content">
          <div className="history-list">
            {loading && <p className="empty">{activeTab === "history" ? t("Loading History...") : t("Loading Plan History...")}</p>}
            {error && <p className="error">{t(error)}</p>}
            {!loading && !error && activeTab === "history" && history.length === 0 && <p className="empty">{t("No History Recorded Yet.")}</p>}
            {!loading && !error && activeTab === "plans" && planHistory.length === 0 && <p className="empty">{t("No Plan History Recorded Yet.")}</p>}
            {!loading && !error && activeTab === "history" && history.map((item) => (
              <article className="history-event" key={item.id}>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>{item.comment}</strong>
                <small>{item.user ? `${item.user.name} · ${t(item.user.role.replace("_", " "))}` : "System"}</small>
              </article>
            ))}
            {!loading && !error && activeTab === "plans" && planHistory.map((item) => (
              <article className="history-event" key={item.id}>
                <span>{item.customerName} · {new Date(2024, item.month - 1).toLocaleString("en", { month: "short" })} {item.year}</span>
                <strong>{t("Cable")}: {item.cablePlanName ? `${item.cablePlanName} · ${money(item.cablePrice)}` : "NA"}</strong>
                {internetEnabled && <strong>{t("Internet")}: {item.internetPlanName ? `${item.internetPlanName} · ${money(item.internetPrice)}` : "NA"}</strong>}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
