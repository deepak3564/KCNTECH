import { useState } from "react";
import { Download, Search } from "lucide-react";
import { api, money, uploadUrl } from "../api/client";
import { useI18n } from "../i18n";
import { Employee } from "../types";

type PaymentHistoryResponse = {
  totals: { total: number; CASH: number; ADMIN_UPI: number; EMPLOYEE_UPI: number };
  payments: Array<{
    id: string;
    amount: number;
    mode: "CASH" | "ADMIN_UPI" | "EMPLOYEE_UPI";
    paidAt: string;
    proofImageUrl?: string | null;
    employee?: { id: string; name: string; email: string } | null;
    billing: {
      month: number;
      year: number;
      customer: { firstName: string; lastName?: string | null; phone?: string | null };
    };
  }>;
};

export function PaymentHistoryReport({ employees, organisationName }: { employees: Employee[]; organisationName: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [mode, setMode] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<PaymentHistoryResponse | null>(null);
  const [error, setError] = useState("");
  const { t } = useI18n();

  function paymentHistoryParams() {
    return new URLSearchParams({
      fromDate,
      toDate,
      ...(employeeId ? { employeeId } : {}),
      ...(mode ? { mode } : {}),
      ...(query.trim() ? { q: query.trim() } : {})
    });
  }

  async function toggle() {
    setError("");
    if (open) {
      setOpen(false);
      return;
    }
    await loadHistory();
    setOpen(true);
  }

  async function loadHistory() {
    setError("");
    const nextHistory = await api<PaymentHistoryResponse>(`/reports/payment-history?${paymentHistoryParams().toString()}`);
    setHistory(nextHistory);
    return nextHistory;
  }

  async function exportPdf() {
    setError("");
    const report = await loadHistory();
    if (!report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Could Not Open Export Window.");
      return;
    }
    printWindow.document.write(paymentHistoryPdfHtml({
      report,
      title: `${organisationName}: ${t("Payment Report")}`,
      filters: [
        [t("From"), fromDate],
        [t("To"), toDate],
        [t("Employee"), employees.find((employee) => employee.id === employeeId)?.name ?? t("All Employees")],
        [t("Mode"), mode ? t(mode) : t("All Modes")],
        [t("Search Customer"), query.trim() || t("All")]
      ],
      labels: {
        generatedOn: t("Generated On"),
        total: t("Total"),
        cash: t("Cash"),
        adminUpi: t("Admin UPI"),
        employeeUpi: t("Employee UPI"),
        customer: t("Customer"),
        billMonth: t("Bill Month"),
        amount: t("Amount"),
        mode: t("Mode"),
        collectedBy: t("Collected By"),
        date: t("Date"),
        admin: t("Admin")
      }
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <section className="admin-panel payment-report-panel">
      <h2>{t("Payment History")}</h2>
      <div className="payment-report-filters">
        <label>{t("From")}<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>{t("To")}<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <label>{t("Employee")}<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">{t("All Employees")}</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>{t("Mode")}<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="">{t("All Modes")}</option><option value="CASH">{t("Cash")}</option><option value="ADMIN_UPI">{t("Admin UPI")}</option><option value="EMPLOYEE_UPI">{t("Employee UPI")}</option></select></label>
        <label className="search"><Search size={16} /><input placeholder={t("Search Customer ID, Name, STB, Card")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <button type="button" onClick={toggle}>{open ? t("Hide Payment History") : t("View Payment History")}</button>
        {open && <button type="button" onClick={loadHistory}>{t("Search")}</button>}
        {open && <button type="button" onClick={exportPdf}>{t("Export PDF")}</button>}
      </div>
      {error && <p className="error inline-error">{t(error)}</p>}
      {open && history && (
        <>
          <div className="metrics payment-mode-metrics">
            <div className="metric"><span>{t("Total")}</span><strong>{money(history.totals.total)}</strong></div>
            <div className="metric"><span>{t("Cash")}</span><strong>{money(history.totals.CASH)}</strong></div>
            <div className="metric"><span>{t("Admin UPI")}</span><strong>{money(history.totals.ADMIN_UPI)}</strong></div>
            <div className="metric"><span>{t("Employee UPI")}</span><strong>{money(history.totals.EMPLOYEE_UPI)}</strong></div>
          </div>
          <div className="payment-report-list">
            {history.payments.length === 0 && <p className="empty">{t("No Payment History Found.")}</p>}
            {history.payments.map((payment) => (
              <article className="payment-report-row" key={payment.id}>
                <span>{t("Customer")}<strong>{customerName(payment.billing.customer)}</strong></span>
                <span>{t("Bill Month")}<strong>{payment.billing.month}/{payment.billing.year}</strong></span>
                <span>{t("Amount")}<strong>{money(payment.amount)}</strong></span>
                <span>{t("Mode")}<strong>{t(payment.mode)}</strong></span>
                <span>{t("Collected By")}<strong>{payment.employee?.name ?? t("Admin")}</strong></span>
                <span>{t("Date")}<strong>{new Date(payment.paidAt).toLocaleDateString()}</strong></span>
                {payment.proofImageUrl && <a className="download-image-button" href={uploadUrl(payment.proofImageUrl)} download target="_blank" rel="noreferrer" title={t("Download Image")} aria-label={t("Download Image")}><Download size={15} /></a>}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function customerName(customer: { firstName: string; lastName?: string | null }) {
  return `${customer.firstName} ${customer.lastName ?? ""}`.trim();
}

function paymentHistoryPdfHtml({
  report,
  title,
  filters,
  labels
}: {
  report: PaymentHistoryResponse;
  title: string;
  filters: Array<[string, string]>;
  labels: Record<string, string>;
}) {
  const rows = report.payments.map((payment) => `
    <tr>
      <td>${escapeHtml(customerName(payment.billing.customer))}</td>
      <td>${payment.billing.month}/${payment.billing.year}</td>
      <td>${escapeHtml(money(payment.amount))}</td>
      <td>${escapeHtml(payment.mode)}</td>
      <td>${escapeHtml(payment.employee?.name ?? labels.admin)}</td>
      <td>${escapeHtml(new Date(payment.paidAt).toLocaleDateString())}</td>
    </tr>
  `).join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1d2528; margin: 28px; }
        h1 { margin: 0 0 6px; font-size: 22px; }
        .muted { color: #63706c; font-size: 12px; margin-bottom: 18px; }
        .filters, .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0 18px; }
        .box { border: 1px solid #dbe4e1; border-radius: 6px; padding: 8px; background: #f8faf9; }
        .box span { display: block; color: #63706c; font-size: 11px; }
        .box strong { display: block; margin-top: 3px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border-bottom: 1px solid #dbe4e1; padding: 8px; text-align: left; }
        th { background: #edf7f3; }
        @media print { body { margin: 18px; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="muted">${escapeHtml(labels.generatedOn)}: ${escapeHtml(new Date().toLocaleString())}</div>
      <section class="filters">
        ${filters.map(([label, value]) => `<div class="box"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </section>
      <section class="totals">
        <div class="box"><span>${escapeHtml(labels.total)}</span><strong>${escapeHtml(money(report.totals.total))}</strong></div>
        <div class="box"><span>${escapeHtml(labels.cash)}</span><strong>${escapeHtml(money(report.totals.CASH))}</strong></div>
        <div class="box"><span>${escapeHtml(labels.adminUpi)}</span><strong>${escapeHtml(money(report.totals.ADMIN_UPI))}</strong></div>
        <div class="box"><span>${escapeHtml(labels.employeeUpi)}</span><strong>${escapeHtml(money(report.totals.EMPLOYEE_UPI))}</strong></div>
      </section>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(labels.customer)}</th>
            <th>${escapeHtml(labels.billMonth)}</th>
            <th>${escapeHtml(labels.amount)}</th>
            <th>${escapeHtml(labels.mode)}</th>
            <th>${escapeHtml(labels.collectedBy)}</th>
            <th>${escapeHtml(labels.date)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
