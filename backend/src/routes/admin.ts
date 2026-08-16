import { Router } from "express";
import { Role, ServiceStatus } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../lib/auth.js";
import { ensureMonthlyBillings } from "../lib/billing.js";
import { addCustomerHistory, describeCustomerChanges } from "../lib/customerHistory.js";
import { prisma } from "../lib/db.js";
import { overrideCustomerPlanHistory } from "../lib/planHistory.js";
import { organisationScope, requireAuth, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(Role.ADMIN, Role.SUPER_ADMIN));

adminRouter.get("/employees", async (req, res) => {
  const organisationId = organisationScope(req);
  const employees = await prisma.user.findMany({
    where: { organisationId, role: Role.EMPLOYEE, deleted: false },
    select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  res.json(employees);
});

adminRouter.get("/collectors", async (req, res) => {
  const organisationId = organisationScope(req);
  const collectors = await prisma.user.findMany({
    where: {
      organisationId,
      role: { in: [Role.ADMIN, Role.EMPLOYEE] },
      isActive: true,
      deleted: false
    },
    select: { id: true, name: true, email: true, phone: true, isActive: true, role: true, createdAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });
  res.json(collectors);
});

adminRouter.post("/employees", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      password: z.string().min(8)
    })
    .parse(req.body);
  const employee = await prisma.user.create({
    data: {
      organisationId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: Role.EMPLOYEE,
      passwordHash: await hashPassword(body.password),
      mustChangePassword: true
    },
    select: { id: true, name: true, email: true, phone: true, isActive: true }
  });
  res.status(201).json(employee);
});

adminRouter.put("/employees/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      password: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().min(8).optional()),
      isActive: z.boolean().optional()
    })
    .parse(req.body);
  const { password, ...employeeData } = body;
  const employee = await prisma.user.update({
    where: { id: req.params.id, organisationId, role: Role.EMPLOYEE },
    data: {
      ...employeeData,
      ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: true } : {})
    },
    select: { id: true, name: true, email: true, phone: true, isActive: true }
  });
  res.json(employee);
});

adminRouter.delete("/employees/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  await prisma.user.update({
    where: { id: req.params.id, organisationId, role: Role.EMPLOYEE },
    data: { deleted: true, isActive: false }
  });
  res.json({ message: "Employee Deleted." });
});

adminRouter.post("/plans", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ name: z.string().min(2), type: z.enum(["CABLE", "INTERNET"]), price: z.coerce.number().int().min(0) }).parse(req.body);
  if (body.type === "INTERNET" && !(await isInternetEnabled(organisationId))) {
    return res.status(400).json({ message: "Please Enable Internet System First." });
  }
  const plan = await prisma.plan.create({ data: { ...body, organisationId } });
  res.status(201).json(plan);
});

adminRouter.put("/plans/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      name: z.string().min(2).optional(),
      type: z.enum(["CABLE", "INTERNET"]).optional(),
      price: z.coerce.number().int().min(0).optional(),
      isActive: z.boolean().optional()
    })
    .parse(req.body);
  if (body.type === "INTERNET" && !(await isInternetEnabled(organisationId))) {
    return res.status(400).json({ message: "Please Enable Internet System First." });
  }
  const plan = await prisma.plan.update({ where: { id: req.params.id, organisationId }, data: body });
  res.json(plan);
});

adminRouter.get("/plans", async (req, res) => {
  const organisationId = organisationScope(req);
  res.json(await prisma.plan.findMany({ where: { organisationId, deleted: false }, orderBy: [{ type: "asc" }, { price: "asc" }] }));
});

adminRouter.delete("/plans/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  await prisma.plan.update({
    where: { id: req.params.id, organisationId },
    data: { deleted: true, isActive: false }
  });
  res.json({ message: "Plan Deleted." });
});

adminRouter.post("/set-top-boxes", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ boxNumber: z.string().min(1), pairedCardNumber: z.string().min(1), notes: z.string().optional() }).parse(req.body);
  const box = await prisma.setTopBox.create({ data: { ...body, organisationId } });
  res.status(201).json(box);
});

adminRouter.put("/set-top-boxes/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      boxNumber: z.string().min(1).optional(),
      pairedCardNumber: z.string().min(1).optional(),
      status: z.enum(["ACTIVE", "REPAIRED", "REPLACED", "RETURNED"]).optional(),
      notes: z.string().nullable().optional()
    })
    .parse(req.body);
  const box = await prisma.setTopBox.update({ where: { id: req.params.id, organisationId }, data: body });
  res.json(box);
});

adminRouter.get("/set-top-boxes", async (req, res) => {
  const organisationId = organisationScope(req);
  res.json(await prisma.setTopBox.findMany({
    where: { organisationId, deleted: false },
    include: { assignments: { where: { unassignedAt: null, customer: { deleted: false } }, include: { customer: true } } },
    orderBy: { boxNumber: "asc" }
  }));
});

adminRouter.post("/set-top-boxes/:id/unlink", async (req, res) => {
  const organisationId = organisationScope(req);
  const box = await prisma.setTopBox.findFirst({ where: { id: req.params.id, organisationId, deleted: false } });
  if (!box) return res.status(404).json({ message: "Set Top Box Not Found." });
  const assignment = await prisma.customerBox.findFirst({
    where: { setTopBoxId: box.id, unassignedAt: null },
    include: { customer: true }
  });
  if (!assignment) return res.status(404).json({ message: "Set Top Box Is Not Linked." });
  await prisma.customerBox.update({
    where: { id: assignment.id },
    data: { unassignedAt: new Date(), reason: "Unlinked by admin" }
  });
  await addCustomerHistory({
    organisationId,
    customerId: assignment.customerId,
    userId: req.user!.id,
    comment: `Set top box unlinked: ${box.boxNumber}`
  });
  res.json({ message: "Set Top Box Unlinked." });
});

adminRouter.delete("/set-top-boxes/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  await prisma.setTopBox.update({
    where: { id: req.params.id, organisationId },
    data: { deleted: true, status: "RETURNED" }
  });
  res.json({ message: "Set Top Box Deleted." });
});

adminRouter.post("/customers", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      customerCode: z.string().optional().nullable(),
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().min(3),
      collectorId: z.string().optional(),
      cableStatus: z.nativeEnum(ServiceStatus).default(ServiceStatus.NA),
      internetStatus: z.nativeEnum(ServiceStatus).default(ServiceStatus.NA),
      cablePlanId: z.string().optional(),
      internetPlanId: z.string().optional(),
      cableStartMonth: z.coerce.number().int().min(1).max(12).optional(),
      cableStartYear: z.coerce.number().int().optional(),
      internetStartMonth: z.coerce.number().int().min(1).max(12).optional(),
      internetStartYear: z.coerce.number().int().optional(),
      effectiveMonth: z.coerce.number().int().min(1).max(12).optional(),
      effectiveYear: z.coerce.number().int().optional(),
      setTopBoxId: z.string().optional(),
      newSetTopBoxNumber: z.string().optional(),
      newPairedCardNumber: z.string().optional(),
      notes: z.string().optional()
    })
    .parse(req.body);
  if ((body.newSetTopBoxNumber && !body.newPairedCardNumber) || (!body.newSetTopBoxNumber && body.newPairedCardNumber)) {
    return res.status(400).json({ message: "Please Enter Both Set Top Box Number And Paired Card Number." });
  }
  if (body.setTopBoxId && body.newSetTopBoxNumber) {
    return res.status(400).json({ message: "Please Select Existing Set Top Box Or Enter New Set Top Box Details." });
  }
  if (!(await isInternetEnabled(organisationId))) {
    body.internetStatus = ServiceStatus.NA;
    body.internetPlanId = undefined;
    body.internetStartMonth = undefined;
    body.internetStartYear = undefined;
  }

  await validateCustomerSelections(organisationId, {
    collectorId: body.collectorId,
    cablePlanId: body.cablePlanId,
    internetPlanId: body.internetPlanId,
    setTopBoxId: body.setTopBoxId
  });

  const customer = await prisma.$transaction(async (tx) => {
    const newSetTopBox = body.newSetTopBoxNumber && body.newPairedCardNumber
      ? await tx.setTopBox.create({
          data: {
            organisationId,
            boxNumber: body.newSetTopBoxNumber.trim(),
            pairedCardNumber: body.newPairedCardNumber.trim()
          }
        })
      : null;

    return tx.customer.create({
      data: {
        organisationId,
        customerCode: body.customerCode?.trim() || null,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        address: body.address,
        collectorId: body.collectorId || null,
        cableStatus: body.cableStatus,
        internetStatus: body.internetStatus,
        cablePlanId: body.cableStatus === ServiceStatus.NA ? null : body.cablePlanId || null,
        internetPlanId: body.internetStatus === ServiceStatus.NA ? null : body.internetPlanId || null,
        cableStartMonth: body.cableStatus === ServiceStatus.NA ? null : body.cableStartMonth || null,
        cableStartYear: body.cableStatus === ServiceStatus.NA ? null : body.cableStartYear || null,
        internetStartMonth: body.internetStatus === ServiceStatus.NA ? null : body.internetStartMonth || null,
        internetStartYear: body.internetStatus === ServiceStatus.NA ? null : body.internetStartYear || null,
        notes: body.notes,
        boxes: body.setTopBoxId || newSetTopBox ? { create: { setTopBoxId: body.setTopBoxId ?? newSetTopBox!.id, reason: "Initial assignment" } } : undefined
      },
      include: { cablePlan: true, internetPlan: true }
    });
  });
  const now = new Date();
  await overrideCustomerPlanHistory({
    organisationId,
    customer,
    month: body.effectiveMonth ?? body.cableStartMonth ?? now.getMonth() + 1,
    year: body.effectiveYear ?? body.cableStartYear ?? now.getFullYear()
  });
  await addCustomerHistory({
    organisationId,
    customerId: customer.id,
    userId: req.user!.id,
    comment: "Customer created"
  });
  res.status(201).json(customer);
});

adminRouter.put("/customers/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z
    .object({
      customerCode: z.string().optional().nullable(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      address: z.string().min(3).optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
      collectorId: z.string().nullable().optional(),
      cableStatus: z.nativeEnum(ServiceStatus).optional(),
      internetStatus: z.nativeEnum(ServiceStatus).optional(),
      cablePlanId: z.string().nullable().optional(),
      internetPlanId: z.string().nullable().optional(),
      cableStartMonth: z.coerce.number().int().min(1).max(12).nullable().optional(),
      cableStartYear: z.coerce.number().int().nullable().optional(),
      internetStartMonth: z.coerce.number().int().min(1).max(12).nullable().optional(),
      internetStartYear: z.coerce.number().int().nullable().optional(),
      effectiveMonth: z.coerce.number().int().min(1).max(12).optional(),
      effectiveYear: z.coerce.number().int().optional(),
      setTopBoxId: z.string().nullable().optional(),
      notes: z.string().nullable().optional()
    })
    .parse(req.body);
  const { effectiveMonth, effectiveYear, setTopBoxId, ...customerData } = body;
  if (!(await isInternetEnabled(organisationId))) {
    customerData.internetStatus = ServiceStatus.NA;
    customerData.internetPlanId = null;
    customerData.internetStartMonth = null;
    customerData.internetStartYear = null;
  }
  if (customerData.cableStatus === ServiceStatus.NA) {
    customerData.cablePlanId = null;
    customerData.cableStartMonth = null;
    customerData.cableStartYear = null;
  }
  if (customerData.internetStatus === ServiceStatus.NA) {
    customerData.internetPlanId = null;
    customerData.internetStartMonth = null;
    customerData.internetStartYear = null;
  }
  const before = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId, deleted: false } });
  if (!before) return res.status(404).json({ message: "Customer not found." });
  await validateCustomerSelections(organisationId, {
    collectorId: customerData.collectorId ?? undefined,
    cablePlanId: customerData.cablePlanId ?? undefined,
    internetPlanId: customerData.internetPlanId ?? undefined,
    setTopBoxId: setTopBoxId ?? undefined
  }, before.id);
  const customer = await prisma.customer.update({
    where: { id: req.params.id, organisationId },
    data: customerData,
    include: { cablePlan: true, internetPlan: true }
  });
  if (setTopBoxId !== undefined) {
    await updateCustomerSetTopBox({
      organisationId,
      customerId: customer.id,
      userId: req.user!.id,
      setTopBoxId
    });
  }
  const now = new Date();
  await overrideCustomerPlanHistory({
    organisationId,
    customer,
    month: effectiveMonth ?? now.getMonth() + 1,
    year: effectiveYear ?? now.getFullYear()
  });
  await addCustomerHistory({
    organisationId,
    customerId: customer.id,
    userId: req.user!.id,
    comment: describeCustomerChanges(before, customerData)
  });
  res.json(customer);
});

adminRouter.delete("/customers/:id", async (req, res) => {
  const organisationId = organisationScope(req);
  const customer = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId, deleted: false } });
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { deleted: true, status: "INACTIVE" }
  });
  await prisma.customerBox.updateMany({
    where: { customerId: customer.id, unassignedAt: null },
    data: { unassignedAt: new Date(), reason: "Customer deleted" }
  });
  await addCustomerHistory({
    organisationId,
    customerId: customer.id,
    userId: req.user!.id,
    comment: "Customer deleted"
  });
  res.json({ message: "Customer Deleted." });
});

adminRouter.post("/customers/:id/set-top-boxes", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ setTopBoxId: z.string(), reason: z.string().min(2) }).parse(req.body);
  const customer = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId, deleted: false } });
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  await validateCustomerSelections(organisationId, { setTopBoxId: body.setTopBoxId });

  await prisma.customerBox.updateMany({
    where: { customerId: customer.id, unassignedAt: null },
    data: { unassignedAt: new Date(), reason: body.reason }
  });
  const assignment = await prisma.customerBox.create({
    data: { customerId: customer.id, setTopBoxId: body.setTopBoxId, reason: body.reason }
  });
  const box = await prisma.setTopBox.findUnique({ where: { id: body.setTopBoxId } });
  await addCustomerHistory({
    organisationId,
    customerId: customer.id,
    userId: req.user!.id,
    comment: `Set top box linked: ${box?.boxNumber ?? body.setTopBoxId}. Reason: ${body.reason}`
  });
  res.status(201).json(assignment);
});

adminRouter.post("/customers/:id/maintenance", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int(), amount: z.coerce.number().int().min(0), reason: z.string().min(2) }).parse(req.body);
  const customer = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId, deleted: false } });
  if (!customer) return res.status(404).json({ message: "Customer not found." });
  const charge = await prisma.maintenanceCharge.create({ data: { ...body, customerId: customer.id } });
  await ensureMonthlyBillings(organisationId, body.month, body.year);
  await addCustomerHistory({
    organisationId,
    customerId: customer.id,
    userId: req.user!.id,
    comment: `Maintenance charge added for ${body.month}/${body.year}: ${body.amount}. Reason: ${body.reason}`
  });
  res.status(201).json(charge);
});

adminRouter.post("/generate-monthly-bills", async (req, res) => {
  const organisationId = organisationScope(req);
  const now = new Date();
  const body = z.object({ month: z.coerce.number().int().min(1).max(12).default(now.getMonth() + 1), year: z.coerce.number().int().default(now.getFullYear()) }).parse(req.body ?? {});
  await ensureMonthlyBillings(organisationId, body.month, body.year);
  res.json({ message: "Monthly pending bills generated.", month: body.month, year: body.year });
});

adminRouter.post("/handovers", async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ employeeId: z.string().min(1, "Please Select Employee."), amount: z.coerce.number().int().min(1, "Please Enter Handover Amount."), fromDate: z.coerce.date(), toDate: z.coerce.date(), note: z.string().optional() }).parse(req.body);
  const handover = await prisma.employeeHandover.create({ data: { ...body, organisationId } });
  res.status(201).json(handover);
});

async function validateCustomerSelections(
  organisationId: string,
  selections: { collectorId?: string | null; cablePlanId?: string | null; internetPlanId?: string | null; setTopBoxId?: string | null },
  currentCustomerId?: string
) {
  if (selections.collectorId) {
    const collector = await prisma.user.findFirst({
      where: {
        id: selections.collectorId,
        organisationId,
        role: { in: [Role.ADMIN, Role.EMPLOYEE] },
        isActive: true,
        deleted: false
      }
    });
    if (!collector) throw new Error("Selected Collector Is Inactive Or Not Available.");
  }

  if (selections.cablePlanId) {
    const plan = await prisma.plan.findFirst({
      where: { id: selections.cablePlanId, organisationId, type: "CABLE", isActive: true, deleted: false }
    });
    if (!plan) throw new Error("Selected Cable Plan Is Inactive Or Not Available.");
  }

  if (selections.internetPlanId) {
    const plan = await prisma.plan.findFirst({
      where: { id: selections.internetPlanId, organisationId, type: "INTERNET", isActive: true, deleted: false }
    });
    if (!plan) throw new Error("Selected Internet Plan Is Inactive Or Not Available.");
  }

  if (selections.setTopBoxId) {
    const box = await prisma.setTopBox.findFirst({
      where: { id: selections.setTopBoxId, organisationId, status: "ACTIVE", deleted: false }
    });
    if (!box) throw new Error("Selected Set Top Box Is Inactive Or Not Available.");
    const linked = await prisma.customerBox.findFirst({ where: { setTopBoxId: selections.setTopBoxId, unassignedAt: null } });
    if (linked && linked.customerId === currentCustomerId) return;
    if (linked) throw new Error("Selected Set Top Box Is Already Linked To A Customer.");
  }
}

async function isInternetEnabled(organisationId: string) {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { internetEnabled: true }
  });
  return organisation?.internetEnabled ?? false;
}

async function updateCustomerSetTopBox({
  organisationId,
  customerId,
  userId,
  setTopBoxId
}: {
  organisationId: string;
  customerId: string;
  userId: string;
  setTopBoxId: string | null;
}) {
  const currentAssignment = await prisma.customerBox.findFirst({
    where: { customerId, unassignedAt: null },
    include: { setTopBox: true }
  });

  if (!setTopBoxId) {
    if (!currentAssignment) return;
    await prisma.customerBox.update({
      where: { id: currentAssignment.id },
      data: { unassignedAt: new Date(), reason: "Removed from customer edit" }
    });
    await addCustomerHistory({
      organisationId,
      customerId,
      userId,
      comment: `Set top box unlinked: ${currentAssignment.setTopBox.boxNumber}`
    });
    return;
  }

  if (currentAssignment?.setTopBoxId === setTopBoxId) return;

  await prisma.customerBox.updateMany({
    where: { customerId, unassignedAt: null },
    data: { unassignedAt: new Date(), reason: "Changed from customer edit" }
  });
  const nextBox = await prisma.setTopBox.findFirst({ where: { id: setTopBoxId, organisationId } });
  await prisma.customerBox.create({
    data: { customerId, setTopBoxId, reason: "Changed from customer edit" }
  });
  await addCustomerHistory({
    organisationId,
    customerId,
    userId,
    comment: `Set top box linked: ${nextBox?.boxNumber ?? setTopBoxId}`
  });
}
