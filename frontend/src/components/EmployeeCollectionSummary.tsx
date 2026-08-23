import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { api, money } from "../api/client";
import { useI18n } from "../i18n";

type SummaryTotals = {
  assignedCustomers: number;
  expected: number;
  collected: number;
  pending: number;
  cashCollected: number;
  adminUpiCollected: number;
  employeeUpiCollected: number;
  handedOver: number;
  balanceDueFromCollector: number;
};

type SummaryRow = SummaryTotals & {
  collectorId: string | null;
  collectorName: string;
  collectorRole: "ADMIN" | "EMPLOYEE" | "UNASSIGNED";
  isActive: boolean;
};

type SummaryResponse = {
  month: number;
  year: number;
  totals: SummaryTotals;
  rows: SummaryRow[];
};

export function EmployeeCollectionSummary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function loadSummary() {
    setError("");
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      setSummary(await api<SummaryResponse>(`/reports/employee-collection-summary?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Load Employee Collection Summary");
    }
  }

  return (
    <section className="admin-panel collection-summary-panel">
      <h2><BarChart3 size={20} /> {t("Employee Collection Summary")}</h2>
      <div className="ledger-row">
        <label>{t("Month")}<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleString("en", { month: "short" })}</option>)}</select></label>
        <label>{t("Year")}<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{yearOptions(String(year)).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" onClick={loadSummary}>{t("View")}</button>
      </div>
      {error && <p className="error inline-error">{t(error)}</p>}
      {summary && (
        <>
          <div className="metrics collection-summary-metrics">
            <div className="metric"><span>{t("Assigned Customers")}</span><strong>{summary.totals.assignedCustomers}</strong></div>
            <div className="metric"><span>{t("Expected")}</span><strong>{money(summary.totals.expected)}</strong></div>
            <div className="metric"><span>{t("Collected")}</span><strong>{money(summary.totals.collected)}</strong></div>
            <div className="metric"><span>{t("Pending")}</span><strong>{money(summary.totals.pending)}</strong></div>
            <div className="metric"><span>{t("Given To Admin")}</span><strong>{money(summary.totals.handedOver)}</strong></div>
            <div className="metric"><span>{t("Balance Due")}</span><strong>{money(summary.totals.balanceDueFromCollector)}</strong></div>
          </div>
          <div className="collection-summary-list">
            {summary.rows.length === 0 && <p className="empty">{t("No Employee Collection Summary Found.")}</p>}
            {summary.rows.map((row) => (
              <article className="collection-summary-row" key={row.collectorId ?? row.collectorRole}>
                <div>
                  <strong>{row.collectorName}</strong>
                  <span>{row.collectorRole === "UNASSIGNED" ? t("Not Assigned") : t(row.collectorRole)}{!row.isActive && row.collectorRole !== "UNASSIGNED" ? ` · ${t("Inactive")}` : ""}</span>
                </div>
                <span>{t("Assigned Customers")}<strong>{row.assignedCustomers}</strong></span>
                <span>{t("Expected")}<strong>{money(row.expected)}</strong></span>
                <span>{t("Collected")}<strong>{money(row.collected)}</strong></span>
                <span>{t("Pending")}<strong>{money(row.pending)}</strong></span>
                <span>{t("Cash")}<strong>{money(row.cashCollected)}</strong></span>
                <span>{t("Admin UPI")}<strong>{money(row.adminUpiCollected)}</strong></span>
                <span>{t("Employee UPI")}<strong>{money(row.employeeUpiCollected)}</strong></span>
                <span>{t("Given To Admin")}<strong>{money(row.handedOver)}</strong></span>
                <span>{t("Balance Due")}<strong>{money(row.balanceDueFromCollector)}</strong></span>
              </article>
            ))}
          </div>
          <p className="ledger-note">{t("Balance Due Counts Cash And Employee UPI Minus Given To Admin.")}</p>
        </>
      )}
    </section>
  );
}

function yearOptions(value?: string) {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>();
  for (let year = currentYear - 1; year <= currentYear + 5; year += 1) years.add(year);
  const selectedYear = Number(value);
  if (Number.isInteger(selectedYear) && selectedYear > 1900) years.add(selectedYear);
  return Array.from(years).sort((a, b) => a - b);
}
