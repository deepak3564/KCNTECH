import { money } from "../api/client";
import { useI18n } from "../i18n";
import { Customer } from "../types";

export function CustomerGrid({ customers, internetEnabled, onOpen }: { customers: Customer[]; internetEnabled: boolean; onOpen: (customer: Customer) => void }) {
  const { t } = useI18n();
  return (
    <section className="customer-grid-wrap" aria-label={t("Customer Grid")}>
      <table className="customer-grid">
        <thead>
          <tr>
            <th>{t("Customer ID")}</th>
            <th>{t("Name")}</th>
            <th>{t("Address")}</th>
            <th>{t("Phone")}</th>
            <th>{t("Collector")}</th>
            <th>{t("STB")}</th>
            <th>{t("Card")}</th>
            <th>{t("Cable Status")}</th>
            {internetEnabled && <th>{t("Internet Status")}</th>}
            <th>{t("Payment")}</th>
            <th>{t("Expected")}</th>
            <th>{t("Paid")}</th>
            <th>{t("Pending")}</th>
            <th>{t("Action")}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const bill = customer.billings[0];
            const pendingAmount = bill ? Math.max(bill.totalAmount - bill.paidAmount, 0) : 0;
            const primaryBox = customer.boxes[0]?.setTopBox;
            return (
              <tr key={customer.id}>
                <td>{customer.customerCode ?? customer.id}</td>
                <td>{customer.firstName} {customer.lastName ?? ""}</td>
                <td>{customer.address}</td>
                <td>{customer.phone || "NA"}</td>
                <td>{customer.collector?.name ?? t("Not Assigned")}</td>
                <td>{primaryBox?.boxNumber ?? "NA"}</td>
                <td>{primaryBox?.pairedCardNumber ?? "NA"}</td>
                <td><span className={`pill ${customer.cableStatus.toLowerCase()}`}>{t(customer.cableStatus)}</span></td>
                {internetEnabled && <td><span className={`pill ${customer.internetStatus.toLowerCase()}`}>{t(customer.internetStatus)}</span></td>}
                <td><span className={`pill ${bill?.status.toLowerCase() ?? "pending"}`}>{bill ? t(statusLabel(bill.status)) : t("No Bill")}</span></td>
                <td>{money(bill?.totalAmount ?? 0)}</td>
                <td>{money(bill?.paidAmount ?? 0)}</td>
                <td>{money(pendingAmount)}</td>
                <td><button className="small-button grid-open-button" type="button" onClick={() => onOpen(customer)}>{t("Open")}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function statusLabel(status: Customer["billings"][number]["status"]) {
  return status[0] + status.slice(1).toLowerCase();
}
