import { BillingStatus, CustomerStatus } from "@prisma/client";
import { prisma } from "./db.js";
import { ensureCustomerPlanHistory } from "./planHistory.js";

export async function ensureMonthlyBillings(organisationId: string, month: number, year: number) {
  const customers = await prisma.customer.findMany({
    where: { organisationId, status: CustomerStatus.ACTIVE, deleted: false },
    include: { cablePlan: true, internetPlan: true, maintenance: { where: { month, year } } }
  });

  for (const customer of customers) {
    const planHistory = await ensureCustomerPlanHistory({ organisationId, customer, month, year });
    const cableAmount = planHistory.cablePrice;
    const internetAmount = planHistory.internetPrice;
    const maintenanceAmount = customer.maintenance.reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = cableAmount + internetAmount + maintenanceAmount;

    await prisma.monthlyBilling.upsert({
      where: { customerId_month_year: { customerId: customer.id, month, year } },
      create: {
        organisationId,
        customerId: customer.id,
        month,
        year,
        cableAmount,
        internetAmount,
        maintenanceAmount,
        totalAmount,
        status: BillingStatus.PENDING
      },
      update: {
        cableAmount,
        internetAmount,
        maintenanceAmount,
        totalAmount
      }
    });
  }
}

export async function recalculateBillingStatus(billingId: string) {
  const billing = await prisma.monthlyBilling.findUnique({
    where: { id: billingId },
    include: { payments: true }
  });

  if (!billing) return;
  const paidAmount = billing.payments.reduce((sum, item) => sum + item.amount, 0);
  const status =
    paidAmount <= 0 ? BillingStatus.PENDING : paidAmount < billing.totalAmount ? BillingStatus.PARTIAL : BillingStatus.PAID;

  await prisma.monthlyBilling.update({
    where: { id: billingId },
    data: { paidAmount, status }
  });
}
