import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";

type DeletedSetTopBox = {
  id: string;
  boxNumber: string;
  pairedCardNumber: string;
  status: "ACTIVE" | "REPAIRED" | "REPLACED" | "RETURNED";
  notes?: string | null;
  assignments: Array<{
    assignedAt: string;
    unassignedAt?: string | null;
    reason?: string | null;
    customer: {
      id: string;
      customerCode?: string | null;
      firstName: string;
      lastName?: string | null;
      address: string;
      deleted: boolean;
    };
  }>;
};

export function DeletedSetTopBoxes() {
  const [boxes, setBoxes] = useState<DeletedSetTopBox[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const filteredBoxes = useMemo(() => {
    const search = normalize(query);
    if (!search) return boxes;
    return boxes.filter((box) => deletedSetTopBoxSearchText(box).includes(search));
  }, [boxes, query]);

  async function loadDeletedSetTopBoxes() {
    setLoading(true);
    try {
      setBoxes(await api<DeletedSetTopBox[]>("/admin/deleted-set-top-boxes"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeletedSetTopBoxes().catch(console.error);
  }, []);

  return (
    <section className="admin-panel deleted-customers-panel">
      <div className="section-heading-row">
        <h2>{t("Deleted STB")}</h2>
        <button type="button" onClick={loadDeletedSetTopBoxes} disabled={loading}>{loading ? t("Please Wait") : t("Refresh")}</button>
      </div>
      <label className="master-search">
        <Search size={16} />
        <input placeholder={t("Search Deleted STB")} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="deleted-customer-list">
        {filteredBoxes.length === 0 && <p className="empty">{t("No Deleted STB Found.")}</p>}
        {filteredBoxes.map((box) => (
          <article className="deleted-stb-row" key={box.id}>
            <span>{t("STB Number")}<strong>{box.boxNumber}</strong></span>
            <span>{t("Card")}<strong>{box.pairedCardNumber}</strong></span>
            <span>{t("Status")}<strong>{t(box.status)}</strong></span>
            <span>{t("Last Linked Customer")}<strong>{lastLinkedCustomer(box)}</strong></span>
            <span>{t("Notes")}<strong>{box.notes || t("Not Available")}</strong></span>
          </article>
        ))}
      </div>
    </section>
  );
}

function lastLinkedCustomer(box: DeletedSetTopBox) {
  const assignment = box.assignments[0];
  if (!assignment) return "NA";
  const customer = assignment.customer;
  const name = `${customer.firstName} ${customer.lastName ?? ""}`.trim();
  const customerId = customer.customerCode ?? customer.id;
  const deletedLabel = customer.deleted ? "Deleted Customer" : "Active Customer";
  return `${customerId} - ${name} - ${customer.address} (${deletedLabel})`;
}

function deletedSetTopBoxSearchText(box: DeletedSetTopBox) {
  return normalize([
    box.boxNumber,
    box.pairedCardNumber,
    box.status,
    box.notes,
    ...box.assignments.flatMap((assignment) => [
      assignment.customer.customerCode,
      assignment.customer.firstName,
      assignment.customer.lastName,
      assignment.customer.address
    ])
  ].join(" "));
}

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}
