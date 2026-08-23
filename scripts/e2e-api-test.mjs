#!/usr/bin/env node

const apiBaseUrl = (process.env.E2E_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const allowProduction = process.env.ALLOW_PRODUCTION_E2E === "true";
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const month = Number(process.env.E2E_MONTH ?? new Date().getMonth() + 1);
const year = Number(process.env.E2E_YEAR ?? new Date().getFullYear());

const state = {
  adminToken: "",
  employeeToken: "",
  created: {
    employees: [],
    plans: [],
    boxes: [],
    customers: []
  }
};

const results = [];

main().catch((error) => {
  fail("Unexpected test runner error", error);
  printResults();
  process.exitCode = 1;
});

async function main() {
  guardAgainstProduction();

  await step("Backend health check", async () => {
    const health = await rawRequest("/health");
    assert(health.status === 200, `Expected health 200, got ${health.status}`);
  });

  const admin = await prepareAdminLogin();
  state.adminToken = admin.token;

  await step("Admin can enable internet system", async () => {
    const response = await api("PUT", "/api/auth/internet-settings", { internetEnabled: true }, state.adminToken);
    assert(response.internetEnabled === true, "Internet system was not enabled");
  });

  const employeePassword = `Emp@${stamp}`;
  const employeeUpdatedPassword = `Emp2@${stamp}`;
  const employee = await step("Admin can add and update employee password", async () => {
    const created = await api("POST", "/api/admin/employees", {
      name: `E2E Employee ${stamp}`,
      email: `e2e.employee.${stamp}@example.com`,
      phone: "9999999999",
      password: employeePassword
    }, state.adminToken);
    state.created.employees.push(created.id);

    const updated = await api("PUT", `/api/admin/employees/${created.id}`, {
      name: created.name,
      email: created.email,
      phone: "9999999999",
      password: employeeUpdatedPassword,
      isActive: true
    }, state.adminToken);
    assert(updated.id === created.id, "Employee update returned different employee");
    return updated;
  });

  state.employeeToken = await step("Employee can login with updated password", async () => {
    const loginResponse = await login(employee.email, employeeUpdatedPassword);
    assert(loginResponse.user.role === "EMPLOYEE", "Login user is not employee");
    return loginResponse.token;
  });

  const cablePlan = await createPlan("CABLE", 150, "Admin can add cable plan");
  const upgradedCablePlan = await createPlan("CABLE", 220, "Admin can add second cable plan");
  const internetPlan = await createPlan("INTERNET", 300, "Admin can add internet plan");

  const setTopBox = await step("Admin can add set top box", async () => {
    const box = await api("POST", "/api/admin/set-top-boxes", {
      boxNumber: `E2E-STB-${stamp}`,
      pairedCardNumber: `E2E-CARD-${stamp}`,
      notes: "Automated E2E test box"
    }, state.adminToken);
    state.created.boxes.push(box.id);
    assert(box.boxNumber.includes(stamp), "Set top box number mismatch");
    return box;
  });

  const customer = await step("Admin can add customer with collector, plans, and STB", async () => {
    const created = await api("POST", "/api/admin/customers", {
      customerCode: `9${stamp.slice(-5)}`,
      firstName: "E2E",
      lastName: `Customer ${stamp}`,
      phone: "8888888888",
      address: `E2E Test Address ${stamp}`,
      collectorId: employee.id,
      cableStatus: "ACTIVE",
      internetStatus: "ACTIVE",
      cablePlanId: cablePlan.id,
      internetPlanId: internetPlan.id,
      cableStartMonth: month,
      cableStartYear: year,
      internetStartMonth: month,
      internetStartYear: year,
      effectiveMonth: month,
      effectiveYear: year,
      setTopBoxId: setTopBox.id,
      notes: "Created by automated E2E API test"
    }, state.adminToken);
    state.created.customers.push(created.id);
    assert(created.firstName === "E2E", "Customer first name mismatch");
    return created;
  });

  await step("Admin can generate monthly bill", async () => {
    const response = await api("POST", "/api/admin/generate-monthly-bills", { month, year }, state.adminToken, { expectedStatus: 200 });
    assert(response.month === month && response.year === year, "Generate bill returned wrong period");
  });

  let customerDetail = await step("Customer search returns created customer with billing", async () => {
    const rows = await api("GET", `/api/customers?q=${encodeURIComponent(customer.customerCode)}&month=${month}&year=${year}`, null, state.adminToken);
    const found = rows.find((row) => row.id === customer.id);
    assert(Boolean(found), "Created customer not found in search");
    assert(found.boxes?.[0]?.setTopBox?.boxNumber === setTopBox.boxNumber, "STB assignment not visible on customer");
    assert(found.billings?.[0]?.totalAmount === 450, `Expected total bill 450, got ${found.billings?.[0]?.totalAmount}`);
    return found;
  });

  await step("Employee can see assigned customer", async () => {
    const rows = await api("GET", `/api/customers?q=${encodeURIComponent(customer.customerCode)}&month=${month}&year=${year}`, null, state.employeeToken);
    assert(rows.some((row) => row.id === customer.id), "Employee cannot see assigned customer");
  });

  await step("Employee cannot collect Admin UPI payment", async () => {
    const billingId = customerDetail.billings[0].id;
    const response = await api("POST", "/api/payments", formData({ billingId, amount: "1", mode: "ADMIN_UPI" }), state.employeeToken, { expectedStatus: 403 });
    assert(response.message === "Employees Cannot Collect Admin UPI Payments.", "Expected Admin UPI restriction message");
  });

  await step("Employee can update cable plan before collection", async () => {
    const updated = await api("PUT", `/api/customers/${customer.id}/cable-plan`, {
      cablePlanId: upgradedCablePlan.id,
      month,
      year
    }, state.employeeToken);
    assert(updated.cablePlanId === upgradedCablePlan.id, "Cable plan was not updated");
  });

  customerDetail = await step("Updated plan recalculates current bill", async () => {
    const detail = await api("GET", `/api/customers/${customer.id}`, null, state.adminToken);
    const billing = detail.billings.find((item) => item.month === month && item.year === year);
    assert(billing.totalAmount === 520, `Expected updated bill 520, got ${billing.totalAmount}`);
    return detail;
  });

  await step("Employee can collect partial payment", async () => {
    const billing = customerDetail.billings.find((item) => item.month === month && item.year === year);
    const payments = await api("POST", "/api/payments", formData({ billingId: billing.id, amount: "100", mode: "CASH" }), state.employeeToken);
    assert(Array.isArray(payments) && payments[0]?.amount === 100, "Partial payment was not recorded");
  });

  await step("Employee cannot update plan after partial collection", async () => {
    const response = await api("PUT", `/api/customers/${customer.id}/cable-plan`, {
      cablePlanId: cablePlan.id,
      month,
      year
    }, state.employeeToken, { expectedStatus: 400 });
    assert(response.message.includes("Bill Already Collected"), "Expected collected bill restriction");
  });

  await step("Payment history includes collected payment", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const report = await api("GET", `/api/reports/payment-history?fromDate=${date}&toDate=${date}&employeeId=${employee.id}&q=${customer.customerCode}`, null, state.adminToken);
    assert(report.totals.total >= 100, "Payment history total did not include payment");
    assert(report.payments.some((payment) => payment.amount === 100), "Payment row was not found");
  });

  await step("Invalid date range is blocked in reports", async () => {
    const response = await api("GET", "/api/reports/payment-history?fromDate=2026-08-23&toDate=2026-08-01", null, state.adminToken, { expectedStatus: 400 });
    assert(response.message === "To Date Cannot Be Earlier Than From Date.", "Invalid date range was not blocked");
  });

  await step("Admin can record employee handover and ledger updates", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const handover = await api("POST", "/api/admin/handovers", {
      employeeId: employee.id,
      amount: 50,
      fromDate: date,
      toDate: date,
      note: "Automated E2E handover"
    }, state.adminToken);
    assert(handover.amount === 50, "Handover amount mismatch");

    const ledger = await api("GET", `/api/reports/employee-ledger?employeeId=${employee.id}&fromDate=${date}&toDate=${date}`, null, state.adminToken);
    assert(ledger.collected >= 100, "Ledger collected amount did not include payment");
    assert(ledger.handedOver >= 50, "Ledger handed over amount did not include handover");
  });

  await step("Admin can reset monthly payment", async () => {
    const response = await api("POST", "/api/payments/reset", { customerId: customer.id, month, year }, state.adminToken, { expectedStatus: 200 });
    assert(response.resetAmount >= 100, "Reset amount did not include payment");
  });

  await step("Customer history and plan history are available", async () => {
    const [history, planHistory] = await Promise.all([
      api("GET", `/api/customers/${customer.id}/history`, null, state.adminToken),
      api("GET", `/api/customers/${customer.id}/plan-history`, null, state.adminToken)
    ]);
    assert(history.length >= 3, "Customer history has too few entries");
    assert(planHistory.some((item) => item.month === month && item.year === year), "Plan history missing test period");
  });

  await cleanup();
  printResults();
}

async function prepareAdminLogin() {
  if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
    return login(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  }

  const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL ?? process.env.SEED_SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD ?? process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!superAdminEmail || !superAdminPassword) {
    throw new Error("Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or E2E_SUPER_ADMIN_EMAIL/E2E_SUPER_ADMIN_PASSWORD.");
  }

  const superLogin = await step("Super admin can login", async () => {
    const loginResponse = await login(superAdminEmail, superAdminPassword);
    assert(loginResponse.user.role === "SUPER_ADMIN", "Login user is not super admin");
    return loginResponse;
  });

  const adminPassword = `Admin@${stamp}`;
  const org = await step("Super admin can create organisation and admin", async () => {
    const organisation = await api("POST", "/api/super-admin/organisations", {
      organisationName: `E2E Org ${stamp}`,
      adminName: `E2E Admin ${stamp}`,
      adminEmail: `e2e.admin.${stamp}@example.com`,
      adminPhone: "7777777777",
      adminPassword
    }, superLogin.token);
    assert(organisation.users?.[0]?.email?.includes(stamp), "Organisation admin was not created");
    return organisation;
  });

  const adminEmail = org.users[0].email;
  const initialAdminLogin = await step("Created admin can login", async () => login(adminEmail, adminPassword));
  const changedPassword = `Admin2@${stamp}`;
  await step("Created admin can change temporary password", async () => {
    const response = await api("POST", "/api/auth/change-password", {
      currentPassword: adminPassword,
      newPassword: changedPassword
    }, initialAdminLogin.token, { expectedStatus: 200 });
    assert(response.message.toLowerCase().includes("password"), "Password change did not succeed");
  });
  return login(adminEmail, changedPassword);
}

async function createPlan(type, price, label) {
  return step(label, async () => {
    const plan = await api("POST", "/api/admin/plans", {
      name: `E2E ${type} ${price} ${stamp}`,
      type,
      price
    }, state.adminToken);
    state.created.plans.push(plan.id);
    assert(plan.price === price, `${type} plan price mismatch`);
    return plan;
  });
}

async function cleanup() {
  await step("Cleanup test data using soft-delete APIs", async () => {
    for (const customerId of state.created.customers.reverse()) {
      await ignoreFailure(() => api("DELETE", `/api/admin/customers/${customerId}`, null, state.adminToken));
    }
    for (const boxId of state.created.boxes.reverse()) {
      await ignoreFailure(() => api("DELETE", `/api/admin/set-top-boxes/${boxId}`, null, state.adminToken));
    }
    for (const planId of state.created.plans.reverse()) {
      await ignoreFailure(() => api("DELETE", `/api/admin/plans/${planId}`, null, state.adminToken));
    }
    for (const employeeId of state.created.employees.reverse()) {
      await ignoreFailure(() => api("DELETE", `/api/admin/employees/${employeeId}`, null, state.adminToken));
    }
  });
}

async function login(email, password) {
  return api("POST", "/api/auth/login", { email, password }, undefined, { expectedStatus: 200 });
}

async function api(method, path, body, token, options = {}) {
  const expectedStatus = options.expectedStatus ?? (method === "POST" ? 201 : 200);
  const response = await rawRequest(path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {})
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const data = await parseResponse(response);
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function rawRequest(path, options) {
  const url = path.startsWith("http") ? path : `${apiBaseUrl}${path}`;
  return fetch(url, options);
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formData(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

async function step(name, run) {
  const started = Date.now();
  try {
    const value = await run();
    results.push({ name, status: "PASS", ms: Date.now() - started });
    console.log(`PASS ${name}`);
    return value;
  } catch (error) {
    results.push({ name, status: "FAIL", ms: Date.now() - started, error: error.message });
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function ignoreFailure(run) {
  try {
    await run();
  } catch (error) {
    console.warn(`Cleanup warning: ${error.message}`);
  }
}

function guardAgainstProduction() {
  const lower = apiBaseUrl.toLowerCase();
  const looksProduction = lower.includes("onrender.com") || lower.includes("vercel.app") || lower.includes("kcntech");
  if (looksProduction && !allowProduction) {
    throw new Error(`Refusing to run E2E test against possible production URL: ${apiBaseUrl}. Set ALLOW_PRODUCTION_E2E=true only for a dedicated test environment.`);
  }
}

function fail(name, error) {
  results.push({ name, status: "FAIL", ms: 0, error: error.message });
  console.error(error);
}

function printResults() {
  const passed = results.filter((item) => item.status === "PASS").length;
  const failed = results.filter((item) => item.status === "FAIL").length;
  console.log("\nE2E API Test Report");
  console.table(results);
  console.log(`Result: ${passed} passed, ${failed} failed`);
}
