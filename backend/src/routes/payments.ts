import { Router } from "express";
import multer from "multer";
import { BillingStatus, Role } from "@prisma/client";
import { z } from "zod";
import { ensureMonthlyBillings, recalculateBillingStatus } from "../lib/billing.js";
import { addCustomerHistory } from "../lib/customerHistory.js";
import { prisma } from "../lib/db.js";
import { sendPaymentReceivedEmail } from "../lib/email.js";
import { organisationScope, requireAuth, requireRole } from "../middleware/auth.js";

const upload = multer({ dest: "uploads/" });
export const paymentsRouter = Router();
paymentsRouter.use(requireAuth, requireRole(Role.ADMIN, Role.EMPLOYEE));

const periodSchema = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int() });

paymentsRouter.post("/preview", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({
    customerId: z.string(),
    periods: z.array(periodSchema).min(1),
    samePlan: z.coerce.boolean().default(true),
    cablePlanId: z.string().nullable().optional(),
    internetPlanId: z.string().nullable().optional()
  }).parse(req.body);

  const customer = await prisma.customer.findFirst({
    where: {
      id: body.customerId,
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
    },
    include: { cablePlan: true, internetPlan: true, maintenance: true }
  });
  if (!customer) return res.status(404).json({ message: "Customer not found." });

  const billings = [];
  for (const period of body.periods) {
    if (body.samePlan) {
      await ensureMonthlyBillings(organisationId, period.month, period.year);
    } else {
      await overridePlansForBilling(organisationId, customer.id, period.month, period.year, body.cablePlanId ?? null, body.internetPlanId ?? null);
    }
    const billing = await prisma.monthlyBilling.findUnique({
      where: { customerId_month_year: { customerId: customer.id, month: period.month, year: period.year } }
    });
    if (billing) billings.push(billing);
  }

  res.json({
    billings,
    pendingAmount: billings.reduce((sum, item) => sum + Math.max(item.totalAmount - item.paidAmount, 0), 0)
  });
});

paymentsRouter.post("/", upload.single("proof"), async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      billingId: z.string().optional(),
      billingIds: z.string().optional(),
      amount: z.coerce.number().int().min(1),
      mode: z.enum(["CASH", "ADMIN_UPI", "EMPLOYEE_UPI"]),
      note: z.string().optional()
    })
    .parse(req.body);
  const billingIds = body.billingIds ? JSON.parse(body.billingIds) as string[] : body.billingId ? [body.billingId] : [];
  if (!billingIds.length) return res.status(400).json({ message: "Please Select At Least One Bill." });
  if (req.user!.role === Role.EMPLOYEE && body.mode === "ADMIN_UPI") {
    return res.status(403).json({ message: "Employees Cannot Collect Admin UPI Payments." });
  }

  const billings = await prisma.monthlyBilling.findMany({
    where: { id: { in: billingIds }, organisationId },
    include: { customer: true }
  });
  if (billings.length !== billingIds.length) return res.status(404).json({ message: "Billing record not found." });
  if (req.user!.role === Role.EMPLOYEE && billings.some((billing) => billing.customer.collectorId !== req.user!.id)) {
    return res.status(403).json({ message: "This customer is not assigned to you." });
  }
  const pendingAmount = billings.reduce((sum, billing) => sum + Math.max(billing.totalAmount - billing.paidAmount, 0), 0);
  if (body.amount > pendingAmount) {
    return res.status(400).json({ message: "Collection Amount Cannot Be Greater Than Pending Amount." });
  }

  let remainingAmount = body.amount;
  const payments = [];
  for (const billing of billings.sort((a, b) => a.year - b.year || a.month - b.month)) {
    const billingPending = Math.max(billing.totalAmount - billing.paidAmount, 0);
    const paymentAmount = Math.min(remainingAmount, billingPending);
    if (paymentAmount <= 0) continue;
    payments.push(await prisma.payment.create({
      data: {
        organisationId,
        billingId: billing.id,
        employeeId: req.user!.role === Role.EMPLOYEE ? req.user!.id : undefined,
        amount: paymentAmount,
        mode: body.mode,
        note: body.note,
        proofImageUrl: req.file ? `/uploads/${req.file.filename}` : undefined
      }
    }));
    await recalculateBillingStatus(billing.id);
    remainingAmount -= paymentAmount;
  }
  const paidPeriods = billings
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((billing) => `${billing.month}/${billing.year}`)
    .join(", ");
  await addCustomerHistory({
    organisationId,
    customerId: billings[0].customerId,
    userId: req.user!.id,
    comment: `Payment collected: ${body.amount} by ${body.mode} for ${paidPeriods}.`
  });
  sendPaymentNotification({
    organisationId,
    customerId: billings[0].customerId,
    amount: body.amount,
    mode: body.mode,
    collectorName: req.user!.name,
    paidAt: payments[0]?.paidAt ?? new Date(),
    periods: paidPeriods
  }).catch((error) => console.error("Payment email notification failed", error));
  res.status(201).json(payments);
});

async function sendPaymentNotification({
  organisationId,
  customerId,
  amount,
  mode,
  collectorName,
  paidAt,
  periods
}: {
  organisationId: string;
  customerId: string;
  amount: number;
  mode: string;
  collectorName: string;
  paidAt: Date;
  periods: string;
}) {
  const [organisation, customer, admins] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: organisationId } }),
    prisma.customer.findFirst({
      where: { id: customerId, organisationId },
      include: { cablePlan: true, internetPlan: true }
    }),
    prisma.user.findMany({
      where: { organisationId, role: Role.ADMIN, isActive: true, deleted: false },
      select: { email: true }
    })
  ]);

  if (!organisation || !customer) return;

  await sendPaymentReceivedEmail({
    organisationId,
    organisationName: organisation.name,
    customerId: customer.id,
    customerCode: customer.customerCode,
    customerName: `${customer.firstName} ${customer.lastName ?? ""}`.trim(),
    cablePlan: customer.cablePlan ? `${customer.cablePlan.name} - ${customer.cablePlan.price}` : "NA",
    internetPlan: customer.internetPlan ? `${customer.internetPlan.name} - ${customer.internetPlan.price}` : "NA",
    amount,
    mode,
    collectorName,
    paidAt,
    periods,
    recipients: organisation.notificationEmail ? [organisation.notificationEmail] : admins.map((admin) => admin.email)
  });
}

async function overridePlansForBilling(organisationId: string, customerId: string, month: number, year: number, cablePlanId: string | null, internetPlanId: string | null) {
  const [customer, cablePlan, internetPlan, maintenance] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, organisationId, deleted: false } }),
    cablePlanId ? prisma.plan.findFirst({ where: { id: cablePlanId, organisationId, type: "CABLE", isActive: true, deleted: false } }) : Promise.resolve(null),
    internetPlanId ? prisma.plan.findFirst({ where: { id: internetPlanId, organisationId, type: "INTERNET", isActive: true, deleted: false } }) : Promise.resolve(null),
    prisma.maintenanceCharge.findMany({ where: { customerId, month, year } })
  ]);
  if (!customer) throw new Error("Customer not found.");
  if (cablePlanId && !cablePlan) throw new Error("Selected Cable Plan Is Inactive Or Not Available.");
  if (internetPlanId && !internetPlan) throw new Error("Selected Internet Plan Is Inactive Or Not Available.");

  const cableAmount = cablePlan?.price ?? 0;
  const internetAmount = internetPlan?.price ?? 0;
  const maintenanceAmount = maintenance.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = cableAmount + internetAmount + maintenanceAmount;

  await prisma.customerPlanHistory.upsert({
    where: { customerId_month_year: { customerId, month, year } },
    create: {
      organisationId,
      customerId,
      month,
      year,
      cablePlanId: cablePlan?.id ?? null,
      cablePlanName: cablePlan?.name ?? null,
      cablePrice: cableAmount,
      internetPlanId: internetPlan?.id ?? null,
      internetPlanName: internetPlan?.name ?? null,
      internetPrice: internetAmount
    },
    update: {
      cablePlanId: cablePlan?.id ?? null,
      cablePlanName: cablePlan?.name ?? null,
      cablePrice: cableAmount,
      internetPlanId: internetPlan?.id ?? null,
      internetPlanName: internetPlan?.name ?? null,
      internetPrice: internetAmount
    }
  });

  const existing = await prisma.monthlyBilling.findUnique({ where: { customerId_month_year: { customerId, month, year } } });
  const paidAmount = existing?.paidAmount ?? 0;
  const status = paidAmount <= 0 ? BillingStatus.PENDING : paidAmount < totalAmount ? BillingStatus.PARTIAL : BillingStatus.PAID;
  return prisma.monthlyBilling.upsert({
    where: { customerId_month_year: { customerId, month, year } },
    create: { organisationId, customerId, month, year, cableAmount, internetAmount, maintenanceAmount, totalAmount, status },
    update: { cableAmount, internetAmount, maintenanceAmount, totalAmount, status }
  });
}
