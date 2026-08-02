import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { ensureMonthlyBillings } from "../lib/billing.js";
import { prisma } from "../lib/db.js";
import { organisationScope, requireAuth, requireRole } from "../middleware/auth.js";

export const customersRouter = Router();
customersRouter.use(requireAuth, requireRole(Role.ADMIN, Role.EMPLOYEE));

customersRouter.get("/", async (req, res) => {
  const organisationId = organisationScope(req);
  const query = z
    .object({
      q: z.string().optional(),
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
  await ensureMonthlyBillings(organisationId, month, year);

  const customers = await prisma.customer.findMany({
    where: {
      organisationId,
      deleted: false,
      ...(req.user!.role === Role.EMPLOYEE ? { collectorId: req.user!.id } : {}),
      ...(query.collectorId ? { collectorId: query.collectorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q } },
              { lastName: { contains: query.q } },
              { phone: { contains: query.q } },
              { address: { contains: query.q } },
              { boxes: { some: { unassignedAt: null, setTopBox: { boxNumber: { contains: query.q } } } } },
              { boxes: { some: { unassignedAt: null, setTopBox: { pairedCardNumber: { contains: query.q } } } } }
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
    orderBy: { firstName: "asc" }
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
    orderBy: { createdAt: "asc" }
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
