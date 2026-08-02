import { BarChart3, CreditCard, ReceiptIndianRupee, Users } from "lucide-react";
import { money } from "../api/client";
import { useI18n } from "../i18n";
import { Dashboard } from "../types";

export function DashboardCards({ dashboard }: { dashboard: Dashboard }) {
  const { t } = useI18n();
  const cards = [
    ["Expected", money(dashboard.expected), <BarChart3 size={18} />],
    ["Collected", money(dashboard.collected), <CreditCard size={18} />],
    ["Pending", money(dashboard.pending), <ReceiptIndianRupee size={18} />],
    ["Customers", `${dashboard.activeCustomers} ${t("active")}`, <Users size={18} />]
  ];
  return <section className="metrics">{cards.map(([label, value, icon]) => <div className="metric" key={String(label)}>{icon}<span>{t(String(label))}</span><strong>{value}</strong></div>)}</section>;
}
