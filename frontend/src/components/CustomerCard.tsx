import { money } from "../api/client";
import { useI18n } from "../i18n";
import { Customer } from "../types";

export function CustomerCard({ customer, internetEnabled, onOpen }: { customer: Customer; internetEnabled: boolean; onOpen: () => void }) {
  const bill = customer.billings[0];
  const { t } = useI18n();
  const billingLabel = bill ? customerBillingLabel(bill, t) : t("No Bill");
  return (
    <button className="customer-card" onClick={onOpen}>
      <div>
        <strong>{customer.customerCode ? `${customer.customerCode} - ` : ""}{customer.firstName} {customer.lastName}</strong>
        <span>{customer.address}</span>
        <span>{t("Collector")}: {customer.collector?.name ?? t("Not Assigned")}</span>
      </div>
      <div className="status-stack">
        <span className={`pill ${customer.cableStatus.toLowerCase()}`}>{t(`Cable ${customer.cableStatus}`)}</span>
        {internetEnabled && <span className={`pill ${customer.internetStatus.toLowerCase()}`}>{t(`Internet ${customer.internetStatus}`)}</span>}
        <span className={`pill ${bill?.status.toLowerCase() ?? "pending"}`}>{billingLabel}</span>
      </div>
    </button>
  );
}

function customerBillingLabel(bill: Customer["billings"][number], t: (key: string) => string) {
  const statusLabel = t(bill.status[0] + bill.status.slice(1).toLowerCase());
  const pendingAmount = Math.max(bill.totalAmount - bill.paidAmount, 0);
  if (bill.status === "PAID") return `${statusLabel} · ${money(bill.paidAmount)}`;
  if (bill.status === "PARTIAL") return `${statusLabel} · ${money(pendingAmount)} ${t("Pending")}`;
  return `${statusLabel} · ${money(pendingAmount)}`;
}
