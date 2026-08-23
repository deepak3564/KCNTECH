import { Router } from "express";
import { BillingStatus, Plan, Role } from "@prisma/client";
import { z } from "zod";
import { ensureMonthlyBillings, recalculateBillingStatus } from "../lib/billing.js";
import { addCustomerHistory } from "../lib/customerHistory.js";
import { prisma } from "../lib/db.js";
import { overrideCustomerPlanHistory } from "../lib/planHistory.js";
import { organisationScope, requireAuth, requireRole } from "../middleware/auth.js";

export const customersRouter = Router();
customersRouter.use(requireAuth, requireRole(Role.ADMIN, Role.EMPLOYEE));

customersRouter.get("/cable-plans", async (req, res) => {
  const organisationId = organisationScope(req);
  const plans = await prisma.plan.findMany({
    where: {
      organisationId,
      type: "CABLE",
      isActive: true,
      deleted: false
    },
    orderBy: { price: "asc" }
  });
  res.json(plans);
});

customersRouter.get("/address-suggestions", async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z.object({ q: z.string().optional() }).parse(req.query);
  const search = query.q?.trim();
  if (!search) return res.json([]);

  const rows = await prisma.customer.findMany({
    where: {
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {}),
      address: { contains: search, mode: "insensitive" }
    },
    distinct: ["address"],
    select: { address: true },
    orderBy: { address: "asc" },
    take: 12
  });

  res.json(rows.map((row) => row.address));
});

customersRouter.get("/search-cache", async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z
    .object({
      paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      year: z.coerce.number().int().optional()
    })
    .parse(req.query);

  const now = new Date();
  const month = query.month ?? now.getMonth() + 1;
  const year = query.year ?? now.getFullYear();
  await ensureMonthlyBillings(organisationId, month, year);

  const customers = await prisma.customer.findMany({
    where: {
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
    },
    select: {
      id: true,
      collectorId: true,
      customerCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      status: true,
      cableStatus: true,
      internetStatus: true,
      cablePlanId: true,
      internetPlanId: true,
      cableStartMonth: true,
      cableStartYear: true,
      internetStartMonth: true,
      internetStartYear: true,
      notes: true,
      collector: { select: { id: true, name: true } },
      boxes: {
        where: { unassignedAt: null },
        select: {
          assignedAt: true,
          unassignedAt: true,
          reason: true,
          setTopBox: { select: { id: true, boxNumber: true, pairedCardNumber: true } }
        },
        orderBy: { assignedAt: "desc" }
      },
      billings: {
        where: { month, year },
        select: { id: true, month: true, year: true, totalAmount: true, paidAmount: true, status: true },
        take: 1
      }
    },
    orderBy: [{ updatedAt: "desc" }, { firstName: "asc" }]
  });

  const filtered = query.paymentStatus
    ? customers.filter((customer) => customer.billings[0]?.status === query.paymentStatus)
    : customers;
  res.json(filtered);
});

customersRouter.get("/", async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z
    .object({
      q: z.string().optional(),
      address: z.string().optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      year: z.coerce.number().int().optional(),
      collectorId: z.string().optional()
    })
    .parse(req.query);

  const now = new Date();
  const month = query.month ?? now.getMonth() + 1;
  const year = query.year ?? now.getFullYear();
  const search = query.q?.trim();
  const addressSearch = query.address?.trim();
  await ensureMonthlyBillings(organisationId, month, year);

  const customers = await prisma.customer.findMany({
    where: {
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {}),
      ...(req.user!.role === Role.ADMIN && query.collectorId ? { collectorId: query.collectorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(addressSearch ? { address: { contains: addressSearch, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { customerCode: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
              { boxes: { some: { unassignedAt: null, setTopBox: { boxNumber: { contains: search, mode: "insensitive" } } } } },
              { boxes: { some: { unassignedAt: null, setTopBox: { pairedCardNumber: { contains: search, mode: "insensitive" } } } } }
            ]
          }
        : {})
    },
    include: {
      collector: { select: { id: true, name: true } },
      cablePlan: true,
      internetPlan: true,
      boxes: { where: { unassignedAt: null }, include: { setTopBox: true }, orderBy: { assignedAt: "desc" } },
      billings: { where: { month, year }, include: { payments: true } }
    },
    orderBy: [{ updatedAt: "desc" }, { firstName: "asc" }]
  });

  const filtered = query.paymentStatus
    ? customers.filter((customer) => customer.billings[0]?.status === query.paymentStatus)
    : customers;
  res.json(filtered);
});

customersRouter.get("/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  const customer = await prisma.customer.findFirst({
    where: {
      id: req.params.id,
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
    },
    include: {
      collector: { select: { id: true, name: true, phone: true } },
      cablePlan: true,
      internetPlan: true,
      boxes: { where: { unassignedAt: null }, include: { setTopBox: true }, orderBy: { assignedAt: "desc" } },
      billings: { include: { payments: { include: { employee: { select: { name: true } } } } }, orderBy: [{ year: "desc" }, { month: "desc" }] },
      maintenance: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      requests: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  res.json(customer);
});

customersRouter.get("/:id/history", async (req, res) => {
  const organisationId = organisationScope(req);
  const customer = await prisma.customer.findFirst({
    where: {
      id: req.params.id,
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
    }
  });
  if (!customer) return res.status(404).json({ message: "Customer not found." });

  const history = await prisma.customerHistory.findMany({
    where: { organisationId, customerId: customer.id },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" }
  });

  res.json(history);
});

customersRouter.get("/:id/plan-history", async (req, res) => {
  const organisationId = organisationScope(req);
  const customer = await prisma.customer.findFirst({
    where: {
      id: req.params.id,
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
    },
    select: { id: true, firstName: true, lastName: true }
  });
  if (!customer) return res.status(404).json({ message: "Customer not found." });

  const planHistory = await prisma.customerPlanHistory.findMany({
    where: { organisationId, customerId: customer.id },
    orderBy: [{ year: "asc" }, { month: "asc" }]
  });

  res.json(planHistory.map((item) => ({
    ...item,
    customerName: `${customer.firstName} ${customer.lastName ?? ""}`.trim()
  })));
});

customersRouter.put("/:id/cable-plan", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      cablePlanId: z.string(),
      month: z.coerce.number().int().min(1).max(12),
      year: z.coerce.number().int()
    })
    .parse(req.body);

  const customer = await prisma.customer.findFirst({
    where: {
      id: req.params.id,
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
    },
    include: { cablePlan: true, internetPlan: true }
  });
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  if (req.user!.role === Role.EMPLOYEE) {
    const selectedBilling = await prisma.monthlyBilling.findUnique({
      where: { customerId_month_year: { customerId: customer.id, month: body.month, year: body.year } },
      include: { payments: true }
    });
    if (selectedBilling && (selectedBilling.status !== "PENDING" || selectedBilling.paidAmount > 0 || selectedBilling.payments.length > 0)) {
      return res.status(400).json({ message: "Bill Already Collected For Selected Month. If Change In Plans Please Contact Admin." });
    }
  }

  const cablePlan = await prisma.plan.findFirst({
    where: { id: body.cablePlanId, organisationId, type: "CABLE", isActive: true, deleted: false }
  });
  if (!cablePlan) return res.status(400).json({ message: "Selected Cable Plan Is Inactive Or Not Available." });
  const selectedPeriodStartsEarlier = isBeforePeriod(body.month, body.year, customer.cableStartMonth, customer.cableStartYear);
  const cableStartMonth = !customer.cableStartMonth || selectedPeriodStartsEarlier ? body.month : customer.cableStartMonth;
  const cableStartYear = !customer.cableStartYear || selectedPeriodStartsEarlier ? body.year : customer.cableStartYear;

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      cableStatus: "ACTIVE",
      cablePlanId: cablePlan.id,
      cableStartMonth,
      cableStartYear
    },
    include: {
      cablePlan: true,
      internetPlan: true,
      collector: { select: { id: true, name: true, phone: true } },
      boxes: { where: { unassignedAt: null }, include: { setTopBox: true }, orderBy: { assignedAt: "desc" } },
      billings: { include: { payments: { include: { employee: { select: { name: true } } } } }, orderBy: [{ year: "desc" }, { month: "desc" }] },
      maintenance: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      requests: { orderBy: { createdAt: "desc" } }
    }
  });

  await overrideCustomerPlanHistory({ organisationId, customer: updated, month: body.month, year: body.year });
  await ensureMonthlyBillings(organisationId, body.month, body.year);
  const billing = await prisma.monthlyBilling.findUnique({
    where: { customerId_month_year: { customerId: customer.id, month: body.month, year: body.year } }
  });
  if (billing) await recalculateBillingStatus(billing.id);
  await repairFutureEmptyCableBillings({
    organisationId,
    customerId: customer.id,
    fromMonth: body.month,
    fromYear: body.year,
    cablePlan
  });

  await addCustomerHistory({
    organisationId,
    customerId: customer.id,
    userId: req.user!.id,
    comment: `Cable plan updated to ${cablePlan.name} for ${body.month}/${body.year}.`
  });

  res.json(updated);
});

function isBeforePeriod(month: number, year: number, targetMonth?: number | null, targetYear?: number | null) {
  if (!targetMonth || !targetYear) return false;
  return year < targetYear || (year === targetYear && month < targetMonth);
}

function isAfterPeriod(month: number, year: number, targetMonth: number, targetYear: number) {
  return year > targetYear || (year === targetYear && month > targetMonth);
}

async function repairFutureEmptyCableBillings({
  organisationId,
  customerId,
  fromMonth,
  fromYear,
  cablePlan
}: {
  organisationId: string;
  customerId: string;
  fromMonth: number;
  fromYear: number;
  cablePlan: Plan;
}) {
  const futureEmptyPlanHistory = await prisma.customerPlanHistory.findMany({
    where: {
      organisationId,
      customerId,
      OR: [{ year: { gt: fromYear } }, { year: fromYear, month: { gt: fromMonth } }],
      AND: [{ OR: [{ cablePlanId: null }, { cablePrice: 0 }] }]
    }
  });

  for (const history of futureEmptyPlanHistory) {
    const updatedHistory = await prisma.customerPlanHistory.update({
      where: { id: history.id },
      data: {
        cablePlanId: cablePlan.id,
        cablePlanName: cablePlan.name,
        cablePrice: cablePlan.price
      }
    });

    const billing = await prisma.monthlyBilling.findUnique({
      where: { customerId_month_year: { customerId, month: history.month, year: history.year } }
    });
    if (!billing || billing.paidAmount > 0 || !isAfterPeriod(billing.month, billing.year, fromMonth, fromYear)) continue;

    await prisma.monthlyBilling.update({
      where: { id: billing.id },
      data: {
        cableAmount: cablePlan.price,
        internetAmount: updatedHistory.internetPrice,
        totalAmount: cablePlan.price + updatedHistory.internetPrice + billing.maintenanceAmount,
        status: BillingStatus.PENDING
      }
    });
  }
}
