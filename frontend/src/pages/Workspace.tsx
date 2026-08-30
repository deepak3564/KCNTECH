import { useEffect, useRef, useState } from "react";
import { ChevronDown, ReceiptIndianRupee, Search } from "lucide-react";
import { api, SessionUser } from "../api/client";
import { Box, Customer, Dashboard, Employee, Plan } from "../types";
import { AdminQuickCreate } from "../components/AdminQuickCreate";
import { CustomerCard } from "../components/CustomerCard";
import { CustomerDrawer } from "../components/CustomerDrawer";
import { CustomerGrid } from "../components/CustomerGrid";
import { DashboardCards } from "../components/DashboardCards";
import { DeletedCustomers } from "../components/DeletedCustomers";
import { DeletedSetTopBoxes } from "../components/DeletedSetTopBoxes";
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
  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "customerIdAsc" | "customerIdDesc" | "nameAsc" | "nameDesc">("recent");
  const [viewMode, setViewMode] = useState<"card" | "grid">("card");
  const [billingMessage, setBillingMessage] = useState("");
  const [generatingBills, setGeneratingBills] = useState(false);
  const searchRequestId = useRef(0);
  const addressRequestId = useRef(0);
  const selectedAddressRef = useRef("");
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
    if (normalizeSearch(selectedAddressRef.current) === normalizeSearch(searchText)) {
      setAddressSuggestions([]);
      setAddressOpen(false);
      setCustomers(filterCachedCustomers(allCustomers, query, searchText));
      return;
    }

    const timer = window.setTimeout(() => {
      if (addressRequestId.current !== requestId) return;
      setAddressSuggestions(addressSuggestionList(allCustomers, searchText));
      setCustomers(filterCachedCustomers(allCustomers, query, searchText));
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
    selectedAddressRef.current = "";
    setAddressQuery("");
    setAddressSuggestions([]);
    setAddressOpen(false);
    setCustomers(filterCachedCustomers(allCustomers, query, ""));
  }

  async function selectAddress(address: string) {
    selectedAddressRef.current = address;
    setAddressQuery(address);
    setAddressSuggestions([]);
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
    payments: <div className="profile-tool-panel"><PaymentHistoryReport employees={employees} organisationName={user.organisationName} /></div>,
    deletedCustomers: <div className="profile-tool-panel"><DeletedCustomers internetEnabled={user.internetEnabled} /></div>,
    deletedSetTopBoxes: <div className="profile-tool-panel"><DeletedSetTopBoxes /></div>
  } : {
    ledger: <div className="profile-tool-panel"><EmployeeLedger user={user} employees={employees} /></div>
  };

  return (
    <Shell user={user} onLogout={onLogout} onUserChange={onUserChange} profileTools={profileTools}>
      <main className="content">
        <section className="period-row">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i).toLocaleString("en", { month: "short" })}</option>)}</select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{yearOptions(String(year)).map((item) => <option key={item} value={item}>{item}</option>)}</select>
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
            <label className="search"><Search size={16} /><input placeholder={t("Filter Address")} value={addressQuery} onFocus={() => addressQuery.trim() && !selectedAddressRef.current && setAddressOpen(true)} onBlur={() => window.setTimeout(() => setAddressOpen(false), 120)} onChange={(e) => { selectedAddressRef.current = ""; setAddressQuery(e.target.value); }} onKeyDown={(e) => e.key === "Enter" && load()} /></label>
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
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
            <option value="recent">{t("Recently Updated")}</option>
            <option value="nameAsc">{t("Name A To Z")}</option>
            <option value="nameDesc">{t("Name Z To A")}</option>
            <option value="customerIdAsc">{t("Customer ID Low To High")}</option>
            <option value="customerIdDesc">{t("Customer ID High To Low")}</option>
          </select>
          <PaymentStatusSelect
            dashboard={dashboard}
            open={paymentFilterOpen}
            value={paymentStatus}
            t={t}
            onOpenChange={setPaymentFilterOpen}
            onChange={setPaymentStatus}
          />
          <button onClick={load}><Search size={16} /> {t("Search")}</button>
        </section>
        <section className="view-toggle-row" aria-label={t("Customer View")}>
          <div className="segmented-control">
            <button className={viewMode === "card" ? "active" : ""} type="button" onClick={() => setViewMode("card")}>{t("Card View")}</button>
            <button className={viewMode === "grid" ? "active" : ""} type="button" onClick={() => setViewMode("grid")}>{t("Grid View")}</button>
          </div>
        </section>
        {viewMode === "card" ? (
          <section className="customer-list">
            {sortCustomers(customers, sortMode).map((customer) => <CustomerCard key={customer.id} customer={customer} internetEnabled={user.internetEnabled} onOpen={() => openCustomer(customer)} />)}
          </section>
        ) : (
          <CustomerGrid customers={sortCustomers(customers, sortMode)} internetEnabled={user.internetEnabled} onOpen={openCustomer} />
        )}
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

function sortCustomers(customers: Customer[], sortMode: "recent" | "customerIdAsc" | "customerIdDesc" | "nameAsc" | "nameDesc") {
  if (sortMode === "recent") return customers;
  return [...customers].sort((a, b) => {
    if (sortMode === "nameAsc" || sortMode === "nameDesc") {
      const direction = sortMode === "nameAsc" ? 1 : -1;
      return compareCustomerName(a, b) * direction;
    }
    const direction = sortMode === "customerIdAsc" ? 1 : -1;
    return compareCustomerCode(a.customerCode, b.customerCode) * direction;
  });
}

function compareCustomerName(first: Customer, second: Customer) {
  const firstName = `${first.firstName} ${first.lastName ?? ""}`.trim();
  const secondName = `${second.firstName} ${second.lastName ?? ""}`.trim();
  return firstName.localeCompare(secondName, undefined, { sensitivity: "base", numeric: true });
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
    const matchesSearch = !search || customerStartsWithSearch(customer, search);
    const matchesAddress = !addressSearch || normalizeSearch(customer.address).includes(addressSearch);
    return matchesSearch && matchesAddress;
  });
}

function customerStartsWithSearch(customer: Customer, search: string) {
  const searchableValues = [
    customer.customerCode,
    customer.firstName,
    customer.lastName,
    ...((customer.boxes ?? []).flatMap((box) => [box.setTopBox.boxNumber, box.setTopBox.pairedCardNumber]))
  ];

  return searchableValues.some((value) => normalizeSearch(value).startsWith(search));
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

function yearOptions(value?: string) {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>();
  for (let year = currentYear - 1; year <= currentYear + 5; year += 1) years.add(year);
  const selectedYear = Number(value);
  if (Number.isInteger(selectedYear) && selectedYear > 1900) years.add(selectedYear);
  return Array.from(years).sort((a, b) => a - b);
}

function PaymentStatusSelect({
  dashboard,
  open,
  value,
  t,
  onOpenChange,
  onChange
}: {
  dashboard: Dashboard | null;
  open: boolean;
  value: string;
  t: (text: string) => string;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const options = paymentFilterOptions(dashboard, t);
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <div className="payment-select" onBlur={() => window.setTimeout(() => onOpenChange(false), 120)}>
      <button className="payment-select-trigger" type="button" onClick={() => onOpenChange(!open)}>
        <span>{selected.label}</span>
        <strong className={`payment-select-count ${selected.className}`}>{selected.count}</strong>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="payment-select-menu">
          {options.map((option) => (
            <button
              className={value === option.value ? "active-option" : ""}
              key={option.value || "all"}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
              }}
            >
              <span>{option.label}</span>
              <strong className={`payment-select-count ${option.className}`}>{option.count}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function paymentFilterOptions(dashboard: Dashboard | null, t: (text: string) => string) {
  const total = dashboard ? dashboard.pendingBills + dashboard.partialBills + dashboard.paidBills : 0;
  return [
    { value: "", label: t("All Payment"), count: total, className: "all" },
    { value: "PENDING", label: t("Pending"), count: dashboard?.pendingBills ?? 0, className: "pending" },
    { value: "PARTIAL", label: t("Partial"), count: dashboard?.partialBills ?? 0, className: "partial" },
    { value: "PAID", label: t("Paid"), count: dashboard?.paidBills ?? 0, className: "paid" }
  ];
}

function normalizeSearch(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}
