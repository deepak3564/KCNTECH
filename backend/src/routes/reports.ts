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
