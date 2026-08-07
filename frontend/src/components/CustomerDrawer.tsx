import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { api, money, SessionUser, uploadUrl } from "../api/client";
import { useI18n } from "../i18n";
import { Box, Customer, Employee, Plan } from "../types";
import { CustomerHistoryPanel } from "./CustomerHistoryPanel";
import { CustomerPlanHistoryPanel } from "./CustomerPlanHistoryPanel";
import { SetTopBoxSearchSelect } from "./SetTopBoxSearchSelect";

export function CustomerDrawer({
  customer,
  user,
  plans,
  employees,
  boxes,
  month,
  year,
  onClose,
  onRefresh
}: {
  customer: Customer;
  user: SessionUser;
  plans: Plan[];
  employees: Employee[];
  boxes: Box[];
  month: number;
  year: number;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const bill = customer.billings[0];
  const pendingAmount = Math.max((bill?.totalAmount ?? 0) - (bill?.paidAmount ?? 0), 0);
  const hasPendingAmount = pendingAmount > 0;
  const [amount, setAmount] = useState(String(pendingAmount));
  const [mode, setMode] = useState("CASH");
  const [proof, setProof] = useState<File | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [employeeCablePlanId, setEmployeeCablePlanId] = useState(customer.cablePlanId ?? "");
  const [employeeCablePlanMessage, setEmployeeCablePlanMessage] = useState("");
  const [employeeCablePlanError, setEmployeeCablePlanError] = useState("");
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceMonth, setAdvanceMonth] = useState(month);
  const [advanceYear, setAdvanceYear] = useState(year);
  const [advanceBillingId, setAdvanceBillingId] = useState("");
  const [advancePending, setAdvancePending] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMode, setAdvanceMode] = useState("CASH");
  const [advanceProof, setAdvanceProof] = useState<File | null>(null);
  const [advanceError, setAdvanceError] = useState("");
  const { t } = useI18n();
  const cablePlanOptions = plans.filter((plan) => plan.type === "CABLE" && plan.isActive !== false);

  useEffect(() => {
    setAmount(String(pendingAmount));
  }, [pendingAmount]);

  useEffect(() => {
    setEmployeeCablePlanId(customer.cablePlanId ?? "");
  }, [customer.cablePlanId]);

  async function collect(event: React.FormEvent) {
    event.preventDefault();
    if (!bill) return;
    setPaymentError("");
    if (!hasPendingAmount) return;
    if (Number(amount) > pendingAmount) {
      setPaymentError("Collection Amount Cannot Be Greater Than Pending Amount.");
      return;
    }
    const form = new FormData();
    form.append("billingId", bill.id);
    form.append("amount", amount);
    form.append("mode", mode);
    if (proof) form.append("proof", proof);
    await api("/payments", { method: "POST", body: form });
    await onRefresh();
    onClose();
  }

  async function updateEmployeeCablePlan(event: React.FormEvent) {
    event.preventDefault();
    setEmployeeCablePlanMessage("");
    setEmployeeCablePlanError("");
    if (!employeeCablePlanId) return;
    try {
      await api(`/customers/${customer.id}/cable-plan`, {
        method: "PUT",
        body: JSON.stringify({ cablePlanId: employeeCablePlanId, month, year })
      });
      setEmployeeCablePlanMessage("Cable Plan Updated.");
      await onRefresh();
    } catch (err) {
      setEmployeeCablePlanError(err instanceof Error ? err.message : "Could Not Update Cable Plan");
    }
  }

  async function loadAdvanceBill() {
    setAdvanceError("");
    const preview = await api<{ billings: Array<{ id: string; totalAmount: number; paidAmount: number }>; pendingAmount: number }>("/payments/preview", {
      method: "POST",
      body: JSON.stringify({ customerId: customer.id, periods: [{ month: advanceMonth, year: advanceYear }], samePlan: true })
    });
    const nextBilling = preview.billings[0];
    if (!nextBilling) {
      setAdvanceBillingId("");
      setAdvancePending(0);
      setAdvanceAmount("");
      setAdvanceError("No Bill Found For Selected Month.");
      return;
    }
    const nextPending = Math.max(nextBilling.totalAmount - nextBilling.paidAmount, 0);
    setAdvanceBillingId(nextBilling.id);
    setAdvancePending(nextPending);
    setAdvanceAmount(String(nextPending));
  }

  async function collectAdvance(event: React.FormEvent) {
    event.preventDefault();
    setAdvanceError("");
    if (!advanceBillingId) {
      setAdvanceError("Please Load Advance Bill First.");
      return;
    }
    if (advancePending <= 0) return;
    if (Number(advanceAmount) > advancePending) {
      setAdvanceError("Collection Amount Cannot Be Greater Than Pending Amount.");
      return;
    }
    const form = new FormData();
    form.append("billingId", advanceBillingId);
    form.append("amount", advanceAmount);
    form.append("mode", advanceMode);
    form.append("note", `Advance payment for ${advanceMonth}/${advanceYear}`);
    if (advanceProof) form.append("proof", advanceProof);
    await api("/payments", { method: "POST", body: form });
    await onRefresh();
    onClose();
  }

  return (
    <aside className="drawer">
      <header className="drawer-header">
        <div>
          <h2>{customer.firstName} {customer.lastName}</h2>
          <p>{t("Customer ID")}: {customer.customerCode ?? "NA"}</p>
          <p>{customer.address}</p>
        </div>
        <button className="small-button" onClick={onClose} title={t("Close")}><X size={16} /></button>
      </header>
      <div className="detail-grid">
        <span>{t("Phone")}<strong>{customer.phone ?? "NA"}</strong></span>
        <span>{t("Customer ID")}<strong>{customer.customerCode ?? "NA"}</strong></span>
        <span>{t("Cable")}<strong>{customer.cablePlan ? `${customer.cablePlan.name} · ${money(customer.cablePlan.price)}` : "NA"}</strong></span>
        <span>{t("Cable Start Month")}<strong>{formatStartMonth(customer.cableStartMonth, customer.cableStartYear)}</strong></span>
        <span>{t("Internet")}<strong>{customer.internetPlan ? `${customer.internetPlan.name} · ${money(customer.internetPlan.price)}` : "NA"}</strong></span>
        <span>{t("Internet Start Month")}<strong>{formatStartMonth(customer.internetStartMonth, customer.internetStartYear)}</strong></span>
        <span>{t("STB")}<strong>{customer.boxes[0]?.setTopBox.boxNumber ?? "NA"}</strong></span>
        <span>{t("Card")}<strong>{customer.boxes[0]?.setTopBox.pairedCardNumber ?? "NA"}</strong></span>
        <span>{t("Current Bill")}<strong>{bill ? `${t(bill.status[0] + bill.status.slice(1).toLowerCase())} · ${money(bill.totalAmount - bill.paidAmount)}` : "NA"}</strong></span>
      </div>
      <CustomerHistoryPanel customerId={customer.id} />
      <CustomerPlanHistoryPanel customerId={customer.id} />
      {user.role === "EMPLOYEE" && customer.cableStatus !== "NA" && (
        <form className="payment-form" onSubmit={updateEmployeeCablePlan}>
          <h3>{t("Update Cable Plan")}</h3>
          <label>
            {t("Cable Plan")}
            <select value={employeeCablePlanId} onChange={(event) => setEmployeeCablePlanId(event.target.value)}>
              <option value="">NA</option>
              {cablePlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}
            </select>
          </label>
          <button className="primary" disabled={!employeeCablePlanId}>{t("Save")}</button>
          {employeeCablePlanMessage && <p className="success">{t(employeeCablePlanMessage)}</p>}
          {employeeCablePlanError && <p className="error inline-error">{t(employeeCablePlanError)}</p>}
        </form>
      )}
      {bill && (
        <form className="payment-form" onSubmit={collect}>
          <h3>{t("Accept Payment")}</h3>
          <div className="history">{t("Bill Month")}<strong>{formatBillMonth(bill.month, bill.year)}</strong></div>
          <div className="history">{t("Pending")}<strong>{money(pendingAmount)}</strong></div>
          <label>{t("Amount")}<input type="number" min="0" value={amount} disabled={!hasPendingAmount} onChange={(e) => setAmount(e.target.value)} /></label>
          {paymentError && <p className="error inline-error">{t(paymentError)}</p>}
          <label>{t("Mode")}<select value={mode} disabled={!hasPendingAmount} onChange={(e) => setMode(e.target.value)}><option value="CASH">{t("Cash")}</option><option value="ADMIN_UPI">{t("Admin UPI")}</option><option value="EMPLOYEE_UPI">{t("Employee UPI")}</option></select></label>
          {mode !== "CASH" && <ProofUpload proof={proof} disabled={!hasPendingAmount} onChange={setProof} />}
          <button className="primary" disabled={!hasPendingAmount}>{t("Mark Collected")}</button>
        </form>
      )}
      <section className="advance-payment-panel">
        <button type="button" onClick={() => setAdvanceOpen((current) => !current)}>{advanceOpen ? t("Hide Advance Payment") : t("Advance Payment")}</button>
        {advanceOpen && (
          <form className="payment-form" onSubmit={collectAdvance}>
            <h3>{t("Advance Payment")}</h3>
            <div className="advance-period-row">
              <MonthSelect label={t("Bill Month")} value={String(advanceMonth)} onChange={(value) => setAdvanceMonth(Number(value))} />
              <YearInput label={t("Bill Year")} value={String(advanceYear)} onChange={(value) => setAdvanceYear(Number(value))} />
              <button type="button" onClick={loadAdvanceBill}>{t("Load Bill")}</button>
            </div>
            <div className="history">{t("Selected Bill")}<strong>{formatBillMonth(advanceMonth, advanceYear)}</strong></div>
            <div className="history">{t("Pending")}<strong>{money(advancePending)}</strong></div>
            <label>{t("Amount")}<input type="number" min="0" value={advanceAmount} disabled={!advanceBillingId || advancePending <= 0} onChange={(e) => setAdvanceAmount(e.target.value)} /></label>
            {advanceError && <p className="error inline-error">{t(advanceError)}</p>}
            <label>{t("Mode")}<select value={advanceMode} disabled={!advanceBillingId || advancePending <= 0} onChange={(e) => setAdvanceMode(e.target.value)}><option value="CASH">{t("Cash")}</option><option value="ADMIN_UPI">{t("Admin UPI")}</option><option value="EMPLOYEE_UPI">{t("Employee UPI")}</option></select></label>
            {advanceMode !== "CASH" && <ProofUpload proof={advanceProof} disabled={!advanceBillingId || advancePending <= 0} onChange={setAdvanceProof} />}
            <button className="primary" disabled={!advanceBillingId || advancePending <= 0}>{t("Mark Advance Collected")}</button>
          </form>
        )}
      </section>
      <section>
        <h3>{t("Payment History")}</h3>
        {customer.billings.map((item) => (
          <div className="payment-history-item" key={item.id}>
            <div className="history">{item.month}/{item.year}<strong>{t(item.status[0] + item.status.slice(1).toLowerCase())} · {money(item.paidAmount)} / {money(item.totalAmount)}</strong></div>
            {item.payments.map((payment) => (
              <div className="payment-proof-row" key={`${item.id}-${payment.paidAt}-${payment.amount}`}>
                <span>{new Date(payment.paidAt).toLocaleDateString()} · {t(payment.mode)} · {money(payment.amount)}</span>
                {payment.proofImageUrl && (
                  <a className="download-image-button" href={uploadUrl(payment.proofImageUrl)} download target="_blank" rel="noreferrer" title={t("Download Image")} aria-label={t("Download Image")}>
                    <Download size={15} />
                  </a>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
      {user.role === "ADMIN" && <AdminCustomerActions customer={customer} plans={plans} employees={employees} boxes={boxes} month={month} year={year} onRefresh={onRefresh} onClose={onClose} />}
    </aside>
  );
}

function ProofUpload({ proof, disabled, onChange }: { proof: File | null; disabled: boolean; onChange: (file: File | null) => void }) {
  const { t } = useI18n();
  return (
    <div className="proof-upload">
      <span>{t("UPI Proof Image")}</span>
      <div className="proof-upload-actions">
        <label className="file-action-button">
          {t("Choose Photo")}
          <input type="file" accept="image/*" disabled={disabled} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        </label>
        <label className="file-action-button">
          {t("Take Picture")}
          <input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {proof && <small>{proof.name}</small>}
    </div>
  );
}

function AdminCustomerActions({
  customer,
  plans,
  employees,
  boxes,
  month,
  year,
  onRefresh,
  onClose
}: {
  customer: Customer;
  plans: Plan[];
  employees: Employee[];
  boxes: Box[];
  month: number;
  year: number;
  onRefresh: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();
  const employeeOptions = employees.filter((employee) => employee.isActive || employee.id === (customer.collectorId ?? customer.collector?.id));
  const cablePlanOptions = plans.filter((plan) => plan.type === "CABLE" && (plan.isActive !== false || plan.id === customer.cablePlanId));
  const internetPlanOptions = plans.filter((plan) => plan.type === "INTERNET" && (plan.isActive !== false || plan.id === customer.internetPlanId));
  const currentBoxId = customer.boxes[0]?.setTopBox.id ?? "";
  const boxOptions = boxes.filter((box) => {
    const linkedCustomerId = box.assignments?.[0]?.customerId;
    return (box.status ?? "ACTIVE") === "ACTIVE" && (!linkedCustomerId || box.id === currentBoxId);
  });
  const [values, setValues] = useState({
    customerCode: customer.customerCode ?? "",
    firstName: customer.firstName,
    lastName: customer.lastName ?? "",
    phone: customer.phone ?? "",
    address: customer.address,
    status: customer.status,
    collectorId: customer.collectorId ?? customer.collector?.id ?? "",
    cableStatus: customer.cableStatus,
    internetStatus: customer.internetStatus,
    cablePlanId: customer.cablePlanId ?? "",
    internetPlanId: customer.internetPlanId ?? "",
    cableStartMonth: String(customer.cableStartMonth ?? new Date().getMonth() + 1),
    cableStartYear: String(customer.cableStartYear ?? new Date().getFullYear()),
    internetStartMonth: String(customer.internetStartMonth ?? new Date().getMonth() + 1),
    internetStartYear: String(customer.internetStartYear ?? new Date().getFullYear()),
    setTopBoxId: currentBoxId,
    notes: customer.notes ?? ""
  });

  async function toggleStatus() {
    setError("");
    try {
      await api(`/admin/customers/${customer.id}`, { method: "PUT", body: JSON.stringify({ status: customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Update Customer Status");
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const payload = {
      ...values,
      customerCode: values.customerCode.trim() || null,
      lastName: values.lastName.trim() || null,
      phone: values.phone.trim() || null,
      collectorId: values.collectorId || null,
      cablePlanId: values.cableStatus === "NA" ? null : values.cablePlanId || null,
      internetPlanId: values.internetStatus === "NA" ? null : values.internetPlanId || null,
      cableStartMonth: values.cableStatus === "NA" ? null : values.cableStartMonth,
      cableStartYear: values.cableStatus === "NA" ? null : values.cableStartYear,
      internetStartMonth: values.internetStatus === "NA" ? null : values.internetStartMonth,
      internetStartYear: values.internetStatus === "NA" ? null : values.internetStartYear,
      setTopBoxId: values.setTopBoxId || null,
      effectiveMonth: month,
      effectiveYear: year,
      notes: values.notes.trim() || null
    };
    try {
      await api(`/admin/customers/${customer.id}`, { method: "PUT", body: JSON.stringify(cleanCustomerPayload(payload)) });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Update Customer");
    }
  }

  async function deleteCustomer() {
    setError("");
    if (!confirm(t("Are You Sure You Want To Delete This Customer?"))) return;
    try {
      await api(`/admin/customers/${customer.id}`, { method: "DELETE" });
      await onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could Not Delete Customer");
    }
  }

  return (
    <section className="admin-actions">
      <div className="edit-actions">
        <button onClick={() => setEditing((current) => !current)}>{editing ? t("Hide Edit") : t("Edit Customer")}</button>
        <button onClick={toggleStatus}>{customer.status === "ACTIVE" ? t("Make Inactive") : t("Make Active")}</button>
      </div>
      <button className="delete-button" onClick={deleteCustomer}>{t("Delete Customer")}</button>
      {error && <p className="error inline-error">{t(error)}</p>}
      {editing && (
        <form className="customer-edit-form" onSubmit={save}>
          <label>{t("Customer ID")}<input value={values.customerCode} onChange={(e) => setValues({ ...values, customerCode: e.target.value })} /></label>
          <label>{t("First Name")}<input value={values.firstName} onChange={(e) => setValues({ ...values, firstName: e.target.value })} /></label>
          <label>{t("Last Name")}<input value={values.lastName} onChange={(e) => setValues({ ...values, lastName: e.target.value })} /></label>
          <label>{t("Phone")}<input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} /></label>
          <label>{t("Address")}<input value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} /></label>
          <label>{t("Collector")}<select value={values.collectorId} onChange={(e) => setValues({ ...values, collectorId: e.target.value })}><option value="">{t("Not Assigned")}</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
          <SetTopBoxSearchSelect label={t("Set Top Box")} boxes={boxOptions} value={values.setTopBoxId} emptyLabel="NA" onChange={(value) => setValues({ ...values, setTopBoxId: value })} />
          <label>{t("Status")}<select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value as Customer["status"] })}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option></select></label>
          <label>{t("Cable Status")}<select value={values.cableStatus} onChange={(e) => setValues({ ...values, cableStatus: e.target.value as Customer["cableStatus"] })}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option><option value="NA">NA</option></select></label>
          {values.cableStatus !== "NA" && <label>{t("Cable Plan")}<select value={values.cablePlanId} onChange={(e) => setValues({ ...values, cablePlanId: e.target.value })}><option value="">NA</option>{cablePlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}</select></label>}
          {values.cableStatus !== "NA" && <MonthSelect label={t("Cable Start Month")} value={values.cableStartMonth} onChange={(value) => setValues({ ...values, cableStartMonth: value })} />}
          {values.cableStatus !== "NA" && <YearInput label={t("Cable Start Year")} value={values.cableStartYear} onChange={(value) => setValues({ ...values, cableStartYear: value })} />}
          <label>{t("Internet Status")}<select value={values.internetStatus} onChange={(e) => setValues({ ...values, internetStatus: e.target.value as Customer["internetStatus"] })}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option><option value="NA">NA</option></select></label>
          {values.internetStatus !== "NA" && <label>{t("Internet Plan")}<select value={values.internetPlanId} onChange={(e) => setValues({ ...values, internetPlanId: e.target.value })}><option value="">NA</option>{internetPlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}</select></label>}
          {values.internetStatus !== "NA" && <MonthSelect label={t("Internet Start Month")} value={values.internetStartMonth} onChange={(value) => setValues({ ...values, internetStartMonth: value })} />}
          {values.internetStatus !== "NA" && <YearInput label={t("Internet Start Year")} value={values.internetStartYear} onChange={(value) => setValues({ ...values, internetStartYear: value })} />}
          <label className="full-field">{t("Notes")}<input value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} /></label>
          <div className="edit-actions full-field">
            <button className="primary">{t("Save Customer Details")}</button>
            <button type="button" onClick={() => setEditing(false)}>{t("Cancel")}</button>
          </div>
          {error && <p className="error inline-error">{t(error)}</p>}
        </form>
      )}
    </section>
  );
}

function cleanCustomerPayload(payload: Record<string, string | number | null>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== ""));
}

function formatStartMonth(month?: number | null, year?: number | null) {
  if (!month || !year) return "NA";
  return `${new Date(2024, month - 1).toLocaleString("en", { month: "short" })} ${year}`;
}

function formatBillMonth(month: number, year: number) {
  return `${new Date(2024, month - 1).toLocaleString("en", { month: "long" })} ${year}`;
}

function MonthSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>
      {Array.from({ length: 12 }, (_, index) => (
        <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleString("en", { month: "short" })}</option>
      ))}
    </select></label>
  );
}

function YearInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<input type="number" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
