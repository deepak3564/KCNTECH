import { useEffect, useRef, useState } from "react";
import { ReceiptIndianRupee, Search } from "lucide-react";
import { api, SessionUser } from "../api/client";
import { Box, Customer, Dashboard, Employee, Plan } from "../types";
import { AdminQuickCreate } from "../components/AdminQuickCreate";
import { CustomerCard } from "../components/CustomerCard";
import { CustomerDrawer } from "../components/CustomerDrawer";
import { DashboardCards } from "../components/DashboardCards";
import { EmployeeLedger } from "../components/EmployeeLedger";
import { EmployeeCollectionSummary } from "../components/EmployeeCollectionSummary";
import { PaymentHistoryReport } from "../components/PaymentHistoryReport";
import { SetupListTabs } from "../components/SetupLists";
import { Shell } from "../components/Shell";
import { useI18n } from "../i18n";

export function Workspace({ user, onLogout, onUserChange }: { user: SessionUser; onLogout: () => void; onUserChange: (user: SessionUser) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [collectors, setCollectors] = useState<Employee[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [addressOpen, setAddressOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "customerIdAsc" | "customerIdDesc">("recent");
  const [billingMessage, setBillingMessage] = useState("");
  const [generatingBills, setGeneratingBills] = useState(false);
  const searchRequestId = useRef(0);
  const addressRequestId = useRef(0);
  const { t } = useI18n();

  async function load() {
    const params = customerParams();
    const [dash, list] = await Promise.all([
      api<Dashboard>(`/reports/dashboard?month=${month}&year=${year}`),
      api<Customer[]>(`/customers/search-cache?${params.toString()}`)
    ]);
    setDashboard(dash);
    setAllCustomers(list);
    setCustomers(filterCachedCustomers(list, query, addressQuery));
    setSelected((current) => current ? list.find((customer) => customer.id === current.id) ?? current : null);
    if (user.role === "ADMIN") {
      const [planList, employeeList, collectorList, boxList] = await Promise.all([
        api<Plan[]>("/admin/plans"),
        api<Employee[]>("/admin/employees"),
        api<Employee[]>("/admin/collectors"),
        api<Box[]>("/admin/set-top-boxes")
      ]);
      setPlans(planList);
      setEmployees(employeeList);
      setCollectors(collectorList);
      setBoxes(boxList);
    } else if (user.role === "EMPLOYEE") {
      const planList = await api<Plan[]>("/customers/cable-plans");
      setPlans(planList);
    }
  }

  function customerParams() {
    return new URLSearchParams({
      month: String(month),
      year: String(year),
      ...(paymentStatus ? { paymentStatus } : {})
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function loadWithRetry() {
      try {
        await load();
      } catch (error) {
        console.error(error);
        window.setTimeout(() => {
          if (!cancelled) load().catch(console.error);
        }, 1200);
      }
    }
    loadWithRetry();
    return () => { cancelled = true; };
  }, [month, year, paymentStatus]);

  useEffect(() => {
    const searchText = query.trim();
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    if (!searchText) {
      setSuggestions([]);
      setSearchOpen(false);
      setCustomers(filterCachedCustomers(allCustomers, "", addressQuery));
      return;
    }

    const timer = window.setTimeout(() => {
      if (searchRequestId.current !== requestId) return;
      const list = filterCachedCustomers(allCustomers, searchText, addressQuery);
      setCustomers(list);
      setSuggestions(list.slice(0, 12));
      setSearchOpen(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, addressQuery, allCustomers]);

  useEffect(() => {
    const searchText = addressQuery.trim();
    const requestId = addressRequestId.current + 1;
    addressRequestId.current = requestId;
    if (!searchText) {
      setAddressSuggestions([]);
      setAddressOpen(false);
      setCustomers(filterCachedCustomers(allCustomers, query, ""));
      return;
    }

    const timer = window.setTimeout(() => {
      if (addressRequestId.current !== requestId) return;
      setAddressSuggestions(addressSuggestionList(allCustomers, searchText));
      setAddressOpen(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [addressQuery, allCustomers]);

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

  async function clearSearch() {
    setQuery("");
    setSuggestions([]);
    setSearchOpen(false);
    setCustomers(filterCachedCustomers(allCustomers, "", addressQuery));
  }

  async function clearAddress() {
    setAddressQuery("");
    setAddressSuggestions([]);
    setAddressOpen(false);
    setCustomers(filterCachedCustomers(allCustomers, query, ""));
  }

  async function selectAddress(address: string) {
    setAddressQuery(address);
    setAddressOpen(false);
    setCustomers(filterCachedCustomers(allCustomers, query, address));
  }

  async function openCustomer(customer: Customer) {
    setSelected(await api<Customer>(`/customers/${customer.id}`, { showLoading: false }));
  }

  const visiblePlans = user.internetEnabled ? plans : plans.filter((plan) => plan.type === "CABLE");
  const profileTools = user.role === "ADMIN" ? {
    add: <div className="profile-tool-panel"><AdminQuickCreate plans={visiblePlans} employees={collectors} boxes={boxes} month={month} year={year} internetEnabled={user.internetEnabled} reload={load} /></div>,
    lists: <div className="profile-tool-panel full-list-panel"><SetupListTabs employees={employees} plans={visiblePlans} boxes={boxes} reload={load} /></div>,
    ledger: <div className="profile-tool-panel"><EmployeeLedger user={user} employees={employees} /></div>,
    collectionSummary: <div className="profile-tool-panel"><EmployeeCollectionSummary /></div>,
    payments: <div className="profile-tool-panel"><PaymentHistoryReport employees={employees} organisationName={user.organisationName} /></div>
  } : {
    ledger: <div className="profile-tool-panel"><EmployeeLedger user={user} employees={employees} /></div>
  };

  return (
    <Shell user={user} onLogout={onLogout} onUserChange={onUserChange} profileTools={profileTools}>
      <main className="content">
        <section className="period-row">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString("en", { month: "short" })}</option>)}</select>
          <input value={year} onChange={(e) => setYear(Number(e.target.value))} />
          {user.role === "ADMIN" && <button onClick={generateBills} disabled={generatingBills}><ReceiptIndianRupee size={16} /> {generatingBills ? t("Generating Bills") : t("Generate Bills")}</button>}
        </section>
        {billingMessage && <p className="success notice">{t(billingMessage)}</p>}
        {dashboard && <DashboardCards dashboard={dashboard} />}
        <section className="tool-row">
          <div className="search-wrap">
            <label className="search"><Search size={16} /><input placeholder={t("Search Customer ID, Name, STB, Card")} value={query} onFocus={() => query.trim() && setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></label>
            {query && <button className="search-clear" type="button" onClick={clearSearch}>{t("Clear")}</button>}
            {searchOpen && suggestions.length > 0 && (
              <div className="customer-suggestions">
                {suggestions.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQuery(customerSearchValue(customer));
                      setCustomers([customer]);
                      setSearchOpen(false);
                    }}
                  >
                    {customerSearchLabel(customer)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="search-wrap">
            <label className="search"><Search size={16} /><input placeholder={t("Filter Address")} value={addressQuery} onFocus={() => addressQuery.trim() && setAddressOpen(true)} onBlur={() => window.setTimeout(() => setAddressOpen(false), 120)} onChange={(e) => setAddressQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></label>
            {addressQuery && <button className="search-clear" type="button" onClick={clearAddress}>{t("Clear")}</button>}
            {addressOpen && addressSuggestions.length > 0 && (
              <div className="customer-suggestions">
                {addressSuggestions.map((address) => (
                  <button
                    key={address}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      selectAddress(address);
                    }}
                  >
                    {address}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={load}><Search size={16} /> {t("Search")}</button>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
            <option value="recent">{t("Recently Updated")}</option>
            <option value="customerIdAsc">{t("Customer ID Low To High")}</option>
            <option value="customerIdDesc">{t("Customer ID High To Low")}</option>
          </select>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="">{t("All Payment")}</option><option value="PENDING">{t("Pending")}</option><option value="PARTIAL">{t("Partial")}</option><option value="PAID">{t("Paid")}</option>
          </select>
        </section>
        <section className="customer-list">
          {sortCustomers(customers, sortMode).map((customer) => <CustomerCard key={customer.id} customer={customer} internetEnabled={user.internetEnabled} onOpen={() => openCustomer(customer)} />)}
        </section>
      </main>
      {selected && <CustomerDrawer customer={selected} user={user} plans={visiblePlans} employees={collectors} boxes={boxes} month={month} year={year} internetEnabled={user.internetEnabled} onClose={() => setSelected(null)} onRefresh={load} />}
    </Shell>
  );
}

function customerSearchLabel(customer: Customer) {
  const name = `${customer.firstName} ${customer.lastName ?? ""}`.trim();
  return `${customer.customerCode ?? customer.id} - ${name} - ${customer.address}`;
}

function customerSearchValue(customer: Customer) {
  const name = `${customer.firstName} ${customer.lastName ?? ""}`.trim();
  return customer.customerCode ?? name;
}

function sortCustomers(customers: Customer[], sortMode: "recent" | "customerIdAsc" | "customerIdDesc") {
  if (sortMode === "recent") return customers;
  return [...customers].sort((a, b) => {
    const direction = sortMode === "customerIdAsc" ? 1 : -1;
    return compareCustomerCode(a.customerCode, b.customerCode) * direction;
  });
}

function compareCustomerCode(first?: string | null, second?: string | null) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  const firstHasNumber = Number.isFinite(firstNumber);
  const secondHasNumber = Number.isFinite(secondNumber);
  if (!firstHasNumber && !secondHasNumber) return 0;
  if (!firstHasNumber) return 1;
  if (!secondHasNumber) return -1;
  return firstNumber - secondNumber;
}

function filterCachedCustomers(customers: Customer[], query: string, addressQuery: string) {
  const search = normalizeSearch(query);
  const addressSearch = normalizeSearch(addressQuery);
  return customers.filter((customer) => {
    const matchesSearch = !search || customerSearchText(customer).includes(search);
    const matchesAddress = !addressSearch || normalizeSearch(customer.address).includes(addressSearch);
    return matchesSearch && matchesAddress;
  });
}

function customerSearchText(customer: Customer) {
  return normalizeSearch([
    customer.customerCode,
    customer.firstName,
    customer.lastName,
    customer.phone,
    customer.address,
    customer.boxes?.map((box) => `${box.setTopBox.boxNumber} ${box.setTopBox.pairedCardNumber}`).join(" ")
  ].filter(Boolean).join(" "));
}

function addressSuggestionList(customers: Customer[], query: string) {
  const search = normalizeSearch(query);
  const addresses = new Set<string>();
  for (const customer of customers) {
    if (normalizeSearch(customer.address).includes(search)) addresses.add(customer.address);
    if (addresses.size >= 12) break;
  }
  return Array.from(addresses);
}

function normalizeSearch(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}
