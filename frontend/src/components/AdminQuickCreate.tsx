import React, { useState } from "react";
import { Cable, CreditCard, Plus, UserPlus } from "lucide-react";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import { Box, Employee, Plan } from "../types";
import { labelFor } from "../utils/labels";
import { SetTopBoxSearchSelect } from "./SetTopBoxSearchSelect";

export function AdminQuickCreate({ plans, employees, boxes, month, year, reload }: { plans: Plan[]; employees: Employee[]; boxes: Box[]; month: number; year: number; reload: () => void }) {
  const [open, setOpen] = useState<"customer" | "employee" | "plan" | "box" | null>(null);
  const { t } = useI18n();
  return (
    <section className="admin-panel">
      <div className="quick-actions">
        <button onClick={() => setOpen("customer")}><Plus size={16} /> {t("Customer")}</button>
        <button onClick={() => setOpen("employee")}><UserPlus size={16} /> {t("Employee")}</button>
        <button onClick={() => setOpen("plan")}><Cable size={16} /> {t("Plan")}</button>
        <button onClick={() => setOpen("box")}><CreditCard size={16} /> STB</button>
      </div>
      {open === "customer" && <CustomerForm plans={plans} employees={employees} boxes={boxes} month={month} year={year} onCancel={() => setOpen(null)} done={() => { setOpen(null); reload(); }} />}
      {open === "employee" && <SimpleCreate path="/admin/employees" fields={["name", "email", "phone", "password"]} onCancel={() => setOpen(null)} done={() => { setOpen(null); reload(); }} />}
      {open === "plan" && <SimpleCreate path="/admin/plans" fields={["name", "type", "price"]} defaults={{ type: "CABLE" }} onCancel={() => setOpen(null)} done={() => { setOpen(null); reload(); }} />}
      {open === "box" && <SimpleCreate path="/admin/set-top-boxes" fields={["boxNumber", "pairedCardNumber", "notes"]} onCancel={() => setOpen(null)} done={() => { setOpen(null); reload(); }} />}
    </section>
  );
}

function SimpleCreate({ path, fields, defaults = {}, onCancel, done }: { path: string; fields: string[]; defaults?: Record<string, string>; onCancel: () => void; done: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [error, setError] = useState("");
  const { t } = useI18n();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (fields.includes("email") && values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError("Please Enter A Valid Email Address.");
      return;
    }
    try {
      const payload = Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== "password" || value.trim() !== ""));
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      done();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }
  return (
    <form className="add-form" onSubmit={submit}>
      <div className="form-heading">
        <strong>{t("Add Details")}</strong>
      </div>
      <div className="add-form-fields compact-fields">
        {fields.map((field) => (
          <label key={field}>
            {t(labelFor(field))}
            {field === "type" ? (
              <select value={values[field] ?? "CABLE"} onChange={(e) => setValues({ ...values, [field]: e.target.value })}>
                <option value="CABLE">{t("Cable")}</option>
                <option value="INTERNET">{t("Internet")}</option>
              </select>
            ) : (
              <input type={field.toLowerCase().includes("password") ? "password" : "text"} value={values[field] ?? ""} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="add-form-actions">
        <button className="primary">{t("Save")}</button>
        <button type="button" onClick={onCancel}>{t("Cancel")}</button>
      </div>
      {error && <p className="error inline-error">{t(error)}</p>}
    </form>
  );
}

function CustomerForm({ plans, employees, boxes, month, year, onCancel, done }: { plans: Plan[]; employees: Employee[]; boxes: Box[]; month: number; year: number; onCancel: () => void; done: () => void }) {
  const activeEmployees = employees.filter((employee) => employee.isActive);
  const activeCablePlans = plans.filter((plan) => plan.type === "CABLE" && plan.isActive !== false);
  const activeInternetPlans = plans.filter((plan) => plan.type === "INTERNET" && plan.isActive !== false);
  const activeBoxes = boxes.filter((box) => (box.status ?? "ACTIVE") === "ACTIVE" && !(box.assignments?.length));
  const [values, setValues] = useState<Record<string, string>>({
    cableStatus: "ACTIVE",
    internetStatus: "NA",
    cableStartMonth: String(month),
    cableStartYear: String(year),
    internetStartMonth: String(month),
    internetStartYear: String(year)
  });
  const { t } = useI18n();
  const set = (key: string, value: string) => setValues({ ...values, [key]: value });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api("/admin/customers", { method: "POST", body: JSON.stringify(cleanServiceStarts({ ...values, effectiveMonth: String(month), effectiveYear: String(year) })) });
    done();
  }
  return (
    <form className="add-form" onSubmit={submit}>
      <div className="form-heading">
        <strong>{t("Add Customer")}</strong>
      </div>
      <div className="add-form-fields">
        <label>{t("Customer ID")}<input onChange={(e) => set("customerCode", e.target.value)} /></label>
        <label>{t("First Name")}<input onChange={(e) => set("firstName", e.target.value)} /></label>
        <label>{t("Last Name")}<input onChange={(e) => set("lastName", e.target.value)} /></label>
        <label>{t("Phone")}<input onChange={(e) => set("phone", e.target.value)} /></label>
        <label>{t("Address")}<input onChange={(e) => set("address", e.target.value)} /></label>
        <label>{t("Collector")}<select onChange={(e) => set("collectorId", e.target.value)}><option value="">{t("Select")}</option>{activeEmployees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>{t("Cable")}<select value={values.cableStatus} onChange={(e) => set("cableStatus", e.target.value)}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option><option value="NA">NA</option></select></label>
        {values.cableStatus !== "NA" && <label>{t("Cable Plan")}<select onChange={(e) => set("cablePlanId", e.target.value)}><option value="">NA</option>{activeCablePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {values.cableStatus !== "NA" && <MonthSelect label={t("Cable Start Month")} value={values.cableStartMonth} onChange={(value) => set("cableStartMonth", value)} />}
        {values.cableStatus !== "NA" && <YearInput label={t("Cable Start Year")} value={values.cableStartYear} onChange={(value) => set("cableStartYear", value)} />}
        <label>{t("Internet")}<select value={values.internetStatus} onChange={(e) => set("internetStatus", e.target.value)}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option><option value="NA">NA</option></select></label>
        {values.internetStatus !== "NA" && <label>{t("Internet Plan")}<select onChange={(e) => set("internetPlanId", e.target.value)}><option value="">NA</option>{activeInternetPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        {values.internetStatus !== "NA" && <MonthSelect label={t("Internet Start Month")} value={values.internetStartMonth} onChange={(value) => set("internetStartMonth", value)} />}
        {values.internetStatus !== "NA" && <YearInput label={t("Internet Start Year")} value={values.internetStartYear} onChange={(value) => set("internetStartYear", value)} />}
        <SetTopBoxSearchSelect label={t("Set Top Box")} boxes={activeBoxes} value={values.setTopBoxId ?? ""} emptyLabel={t("Later")} onChange={(value) => set("setTopBoxId", value)} />
      </div>
      <div className="add-form-actions">
        <button className="primary">{t("Save Customer")}</button>
        <button type="button" onClick={onCancel}>{t("Cancel")}</button>
      </div>
    </form>
  );
}

function cleanServiceStarts(values: Record<string, string>) {
  const cleaned = {
    ...values,
    cablePlanId: values.cableStatus === "NA" ? undefined : values.cablePlanId,
    cableStartMonth: values.cableStatus === "NA" ? undefined : values.cableStartMonth,
    cableStartYear: values.cableStatus === "NA" ? undefined : values.cableStartYear,
    internetPlanId: values.internetStatus === "NA" ? undefined : values.internetPlanId,
    internetStartMonth: values.internetStatus === "NA" ? undefined : values.internetStartMonth,
    internetStartYear: values.internetStatus === "NA" ? undefined : values.internetStartYear
  };
  return Object.fromEntries(Object.entries(cleaned).filter(([, value]) => value !== undefined && value !== ""));
}

function MonthSelect({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <label>{label}<select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      {Array.from({ length: 12 }, (_, index) => (
        <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleString("en", { month: "short" })}</option>
      ))}
    </select></label>
  );
}

function YearInput({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return <label>{label}<input type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}
