import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

type DeletedCustomer = {
  id: string;
  customerCode?: string | null;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  address: string;
  status: "ACTIVE" | "INACTIVE";
  cableStatus: "ACTIVE" | "INACTIVE" | "NA";
  internetStatus: "ACTIVE" | "INACTIVE" | "NA";
  updatedAt: string;
  collector?: { id: string; name: string } | null;
  boxes: Array<{
    assignedAt: string;
    unassignedAt?: string | null;
    reason?: string | null;
    setTopBox: { boxNumber: string; pairedCardNumber: string };
  }>;
};

export function DeletedCustomers({ internetEnabled }: { internetEnabled: boolean }) {
  const [customers, setCustomers] = useState<DeletedCustomer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const filteredCustomers = useMemo(() => {
    const search = normalize(query);
    if (!search) return customers;
    return customers.filter((customer) => deletedCustomerSearchText(customer).includes(search));
  }, [customers, query]);

  async function loadDeletedCustomers() {
    setLoading(true);
    try {
      setCustomers(await api<DeletedCustomer[]>("/admin/deleted-customers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeletedCustomers().catch(console.error);
  }, []);

  return (
    <section className="admin-panel deleted-customers-panel">
      <div className="section-heading-row">
        <h2>{t("Deleted Customers")}</h2>
        <button type="button" onClick={loadDeletedCustomers} disabled={loading}>{loading ? t("Please Wait") : t("Refresh")}</button>
      </div>
      <label className="master-search">
        <Search size={16} />
        <input placeholder={t("Search Deleted Customers")} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="deleted-customer-list">
        {filteredCustomers.length === 0 && <p className="empty">{t("No Deleted Customers Found.")}</p>}
        {filteredCustomers.map((customer) => (
          <article className="deleted-customer-row" key={customer.id}>
            <span>{t("Customer")}<strong>{customerLabel(customer)}</strong></span>
            <span>{t("Deleted On")}<strong>{new Date(customer.updatedAt).toLocaleString()}</strong></span>
            <span>{t("Phone")}<strong>{customer.phone || t("Not Available")}</strong></span>
            <span>{t("Address")}<strong>{customer.address}</strong></span>
            <span>{t("Collector")}<strong>{customer.collector?.name ?? t("Not Assigned")}</strong></span>
            <span>{t("Cable Status")}<strong>{t(customer.cableStatus)}</strong></span>
            {internetEnabled && <span>{t("Internet Status")}<strong>{t(customer.internetStatus)}</strong></span>}
            <span>{t("STB History")}<strong>{boxHistory(customer)}</strong></span>
          </article>
        ))}
      </div>
    </section>
  );
}

function customerLabel(customer: DeletedCustomer) {
  const name = `${customer.firstName} ${customer.lastName ?? ""}`.trim();
  return `${customer.customerCode ?? customer.id} - ${name}`;
}

function boxHistory(customer: DeletedCustomer) {
  if (!customer.boxes.length) return "NA";
  return customer.boxes
    .map((box) => `${box.setTopBox.boxNumber} / ${box.setTopBox.pairedCardNumber}`)
    .join(", ");
}

function deletedCustomerSearchText(customer: DeletedCustomer) {
  return normalize([
    customer.customerCode,
    customer.firstName,
    customer.lastName,
    customer.phone,
    customer.address,
    customer.collector?.name,
    ...customer.boxes.flatMap((box) => [box.setTopBox.boxNumber, box.setTopBox.pairedCardNumber])
  ].join(" "));
}

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}
