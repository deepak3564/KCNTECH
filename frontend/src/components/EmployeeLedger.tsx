import React, { useState } from "react";
import { ReceiptIndianRupee } from "lucide-react";
import { api, money, SessionUser } from "../api/client";
import { useI18n } from "../i18n";
import { Employee } from "../types";

type HandoverHistory = {
  id: string;
  amount: number;
  fromDate: string;
  toDate: string;
  handedOverAt: string;
  note?: string | null;
  employee: { id: string; name: string; email: string };
};

export function EmployeeLedger({ user, employees }: { user: SessionUser; employees: Employee[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [ledger, setLedger] = useState<{ collected: number; handedOver: number; balanceDueFromEmployee: number } | null>(null);
  const [showHandoverHistory, setShowHandoverHistory] = useState(false);
  const [handoverHistory, setHandoverHistory] = useState<HandoverHistory[]>([]);
  const [historyEmployeeId, setHistoryEmployeeId] = useState("");
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [error, setError] = useState("");
  const { t } = useI18n();

  async function loadLedger() {
    setError("");
    if (!isValidDateRange(fromDate, toDate)) {
      setError("To Date Cannot Be Earlier Than From Date.");
      return;
    }
    if (user.role === "ADMIN" && !employeeId) {
      setError("Please Select Employee.");
      return;
    }
    const params = new URLSearchParams({ fromDate, toDate, ...(user.role === "ADMIN" ? { employeeId } : {}) });
    setLedger(await api(`/reports/employee-ledger?${params.toString()}`));
  }

  async function toggleHandoverHistory() {
    setError("");
    if (showHandoverHistory) {
      setShowHandoverHistory(false);
      return;
    }
    if (!isValidDateRange(fromDate, toDate)) {
      setError("To Date Cannot Be Earlier Than From Date.");
      return;
    }
    const params = new URLSearchParams({ fromDate, toDate, ...(historyEmployeeId ? { employeeId: historyEmployeeId } : {}) });
    setHandoverHistory(await api<HandoverHistory[]>(`/reports/handover-history?${params.toString()}`));
    setShowHandoverHistory(true);
  }

  async function saveHandover(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!employeeId) {
      setError("Please Select Employee.");
      return;
    }
    if (!isValidDateRange(fromDate, toDate)) {
      setError("To Date Cannot Be Earlier Than From Date.");
      return;
    }
    if (!handoverAmount || Number(handoverAmount) <= 0) {
      setError("Please Enter Handover Amount.");
      return;
    }
    await api("/admin/handovers", {
      method: "POST",
      body: JSON.stringify({ employeeId, amount: handoverAmount, fromDate, toDate, note: handoverNote.trim() || "Cash/UPI submitted to admin" })
    });
    setHandoverAmount("");
    setHandoverNote("");
    loadLedger();
  }

  return (
    <section className="admin-panel">
      <h2><ReceiptIndianRupee size={20} /> {t("Employee Ledger")}</h2>
      <div className="ledger-row">
        {user.role === "ADMIN" && <label>{t("Employee")}<select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">{t("Select Employee")}</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label>{t("From")}<input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} /></label>
        <label>{t("To")}<input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} /></label>
        <button onClick={loadLedger}>{t("View")}</button>
      </div>
      {ledger && <div className="metrics ledger-metrics">
        <div className="metric"><span>{t("Collected")}</span><strong>{money(ledger.collected)}</strong></div>
        <div className="metric"><span>{t("Given To Admin")}</span><strong>{money(ledger.handedOver)}</strong></div>
        <div className="metric"><span>{t("Balance Due")}</span><strong>{money(ledger.balanceDueFromEmployee)}</strong></div>
      </div>}
      {ledger && <p className="ledger-note">{t("Ledger Counts Cash And Employee UPI Only.")}</p>}
      {user.role === "ADMIN" && <form className="ledger-row" onSubmit={saveHandover}>
        <label>{t("Received Amount")}<input value={handoverAmount} onChange={(e) => setHandoverAmount(e.target.value)} /></label>
        <label>{t("Comment")}<input value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} /></label>
        <button className="primary">{t("Record Handover")}</button>
      </form>}
      {user.role === "ADMIN" && (
        <section className="handover-history-panel">
          <div className="ledger-row">
            <label>{t("From Employee")}<select value={historyEmployeeId} onChange={(e) => setHistoryEmployeeId(e.target.value)}><option value="">{t("All Employees")}</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <button type="button" onClick={toggleHandoverHistory}>{showHandoverHistory ? t("Hide Handover History") : t("View Handover History")}</button>
          </div>
          {showHandoverHistory && (
            <div className="handover-history-list">
              {handoverHistory.length === 0 && <p className="empty">{t("No Handover History Found.")}</p>}
              {handoverHistory.map((item) => (
                <article className="handover-history-row" key={item.id}>
                  <span>{t("Employee")}<strong>{item.employee.name}</strong></span>
                  <span>{t("Amount")}<strong>{money(item.amount)}</strong></span>
                  <span>{t("From")}<strong>{formatDate(item.fromDate)}</strong></span>
                  <span>{t("To")}<strong>{formatDate(item.toDate)}</strong></span>
                  <span>{t("Date")}<strong>{formatDate(item.handedOverAt)}</strong></span>
                  <span>{t("Notes")}<strong>{item.note || "NA"}</strong></span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {error && <p className="error inline-error">{t(error)}</p>}
    </section>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function isValidDateRange(fromDate: string, toDate: string) {
  return !fromDate || !toDate || fromDate <= toDate;
}
