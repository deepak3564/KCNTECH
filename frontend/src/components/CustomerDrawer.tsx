import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { api, money, SessionUser, uploadUrl } from "../api/client";
import { useI18n } from "../i18n";
import { Box, Customer, Employee, Plan } from "../types";
import { CustomerHistoryTabs } from "./CustomerHistoryTabs";
import { SetTopBoxSearchSelect } from "./SetTopBoxSearchSelect";

export function CustomerDrawer({
  customer,
  user,
  plans,
  employees,
  boxes,
  month,
  year,
  internetEnabled,
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
  internetEnabled: boolean;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const billings = customer.billings ?? [];
  const paymentHistoryBillings = billings.filter((item) => (item.payments?.length ?? 0) > 0);
  const bill = billings.find((item) => item.month === month && item.year === year) ?? billings[0];
  const pendingAmount = Math.max((bill?.totalAmount ?? 0) - (bill?.paidAmount ?? 0), 0);
  const hasPendingAmount = pendingAmount > 0;
  const selectedBillFullyPaid = isBillingFullyPaid(bill);
  const [amount, setAmount] = useState(String(pendingAmount));
  const [mode, setMode] = useState("CASH");
  const [proof, setProof] = useState<File | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [employeeCablePlanId, setEmployeeCablePlanId] = useState(customer.cablePlanId ?? "");
  const [employeePlanEditOpen, setEmployeePlanEditOpen] = useState(false);
  const [employeePlanDirty, setEmployeePlanDirty] = useState(false);
  const [employeeCablePlanMessage, setEmployeeCablePlanMessage] = useState("");
  const [employeeCablePlanError, setEmployeeCablePlanError] = useState("");
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceMonth, setAdvanceMonth] = useState(month);
  const [advanceYear, setAdvanceYear] = useState(year);
  const [advanceCablePlanId, setAdvanceCablePlanId] = useState(customer.cablePlanId ?? "");
  const [advanceBillingId, setAdvanceBillingId] = useState("");
  const [advancePending, setAdvancePending] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMode, setAdvanceMode] = useState("CASH");
  const [advanceProof, setAdvanceProof] = useState<File | null>(null);
  const [advanceError, setAdvanceError] = useState("");
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const { t } = useI18n();
  const cablePlanOptions = plans.filter((plan) => plan.type === "CABLE" && plan.isActive !== false);
  const canEditPlanInPayment = user.role === "ADMIN" || user.role === "EMPLOYEE";
  const employeePlanBillCollected = isBillingCollected(bill);
  const planEditBlocked = user.role === "EMPLOYEE" && employeePlanBillCollected;
  const hasPlanEditInProgress = employeePlanEditOpen;
  const showPaymentPanel = Boolean(bill) && (
    !(user.role === "EMPLOYEE" && selectedBillFullyPaid) || (canEditPlanInPayment && !planEditBlocked)
  );

  useEffect(() => {
    setAmount(String(pendingAmount));
  }, [pendingAmount]);

  useEffect(() => {
    setEmployeeCablePlanId(customer.cablePlanId ?? "");
    setEmployeePlanEditOpen(false);
    setEmployeePlanDirty(false);
    setAdvanceCablePlanId(customer.cablePlanId ?? "");
  }, [customer.cablePlanId]);

  useEffect(() => {
    if (!advanceOpen) return;
    if (customer.cableStatus !== "NA" && !advanceCablePlanId) {
      clearLoadedAdvanceBill();
      return;
    }

    const timer = window.setTimeout(() => {
      loadAdvanceBill(false).catch((err) => {
        setAdvanceError(err instanceof Error ? err.message : "Could Not Load Payment Preview");
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [advanceOpen, advanceMonth, advanceYear, advanceCablePlanId]);

  async function collect(event: React.FormEvent) {
    event.preventDefault();
    if (!bill) return;
    setPaymentError("");
    if (hasPlanEditInProgress) {
      setPaymentError("Please Save Changes Before Collecting.");
      return;
    }
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

  async function updateEmployeeCablePlan() {
    if (!bill) return;
    setPaymentError("");
    setEmployeeCablePlanMessage("");
    setEmployeeCablePlanError("");
    if (!employeePlanDirty) {
      setPaymentError("");
      setEmployeeCablePlanMessage("");
      setEmployeeCablePlanError("");
      setEmployeePlanEditOpen(false);
      return;
    }
    if (employeePlanBillCollected) {
      setEmployeeCablePlanError("Bill Already Collected For Selected Month. If Change In Plans Please Contact Admin.");
      return;
    }
    try {
      await api(`/customers/${customer.id}/cable-plan`, {
        method: "PUT",
        body: JSON.stringify({ cablePlanId: employeeCablePlanId || null, month: bill.month, year: bill.year })
      });
      setEmployeeCablePlanMessage("Cable Plan Updated.");
      setEmployeePlanEditOpen(false);
      setEmployeePlanDirty(false);
      await onRefresh();
    } catch (err) {
      setEmployeeCablePlanError(err instanceof Error ? err.message : "Could Not Update Cable Plan");
    }
  }

  async function loadAdvanceBill(showLoading = true) {
    setAdvanceError("");
    const preview = await api<{ billings: Array<{ id: string; totalAmount: number; paidAmount: number }>; pendingAmount: number }>("/payments/preview", {
      method: "POST",
      showLoading,
      body: JSON.stringify({
        customerId: customer.id,
        periods: [{ month: advanceMonth, year: advanceYear }],
        samePlan: false,
        cablePlanId: customer.cableStatus === "NA" ? null : advanceCablePlanId || null,
        internetPlanId: customer.internetStatus === "NA" ? null : customer.internetPlanId ?? null
      })
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

  function clearLoadedAdvanceBill() {
    setAdvanceBillingId("");
    setAdvancePending(0);
    setAdvanceAmount("");
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
    const selectedAdvancePlan = cablePlanOptions.find((plan) => plan.id === advanceCablePlanId);
    form.append("note", `Advance payment for ${advanceMonth}/${advanceYear}${selectedAdvancePlan ? ` with cable plan ${selectedAdvancePlan.name}` : ""}`);
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
      <div className="detail-grid customer-detail-panel">
        <span>{t("Phone")}<strong>{customer.phone ?? "NA"}</strong></span>
        <span>{t("Customer ID")}<strong>{customer.customerCode ?? "NA"}</strong></span>
        <span>{t("Cable")}<strong>{customer.cablePlan ? `${customer.cablePlan.name} · ${money(customer.cablePlan.price)}` : "NA"}</strong></span>
        <span>{t("Cable Start Month")}<strong>{formatStartMonth(customer.cableStartMonth, customer.cableStartYear)}</strong></span>
        {internetEnabled && <span>{t("Internet")}<strong>{customer.internetPlan ? `${customer.internetPlan.name} · ${money(customer.internetPlan.price)}` : "NA"}</strong></span>}
        {internetEnabled && <span>{t("Internet Start Month")}<strong>{formatStartMonth(customer.internetStartMonth, customer.internetStartYear)}</strong></span>}
        <span>{t("STB")}<strong>{customer.boxes[0]?.setTopBox.boxNumber ?? "NA"}</strong></span>
        <span>{t("Card")}<strong>{customer.boxes[0]?.setTopBox.pairedCardNumber ?? "NA"}</strong></span>
        <span>{t("Current Bill")}<strong>{bill ? `${t(bill.status[0] + bill.status.slice(1).toLowerCase())} · ${money(bill.totalAmount - bill.paidAmount)}` : "NA"}</strong></span>
      </div>
      {bill && showPaymentPanel && (
        <form className="payment-form accept-payment-panel" onSubmit={collect}>
          <h3>{t("Accept Payment")}</h3>
          <div className="history">{t("Bill Month")}<strong>{formatBillMonth(bill.month, bill.year)}</strong></div>
          <div className="history">{t("Pending")}<strong>{money(pendingAmount)}</strong></div>
          {canEditPlanInPayment && (
            <>
              <label>
                {t("Cable Plan")}
                <select value={employeeCablePlanId} disabled={planEditBlocked || !employeePlanEditOpen} onChange={(event) => {
                  setEmployeeCablePlanId(event.target.value);
                  setEmployeePlanDirty(true);
                  setPaymentError("");
                }}>
                  <option value="">NA</option>
                  {cablePlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}
                </select>
              </label>
              {planEditBlocked && <p className="error inline-error">{formatBillMonth(bill.month, bill.year)} {t("Bill Is Already Collected. If Change In Plans Please Contact Admin.")}</p>}
              {employeeCablePlanMessage && <p className="success">{t(employeeCablePlanMessage)}</p>}
              {employeeCablePlanError && <p className="error inline-error">{t(employeeCablePlanError)}</p>}
            </>
          )}
          <label>{t("Amount")}<input type="number" min="0" value={amount} disabled={!hasPendingAmount} onChange={(e) => setAmount(e.target.value)} /></label>
          {paymentError && <p className="error inline-error">{t(paymentError)}</p>}
          <label>{t("Mode")}<select value={mode} disabled={!hasPendingAmount} onChange={(e) => setMode(e.target.value)}><option value="CASH">{t("Cash")}</option>{user.role === "ADMIN" && <option value="ADMIN_UPI">{t("Admin UPI")}</option>}<option value="EMPLOYEE_UPI">{t("Employee UPI")}</option></select></label>
          {mode !== "CASH" && <ProofUpload proof={proof} disabled={!hasPendingAmount} onChange={setProof} />}
          <div className="payment-action-row">
            {canEditPlanInPayment && (
              <button
                type="button"
                disabled={planEditBlocked}
                onClick={() => {
                  if (!employeePlanEditOpen) {
                    setEmployeeCablePlanMessage("");
                    setEmployeeCablePlanError("");
                    setEmployeePlanDirty(false);
                    setEmployeePlanEditOpen(true);
                    return;
                  }
                  updateEmployeeCablePlan();
                }}
              >
                {employeePlanEditOpen ? t("Update Plan") : t("Edit Plan")}
              </button>
            )}
            <button className="primary" disabled={!hasPendingAmount}>{t("Mark Collected")}</button>
          </div>
        </form>
      )}
      <section className={`customer-payment-tabs ${advanceOpen ? "payment-tab-advance-active" : ""} ${paymentHistoryOpen ? "payment-tab-history-active" : ""}`}>
        <div className="customer-history-tab-buttons">
          <button
            type="button"
            className={advanceOpen ? "active-tab" : ""}
            onClick={() => {
              setAdvanceOpen((current) => !current);
              setPaymentHistoryOpen(false);
            }}
          >
            {advanceOpen ? t("Hide Advance Payment") : t("Advance Payment")}
          </button>
          <button
            type="button"
            className={paymentHistoryOpen ? "active-tab" : ""}
            onClick={() => {
              setPaymentHistoryOpen((current) => !current);
              setAdvanceOpen(false);
            }}
          >
            {paymentHistoryOpen ? t("Hide Payment History") : t("Payment History")}
          </button>
        </div>
        {advanceOpen && (
          <div className="customer-payment-tab-content">
          <form className="payment-form" onSubmit={collectAdvance}>
            <h3>{t("Advance Payment")}</h3>
            <div className="advance-period-row">
              <MonthSelect label={t("Bill Month")} value={String(advanceMonth)} onChange={(value) => {
                setAdvanceMonth(Number(value));
                clearLoadedAdvanceBill();
              }} />
              <YearInput label={t("Bill Year")} value={String(advanceYear)} onChange={(value) => {
                setAdvanceYear(Number(value));
                clearLoadedAdvanceBill();
              }} />
            </div>
            {customer.cableStatus !== "NA" && (
              <label>
                {t("Cable Plan")}
                <select value={advanceCablePlanId} onChange={(event) => {
                  setAdvanceCablePlanId(event.target.value);
                  clearLoadedAdvanceBill();
                }}>
                  <option value="">NA</option>
                  {cablePlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}
                </select>
              </label>
            )}
            <div className="history">{t("Selected Bill")}<strong>{formatBillMonth(advanceMonth, advanceYear)}</strong></div>
            <div className="history">{t("Pending")}<strong>{money(advancePending)}</strong></div>
            <label>{t("Amount")}<input type="number" min="0" value={advanceAmount} disabled={!advanceBillingId || advancePending <= 0} onChange={(e) => setAdvanceAmount(e.target.value)} /></label>
            {advanceError && <p className="error inline-error">{t(advanceError)}</p>}
            <label>{t("Mode")}<select value={advanceMode} disabled={!advanceBillingId || advancePending <= 0} onChange={(e) => setAdvanceMode(e.target.value)}><option value="CASH">{t("Cash")}</option>{user.role === "ADMIN" && <option value="ADMIN_UPI">{t("Admin UPI")}</option>}<option value="EMPLOYEE_UPI">{t("Employee UPI")}</option></select></label>
            {advanceMode !== "CASH" && <ProofUpload proof={advanceProof} disabled={!advanceBillingId || advancePending <= 0} onChange={setAdvanceProof} />}
            <button className="primary" disabled={!advanceBillingId || advancePending <= 0}>{t("Mark Advance Collected")}</button>
          </form>
          </div>
        )}
        {paymentHistoryOpen && (
          <div className="customer-payment-tab-content">
          <div className="history-list">
            {paymentHistoryBillings.length === 0 && <p className="empty">{t("No Payment History Found.")}</p>}
            {paymentHistoryBillings.map((item) => (
              <div className="payment-history-item" key={item.id}>
                <div className="history">{item.month}/{item.year}<strong>{t(item.status[0] + item.status.slice(1).toLowerCase())} · {money(item.paidAmount)} / {money(item.totalAmount)}</strong></div>
                {(item.payments ?? []).map((payment) => (
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
          </div>
          </div>
        )}
      </section>
      <CustomerHistoryTabs customerId={customer.id} internetEnabled={internetEnabled} />
      {user.role === "ADMIN" && <AdminCustomerActions customer={customer} plans={plans} employees={employees} boxes={boxes} month={month} year={year} internetEnabled={internetEnabled} onRefresh={onRefresh} onClose={onClose} />}
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
  internetEnabled,
  onRefresh,
  onClose
}: {
  customer: Customer;
  plans: Plan[];
  employees: Employee[];
  boxes: Box[];
  month: number;
  year: number;
  internetEnabled: boolean;
  onRefresh: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [activeAdminAction, setActiveAdminAction] = useState<"edit" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [resetMonth, setResetMonth] = useState(String(month));
  const [resetYear, setResetYear] = useState(String(year));
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
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
  const selectedResetBilling = (customer.billings ?? []).find((billing) => billing.month === Number(resetMonth) && billing.year === Number(resetYear));
  const canResetPayment = (selectedResetBilling?.paidAmount ?? 0) > 0 || (selectedResetBilling?.payments?.length ?? 0) > 0;

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
      internetPlanId: !internetEnabled || values.internetStatus === "NA" ? null : values.internetPlanId || null,
      cableStartMonth: values.cableStatus === "NA" ? null : values.cableStartMonth,
      cableStartYear: values.cableStatus === "NA" ? null : values.cableStartYear,
      internetStatus: internetEnabled ? values.internetStatus : "NA",
      internetStartMonth: !internetEnabled || values.internetStatus === "NA" ? null : values.internetStartMonth,
      internetStartYear: !internetEnabled || values.internetStatus === "NA" ? null : values.internetStartYear,
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

  async function resetPayment(event: React.FormEvent) {
    event.preventDefault();
    setResetError("");
    setResetMessage("");
    if (!canResetPayment) {
      setResetError("No Payment Found To Reset For Selected Month.");
      return;
    }
    if (!confirm(t("Are You Sure You Want To Reset This Month Payment?"))) return;
    try {
      await api("/payments/reset", {
        method: "POST",
        body: JSON.stringify({ customerId: customer.id, month: resetMonth, year: resetYear })
      });
      setResetMessage("Payment Reset Successfully.");
      await onRefresh();
      onClose();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could Not Reset Payment");
    }
  }

  return (
    <section className="admin-actions admin-customer-tabs">
      <div className="customer-history-tab-buttons">
        <button
          type="button"
          className={activeAdminAction === "edit" ? "active-tab" : ""}
          onClick={() => setActiveAdminAction((current) => current === "edit" ? null : "edit")}
        >
          {activeAdminAction === "edit" ? t("Hide Edit") : t("Edit Customer")}
        </button>
        <button
          type="button"
          className={activeAdminAction === "reset" ? "active-tab" : ""}
          onClick={() => setActiveAdminAction((current) => current === "reset" ? null : "reset")}
        >
          {activeAdminAction === "reset" ? t("Hide Reset Payment") : t("Reset Payment")}
        </button>
      </div>
      {error && <p className="error inline-error">{t(error)}</p>}
      {activeAdminAction === "edit" && (
        <div className="admin-customer-tab-content">
        <form className="customer-edit-form" onSubmit={save}>
          <label>{t("Customer ID")}<input value={values.customerCode} onChange={(e) => setValues({ ...values, customerCode: e.target.value })} /></label>
          <label>{t("First Name")}<input value={values.firstName} onChange={(e) => setValues({ ...values, firstName: e.target.value })} /></label>
          <label>{t("Last Name")}<input value={values.lastName} onChange={(e) => setValues({ ...values, lastName: e.target.value })} /></label>
          <label>{t("Phone")}<input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} /></label>
          <label>{t("Address")}<input value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} /></label>
          <label>{t("Collector")}<select value={values.collectorId} onChange={(e) => setValues({ ...values, collectorId: e.target.value })}><option value="">{t("Not Assigned")}</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role === "ADMIN" ? ` (${t("Admin")})` : ""}</option>)}</select></label>
          <SetTopBoxSearchSelect label={t("Set Top Box")} boxes={boxOptions} value={values.setTopBoxId} emptyLabel="NA" onChange={(value) => setValues({ ...values, setTopBoxId: value })} />
          <label>{t("Status")}<select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value as Customer["status"] })}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option></select></label>
          <label>{t("Cable Status")}<select value={values.cableStatus} onChange={(e) => setValues({ ...values, cableStatus: e.target.value as Customer["cableStatus"] })}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option><option value="NA">NA</option></select></label>
          {values.cableStatus !== "NA" && <label>{t("Cable Plan")}<select value={values.cablePlanId} onChange={(e) => setValues({ ...values, cablePlanId: e.target.value })}><option value="">NA</option>{cablePlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}</select></label>}
          {values.cableStatus !== "NA" && <MonthSelect label={t("Cable Start Month")} value={values.cableStartMonth} onChange={(value) => setValues({ ...values, cableStartMonth: value })} />}
          {values.cableStatus !== "NA" && <YearInput label={t("Cable Start Year")} value={values.cableStartYear} onChange={(value) => setValues({ ...values, cableStartYear: value })} />}
          {internetEnabled && <label>{t("Internet Status")}<select value={values.internetStatus} onChange={(e) => setValues({ ...values, internetStatus: e.target.value as Customer["internetStatus"] })}><option value="ACTIVE">{t("Active")}</option><option value="INACTIVE">{t("Inactive")}</option><option value="NA">NA</option></select></label>}
          {internetEnabled && values.internetStatus !== "NA" && <label>{t("Internet Plan")}<select value={values.internetPlanId} onChange={(e) => setValues({ ...values, internetPlanId: e.target.value })}><option value="">NA</option>{internetPlanOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}</select></label>}
          {internetEnabled && values.internetStatus !== "NA" && <MonthSelect label={t("Internet Start Month")} value={values.internetStartMonth} onChange={(value) => setValues({ ...values, internetStartMonth: value })} />}
          {internetEnabled && values.internetStatus !== "NA" && <YearInput label={t("Internet Start Year")} value={values.internetStartYear} onChange={(value) => setValues({ ...values, internetStartYear: value })} />}
          <label className="full-field">{t("Notes")}<input value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} /></label>
          <div className="edit-actions customer-edit-action-row full-field">
            <button className="primary">{t("Save")}</button>
            <button type="button" onClick={() => setActiveAdminAction(null)}>{t("Cancel")}</button>
            <button type="button" className="delete-button" onClick={deleteCustomer}>{t("Delete")}</button>
          </div>
          {error && <p className="error inline-error">{t(error)}</p>}
        </form>
        </div>
      )}
      {activeAdminAction === "reset" && (
        <div className="admin-customer-tab-content">
      <form className="payment-form" onSubmit={resetPayment}>
        <h3>{t("Reset Monthly Payment")}</h3>
        <div className="advance-period-row">
          <MonthSelect label={t("Bill Month")} value={resetMonth} onChange={setResetMonth} />
          <YearInput label={t("Bill Year")} value={resetYear} onChange={setResetYear} />
        </div>
        <div className="history">{t("Collected")}<strong>{money(selectedResetBilling?.paidAmount ?? 0)}</strong></div>
        {resetError && <p className="error inline-error">{t(resetError)}</p>}
        {resetMessage && <p className="success">{t(resetMessage)}</p>}
        <button className="delete-button" disabled={!canResetPayment}>{t("Reset Payment")}</button>
      </form>
        </div>
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

function isBillingCollected(billing?: Customer["billings"][number]) {
  if (!billing) return false;
  return billing.status === "PAID" || billing.status === "PARTIAL" || billing.paidAmount > 0 || (billing.payments?.length ?? 0) > 0;
}

function isBillingFullyPaid(billing?: Customer["billings"][number]) {
  if (!billing) return false;
  return billing.status === "PAID" || Math.max(billing.totalAmount - billing.paidAmount, 0) <= 0;
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
  return (
    <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>
      {yearOptions(value).map((year) => <option key={year} value={year}>{year}</option>)}
    </select></label>
  );
}

function yearOptions(value?: string) {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>();
  for (let year = currentYear - 1; year <= currentYear + 5; year += 1) years.add(year);
  const selectedYear = Number(value);
  if (Number.isInteger(selectedYear) && selectedYear > 1900) years.add(selectedYear);
  return Array.from(years).sort((a, b) => a - b);
}
