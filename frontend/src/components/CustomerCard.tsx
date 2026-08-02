import { money } from "../api/client";
import { useI18n } from "../i18n";
import { Customer } from "../types";

export function CustomerCard({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  const bill = customer.billings[0];
  const { t } = useI18n();
  return (
    <button className="customer-card" onClick={onOpen}>
      <div>
        <strong>{customer.firstName} {customer.lastName}</strong>
        <span>{customer.address}</span>
        <span>{t("Collector")}: {customer.collector?.name ?? t("Not Assigned")}</span>
      </div>
      <div className="status-stack">
        <span className={`pill ${customer.cableStatus.toLowerCase()}`}>{t(`Cable ${customer.cableStatus}`)}</span>
        <span className={`pill ${customer.internetStatus.toLowerCase()}`}>{t(`Internet ${customer.internetStatus}`)}</span>
        <span className={`pill ${bill?.status.toLowerCase() ?? "pending"}`}>{bill ? `${t(bill.status[0] + bill.status.slice(1).toLowerCase())} · ${money(bill.totalAmount - bill.paidAmount)}` : t("No Bill")}</span>
      </div>
    </button>
  );
}
