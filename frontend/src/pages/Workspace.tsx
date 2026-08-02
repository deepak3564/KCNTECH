import { useEffect, useState } from "react";
import { ReceiptIndianRupee, Search } from "lucide-react";
import { api, SessionUser } from "../api/client";
import { Box, Customer, Dashboard, Employee, Plan } from "../types";
import { AdminQuickCreate } from "../components/AdminQuickCreate";
import { CustomerCard } from "../components/CustomerCard";
import { CustomerDrawer } from "../components/CustomerDrawer";
import { DashboardCards } from "../components/DashboardCards";
import { EmployeeLedger } from "../components/EmployeeLedger";
import { PaymentHistoryReport } from "../components/PaymentHistoryReport";
import { SetupLists } from "../components/SetupLists";
import { Shell } from "../components/Shell";
import { useI18n } from "../i18n";

export function Workspace({ user, onLogout, onUserChange }: { user: SessionUser; onLogout: () => void; onUserChange: (user: SessionUser) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [query, setQuery] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [generatingBills, setGeneratingBills] = useState(false);
  const { t } = useI18n();

  async function load() {
    const params = new URLSearchParams({ month: String(month), year: String(year), ...(query ? { q: query } : {}), ...(paymentStatus ? { paymentStatus } : {}) });
    const [dash, list] = await Promise.all([
      api<Dashboard>(`/reports/dashboard?month=${month}&year=${year}`),
      api<Customer[]>(`/customers?${params.toString()}`)
    ]);
    setDashboard(dash);
    setCustomers(list);
    setSelected((current) => current ? list.find((customer) => customer.id === current.id) ?? current : null);
    if (user.role === "ADMIN") {
      const [planList, employeeList, boxList] = await Promise.all([
        api<Plan[]>("/admin/plans"),
        api<Employee[]>("/admin/employees"),
        api<Box[]>("/admin/set-top-boxes")
      ]);
      setPlans(planList);
      setEmployees(employeeList);
      setBoxes(boxList);
    }
  }

  useEffect(() => { load().catch(console.error); }, [month, year, paymentStatus]);

  async function generateBills() {
    setBillingMessage("");
    setGeneratingBills(true);
    try {
      await api("/admin/generate-monthly-bills", { method: "POST", body: JSON.stringify({ month, year }) });
      await load();
      setBillingMessage("Monthly Bills Generated Successfully.");
    } finally {
      setGeneratingBills(false);
    }
  }

  return (
    <Shell user={user} onLogout={onLogout} onUserChange={onUserChange}>
      <main className="content">
        <section className="period-row">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString("en", { month: "short" })}</option>)}</select>
          <input value={year} onChange={(e) => setYear(Number(e.target.value))} />
          {user.role === "ADMIN" && <button onClick={generateBills} disabled={generatingBills}><ReceiptIndianRupee size={16} /> {generatingBills ? t("Generating Bills") : t("Generate Bills")}</button>}
        </section>
        {billingMessage && <p className="success notice">{t(billingMessage)}</p>}
        {dashboard && <DashboardCards dashboard={dashboard} />}
        <section className="tool-row">
          <label className="search"><Search size={16} /><input placeholder={t("Search Name, Phone, STB, Card")} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></label>
          <button onClick={load}><Search size={16} /> {t("Search")}</button>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="">{t("All Payment")}</option><option value="PENDING">{t("Pending")}</option><option value="PARTIAL">{t("Partial")}</option><option value="PAID">{t("Paid")}</option>
          </select>
        </section>
        {user.role === "ADMIN" && <AdminQuickCreate plans={plans} employees={employees} boxes={boxes} month={month} year={year} reload={load} />}
        {user.role === "ADMIN" && <SetupLists plans={plans} employees={employees} boxes={boxes} reload={load} />}
        <EmployeeLedger user={user} employees={employees} />
        {user.role === "ADMIN" && <PaymentHistoryReport employees={employees} organisationName={user.organisationName} />}
        <section className="customer-list">
          {customers.map((customer) => <CustomerCard key={customer.id} customer={customer} onOpen={() => setSelected(customer)} />)}
        </section>
      </main>
      {selected && <CustomerDrawer customer={selected} user={user} plans={plans} employees={employees} boxes={boxes} month={month} year={year} onClose={() => setSelected(null)} onRefresh={load} />}
    </Shell>
  );
}
