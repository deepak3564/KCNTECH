import React, { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { api, money } from "../api/client";
import { useI18n } from "../i18n";
import { Box, Employee, Plan } from "../types";
import { EditableRow } from "./EditableRow";

export function SetupLists({ plans, employees, boxes, reload }: { plans: Plan[]; employees: Employee[]; boxes: Box[]; reload: () => void }) {
  return (
    <section className="setup-grid">
      <EmployeeList employees={employees} reload={reload} />
      <PlanList plans={plans} reload={reload} />
      <BoxList boxes={boxes} reload={reload} />
    </section>
  );
}

type ListSubtab = "employees" | "plans" | "setTopBoxes";

export function SetupListTabs({ plans, employees, boxes, reload }: { plans: Plan[]; employees: Employee[]; boxes: Box[]; reload: () => void }) {
  const [tab, setTab] = useState<ListSubtab>("employees");
  const { t } = useI18n();
  return (
    <section className="setup-list-tabs">
      <nav className="setup-list-tab-nav" aria-label={t("Lists")}>
        <button type="button" className={tab === "employees" ? "active-tab" : ""} onClick={() => setTab("employees")}>{t("Employees")}</button>
        <button type="button" className={tab === "plans" ? "active-tab" : ""} onClick={() => setTab("plans")}>{t("Plans")}</button>
        <button type="button" className={tab === "setTopBoxes" ? "active-tab" : ""} onClick={() => setTab("setTopBoxes")}>{t("Set Top Boxes")}</button>
      </nav>
      <div className="setup-list-tab-panel">
        {tab === "employees" && <EmployeeList employees={employees} reload={reload} defaultOpen />}
        {tab === "plans" && <PlanList plans={plans} reload={reload} defaultOpen />}
        {tab === "setTopBoxes" && <BoxList boxes={boxes} reload={reload} defaultOpen />}
      </div>
    </section>
  );
}

export function EmployeeList({ employees, reload, defaultOpen = false }: { employees: Employee[]; reload: () => void; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filteredEmployees = employees.filter((employee) => matchesSearch(query, employee.name, employee.email, employee.phone, employee.isActive ? "active" : "inactive"));
  return (
    <MasterList
      title={listTitle(t("Employees"), filteredEmployees.length, employees.length)}
      empty="No Employees Added Yet."
      defaultOpen={defaultOpen}
      searchValue={query}
      searchPlaceholder={`${t("Search")} ${t("Employees")}`}
      onSearchChange={setQuery}
    >
      {filteredEmployees.map((employee) => (
        <EditableRow
          key={employee.id}
          title={employee.name}
          meta={employee.email}
          badge={employee.isActive ? "Active" : "Inactive"}
          initial={{ name: employee.name, email: employee.email, phone: employee.phone ?? "", password: "", isActive: String(employee.isActive) }}
          fields={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "password", label: "New Password", type: "password" },
            { key: "isActive", label: "Status", type: "active" }
          ]}
          path={`/admin/employees/${employee.id}`}
          deletePath={`/admin/employees/${employee.id}`}
          reload={reload}
        />
      ))}
    </MasterList>
  );
}

export function PlanList({ plans, reload, defaultOpen = false }: { plans: Plan[]; reload: () => void; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filteredPlans = plans.filter((plan) => matchesSearch(query, plan.name, plan.type, String(plan.price), plan.isActive === false ? "inactive" : "active"));
  return (
    <MasterList
      title={listTitle(t("Plans"), filteredPlans.length, plans.length)}
      empty="No Plans Added Yet."
      defaultOpen={defaultOpen}
      searchValue={query}
      searchPlaceholder={`${t("Search")} ${t("Plans")}`}
      onSearchChange={setQuery}
    >
      {filteredPlans.map((plan) => (
        <EditableRow
          key={plan.id}
          title={plan.name}
          meta={money(plan.price)}
          badge={plan.type}
          initial={{ name: plan.name, type: plan.type, price: String(plan.price), isActive: String(plan.isActive ?? true) }}
          fields={[
            { key: "name", label: "Plan name" },
            { key: "type", label: "Type", type: "planType" },
            { key: "price", label: "Price" },
            { key: "isActive", label: "Status", type: "active" }
          ]}
          path={`/admin/plans/${plan.id}`}
          deletePath={`/admin/plans/${plan.id}`}
          reload={reload}
        />
      ))}
    </MasterList>
  );
}

export function BoxList({ boxes, reload, defaultOpen = false }: { boxes: Box[]; reload: () => void; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filteredBoxes = boxes.filter((box) => {
    const linkedCustomer = box.assignments?.[0]?.customer;
    const linkedCustomerName = linkedCustomer ? `${linkedCustomer.firstName} ${linkedCustomer.lastName ?? ""}`.trim() : "";
    return matchesSearch(query, box.boxNumber, box.pairedCardNumber, box.status, box.notes, linkedCustomerName);
  });
  async function unlinkBox(box: Box) {
    if (!confirm(t("Are You Sure You Want To Unlink This Set Top Box?"))) return;
    await api(`/admin/set-top-boxes/${box.id}/unlink`, { method: "POST" });
    reload();
  }
  return (
    <MasterList
      title={listTitle(t("Set Top Boxes"), filteredBoxes.length, boxes.length)}
      empty="No Set Top Boxes Added Yet."
      defaultOpen={defaultOpen}
      searchValue={query}
      searchPlaceholder={`${t("Search")} ${t("Set Top Boxes")}`}
      onSearchChange={setQuery}
    >
      {filteredBoxes.map((box) => {
        const linkedCustomer = box.assignments?.[0]?.customer;
        const linkedCustomerName = linkedCustomer ? `${linkedCustomer.firstName} ${linkedCustomer.lastName ?? ""}`.trim() : "";
        return (
          <div className="stb-row-block" key={box.id}>
            <EditableRow
              title={box.boxNumber}
              meta={`${t("Card")}: ${box.pairedCardNumber}${linkedCustomerName ? ` · ${t("Linked To")}: ${linkedCustomerName}` : ` · ${t("Not Linked")}`}`}
              badge={box.status ?? "STB"}
              editMeta={<><strong>{t("Linked To")}</strong><span>{linkedCustomerName || t("Not Linked")}</span></>}
              initial={{ boxNumber: box.boxNumber, pairedCardNumber: box.pairedCardNumber, status: box.status ?? "ACTIVE", notes: box.notes ?? "" }}
              fields={[
                { key: "boxNumber", label: "STB number" },
                { key: "pairedCardNumber", label: "Card number" },
                { key: "status", label: "Status", type: "boxStatus" },
                { key: "notes", label: "Notes" }
              ]}
              path={`/admin/set-top-boxes/${box.id}`}
              deletePath={`/admin/set-top-boxes/${box.id}`}
              reload={reload}
            />
            {linkedCustomerName && <button className="unlink-button" onClick={() => unlinkBox(box)}>{t("Unlink")}</button>}
          </div>
        );
      })}
    </MasterList>
  );
}

function MasterList({
  title,
  empty,
  defaultOpen = false,
  children,
  searchValue,
  searchPlaceholder,
  onSearchChange
}: {
  title: string;
  empty: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasRows = React.Children.count(children) > 0;
  const { t } = useI18n();
  return (
    <section className="master-list">
      <button className="master-toggle" type="button" onClick={() => setOpen((current) => !current)}>
        <h3>{title}</h3>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      <div className={`master-content ${open ? "open" : ""}`}>
        <div className="master-content-inner">
          {onSearchChange && (
            <label className="master-search">
              <Search size={15} />
              <input value={searchValue ?? ""} placeholder={searchPlaceholder ?? t("Search")} onChange={(event) => onSearchChange(event.target.value)} />
            </label>
          )}
          {!hasRows && <p className="empty">{t(empty)}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

function listTitle(label: string, visibleCount: number, totalCount: number) {
  return visibleCount === totalCount ? `${label} (${totalCount})` : `${label} (${visibleCount}/${totalCount})`;
}

function matchesSearch(query: string, ...values: Array<string | number | boolean | null | undefined>) {
  const search = normalizeListSearch(query);
  if (!search) return true;
  return values.some((value) => normalizeListSearch(value).includes(search));
}

function normalizeListSearch(value: string | number | boolean | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}
