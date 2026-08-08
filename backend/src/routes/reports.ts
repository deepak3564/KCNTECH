import { Router } from "express";
import { PaymentMode, Role } from "@prisma/client";
import { z } from "zod";
import { ensureMonthlyBillings } from "../lib/billing.js";
import { prisma } from "../lib/db.js";
import { organisationScope, requireAuth, requireRole } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole(Role.ADMIN, Role.EMPLOYEE));

reportsRouter.get("/dashboard", async (req, res) => {
  const organisationId = organisationScope(req);
  const now = new Date();
  const query = z.object({ month: z.coerce.number().int().min(1).max(12).default(now.getMonth() + 1), year: z.coerce.number().int().default(now.getFullYear()) }).parse(req.query);
  await ensureMonthlyBillings(organisationId, query.month, query.year);

  const customerWhere = {
    organisationId,
    deleted: false,
    ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {})
  };
  const billings = await prisma.monthlyBilling.findMany({
    where: {
      organisationId,
      month: query.month,
      year: query.year,
      customer: { deleted: false, status: "ACTIVE", ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {}) }
    }
  });
  const collected = billings.reduce((sum, item) => sum + item.paidAmount, 0);
  const expected = billings.reduce((sum, item) => sum + item.totalAmount, 0);

  const [activeCustomers, inactiveCustomers, employees] = await Promise.all([
    prisma.customer.count({ where: { ...customerWhere, status: "ACTIVE" } }),
    prisma.customer.count({ where: { ...customerWhere, status: "INACTIVE" } }),
    prisma.user.count({ where: { organisationId, role: Role.EMPLOYEE, isActive: true, deleted: false } })
  ]);

  res.json({
    month: query.month,
    year: query.year,
    activeCustomers,
    inactiveCustomers,
    employeeCount: req.user!.role === Role.ADMIN ? employees : undefined,
    expected,
    collected,
    pending: expected - collected,
    paidBills: billings.filter((item) => item.status === "PAID").length,
    partialBills: billings.filter((item) => item.status === "PARTIAL").length,
    pendingBills: billings.filter((item) => item.status === "PENDING").length
  });
});

reportsRouter.get("/employee-ledger", async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z
    .object({
      employeeId: z.string().optional(),
      fromDate: z.coerce.date(),
      toDate: z.coerce.date()
    })
    .parse(req.query);

  const employeeId = req.user!.role === Role.EMPLOYEE ? req.user!.id : query.employeeId;
  if (!employeeId) return res.status(400).json({ message: "Employee is required." });
  const fromDate = startOfDay(query.fromDate);
  const toDate = endOfDay(query.toDate);

  const [payments, handovers] = await Promise.all([
    prisma.payment.findMany({
      where: {
        organisationId,
        employeeId,
        paidAt: { gte: fromDate, lte: toDate },
        mode: { in: ["CASH", "EMPLOYEE_UPI"] }
      },
      include: { billing: { include: { customer: true } } },
      orderBy: { paidAt: "desc" }
    }),
    prisma.employeeHandover.findMany({
      where: { organisationId, employeeId, handedOverAt: { gte: fromDate, lte: toDate } },
      orderBy: { handedOverAt: "desc" }
    })
  ]);

  const collected = payments.reduce((sum, item) => sum + item.amount, 0);
  const handedOver = handovers.reduce((sum, item) => sum + item.amount, 0);
  res.json({ collected, handedOver, balanceDueFromEmployee: collected - handedOver, payments, handovers });
});

reportsRouter.get("/employee-collection-summary", requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const now = new Date();
  const query = z
    .object({
      month: z.coerce.number().int().min(1).max(12).default(now.getMonth() + 1),
      year: z.coerce.number().int().default(now.getFullYear())
    })
    .parse(req.query);

  await ensureMonthlyBillings(organisationId, query.month, query.year);

  const monthStart = new Date(query.year, query.month - 1, 1);
  const monthEnd = endOfDay(new Date(query.year, query.month, 0));

  const [collectors, billings, handovers] = await Promise.all([
    prisma.user.findMany({
      where: {
        organisationId,
        role: { in: [Role.ADMIN, Role.EMPLOYEE] },
        deleted: false
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    }),
    prisma.monthlyBilling.findMany({
      where: {
        organisationId,
        month: query.month,
        year: query.year,
        customer: { deleted: false, status: "ACTIVE" }
      },
      include: {
        payments: true,
        customer: { select: { collectorId: true } }
      }
    }),
    prisma.employeeHandover.findMany({
      where: {
        organisationId,
        handedOverAt: { gte: monthStart, lte: monthEnd }
      }
    })
  ]);

  const summary = new Map<string, {
    collectorId: string | null;
    collectorName: string;
    collectorRole: string;
    isActive: boolean;
    assignedCustomers: number;
    expected: number;
    collected: number;
    pending: number;
    cashCollected: number;
    adminUpiCollected: number;
    employeeUpiCollected: number;
    handedOver: number;
    balanceDueFromCollector: number;
  }>();

  for (const collector of collectors) {
    summary.set(collector.id, {
      collectorId: collector.id,
      collectorName: collector.name,
      collectorRole: collector.role,
      isActive: collector.isActive,
      assignedCustomers: 0,
      expected: 0,
      collected: 0,
      pending: 0,
      cashCollected: 0,
      adminUpiCollected: 0,
      employeeUpiCollected: 0,
      handedOver: 0,
      balanceDueFromCollector: 0
    });
  }

  const unassignedKey = "UNASSIGNED";
  for (const billing of billings) {
    const key = billing.customer.collectorId ?? unassignedKey;
    if (!summary.has(key)) {
      summary.set(key, {
        collectorId: null,
        collectorName: "Not Assigned",
        collectorRole: "UNASSIGNED",
        isActive: false,
        assignedCustomers: 0,
        expected: 0,
        collected: 0,
        pending: 0,
        cashCollected: 0,
        adminUpiCollected: 0,
        employeeUpiCollected: 0,
        handedOver: 0,
        balanceDueFromCollector: 0
      });
    }
    const row = summary.get(key)!;
    row.assignedCustomers += 1;
    row.expected += billing.totalAmount;
    row.collected += billing.paidAmount;
    row.pending += Math.max(billing.totalAmount - billing.paidAmount, 0);
    for (const payment of billing.payments) {
      if (payment.mode === PaymentMode.CASH) row.cashCollected += payment.amount;
      if (payment.mode === PaymentMode.ADMIN_UPI) row.adminUpiCollected += payment.amount;
      if (payment.mode === PaymentMode.EMPLOYEE_UPI) row.employeeUpiCollected += payment.amount;
    }
  }

  for (const handover of handovers) {
    const row = summary.get(handover.employeeId);
    if (row) row.handedOver += handover.amount;
  }

  const rows = Array.from(summary.values())
    .map((row) => ({
      ...row,
      balanceDueFromCollector: row.cashCollected + row.employeeUpiCollected - row.handedOver
    }))
    .filter((row) => row.assignedCustomers > 0 || row.collected > 0 || row.handedOver > 0)
    .sort((a, b) => b.expected - a.expected || a.collectorName.localeCompare(b.collectorName));

  res.json({
    month: query.month,
    year: query.year,
    totals: rows.reduce(
      (total, row) => ({
        assignedCustomers: total.assignedCustomers + row.assignedCustomers,
        expected: total.expected + row.expected,
        collected: total.collected + row.collected,
        pending: total.pending + row.pending,
        cashCollected: total.cashCollected + row.cashCollected,
        adminUpiCollected: total.adminUpiCollected + row.adminUpiCollected,
        employeeUpiCollected: total.employeeUpiCollected + row.employeeUpiCollected,
        handedOver: total.handedOver + row.handedOver,
        balanceDueFromCollector: total.balanceDueFromCollector + row.balanceDueFromCollector
      }),
      {
        assignedCustomers: 0,
        expected: 0,
        collected: 0,
        pending: 0,
        cashCollected: 0,
        adminUpiCollected: 0,
        employeeUpiCollected: 0,
        handedOver: 0,
        balanceDueFromCollector: 0
      }
    ),
    rows
  });
});

reportsRouter.get("/handover-history", requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z
    .object({
      employeeId: z.string().optional(),
      fromDate: z.coerce.date(),
      toDate: z.coerce.date()
    })
    .parse(req.query);
  const fromDate = startOfDay(query.fromDate);
  const toDate = endOfDay(query.toDate);

  const handovers = await prisma.employeeHandover.findMany({
    where: {
      organisationId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      handedOverAt: { gte: fromDate, lte: toDate }
    },
    include: { employee: { select: { id: true, name: true, email: true } } },
    orderBy: { handedOverAt: "desc" }
  });

  res.json(handovers);
});

reportsRouter.get("/payment-history", requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z
    .object({
      employeeId: z.string().optional(),
      mode: z.nativeEnum(PaymentMode).optional(),
      q: z.string().optional(),
      fromDate: z.coerce.date(),
      toDate: z.coerce.date()
    })
    .parse(req.query);
  const fromDate = startOfDay(query.fromDate);
  const toDate = endOfDay(query.toDate);
  const search = query.q?.trim();

  const payments = await prisma.payment.findMany({
    where: {
      organisationId,
      paidAt: { gte: fromDate, lte: toDate },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(search
        ? {
            billing: {
              customer: {
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
            }
          }
        : {})
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      billing: { include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } } } }
    },
    orderBy: { paidAt: "desc" }
  });

  const totals = payments.reduce(
    (summary, payment) => {
      summary.total += payment.amount;
      summary[payment.mode] += payment.amount;
      return summary;
    },
    { total: 0, CASH: 0, ADMIN_UPI: 0, EMPLOYEE_UPI: 0 }
  );

  res.json({ payments, totals });
});

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}
