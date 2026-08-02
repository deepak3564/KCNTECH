import { Customer, Plan, ServiceStatus } from "@prisma/client";
import { prisma } from "./db.js";

type CustomerWithPlans = Customer & {
  cablePlan: Plan | null;
  internetPlan: Plan | null;
};

type PlanSnapshotInput = {
  organisationId: string;
  customer: CustomerWithPlans;
  month: number;
  year: number;
};

export async function ensureCustomerPlanHistory({ organisationId, customer, month, year }: PlanSnapshotInput) {
  const existing = await prisma.customerPlanHistory.findUnique({
    where: { customerId_month_year: { customerId: customer.id, month, year } }
  });
  if (existing) return existing;

  const previous = await prisma.customerPlanHistory.findFirst({
    where: {
      customerId: customer.id,
      OR: [{ year: { lt: year } }, { year, month: { lt: month } }]
    },
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });

  const data = previous ? carryForwardSnapshot(previous, customer, month, year) : buildSnapshotFromCustomer(customer, month, year);

  return prisma.customerPlanHistory.upsert({
    where: { customerId_month_year: { customerId: customer.id, month, year } },
    create: {
      organisationId,
      customerId: customer.id,
      month,
      year,
      ...data
    },
    update: data
  });
}

export async function overrideCustomerPlanHistory({ organisationId, customer, month, year }: PlanSnapshotInput) {
  return prisma.customerPlanHistory.upsert({
    where: { customerId_month_year: { customerId: customer.id, month, year } },
    create: {
      organisationId,
      customerId: customer.id,
      month,
      year,
      ...buildSnapshotFromCustomer(customer, month, year)
    },
    update: buildSnapshotFromCustomer(customer, month, year)
  });
}

function buildSnapshotFromCustomer(customer: CustomerWithPlans, month: number, year: number) {
  const cableStarted = hasPlanStarted(month, year, customer.cableStartMonth, customer.cableStartYear);
  const internetStarted = hasPlanStarted(month, year, customer.internetStartMonth, customer.internetStartYear);
  const useCable = customer.cableStatus === ServiceStatus.ACTIVE && cableStarted && customer.cablePlan;
  const useInternet = customer.internetStatus === ServiceStatus.ACTIVE && internetStarted && customer.internetPlan;

  return {
    cablePlanId: useCable ? customer.cablePlanId : null,
    cablePlanName: useCable ? customer.cablePlan?.name ?? null : null,
    cablePrice: useCable ? customer.cablePlan?.price ?? 0 : 0,
    internetPlanId: useInternet ? customer.internetPlanId : null,
    internetPlanName: useInternet ? customer.internetPlan?.name ?? null : null,
    internetPrice: useInternet ? customer.internetPlan?.price ?? 0 : 0
  };
}

function carryForwardSnapshot(
  previous: {
    cablePlanId: string | null;
    cablePlanName: string | null;
    cablePrice: number;
    internetPlanId: string | null;
    internetPlanName: string | null;
    internetPrice: number;
  },
  customer: CustomerWithPlans,
  month: number,
  year: number
) {
  const current = buildSnapshotFromCustomer(customer, month, year);
  return {
    cablePlanId: previous.cablePlanId ?? current.cablePlanId,
    cablePlanName: previous.cablePlanName ?? current.cablePlanName,
    cablePrice: previous.cablePlanId ? previous.cablePrice : current.cablePrice,
    internetPlanId: previous.internetPlanId ?? current.internetPlanId,
    internetPlanName: previous.internetPlanName ?? current.internetPlanName,
    internetPrice: previous.internetPlanId ? previous.internetPrice : current.internetPrice
  };
}

function hasPlanStarted(month: number, year: number, startMonth: number | null, startYear: number | null) {
  if (!startMonth || !startYear) return true;
  return year > startYear || (year === startYear && month >= startMonth);
}
