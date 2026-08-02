import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const superAdminRouter = Router();

superAdminRouter.use(requireAuth, requireRole(Role.SUPER_ADMIN));

superAdminRouter.get("/organisations", async (_req, res) => {
  const organisations = await prisma.organisation.findMany({
    include: { users: { where: { role: Role.ADMIN }, select: { id: true, name: true, email: true, phone: true, isActive: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(organisations);
});

superAdminRouter.post("/organisations", async (req, res) => {
  const body = z
    .object({
      organisationName: z.string().min(2),
      adminName: z.string().min(2),
      adminEmail: z.string().email(),
      adminPhone: z.string().optional(),
      adminPassword: z.string().min(8).optional()
    })
    .parse(req.body);

  const organisation = await prisma.organisation.create({
    data: {
      name: body.organisationName,
      users: {
        create: {
          name: body.adminName,
          email: body.adminEmail,
          phone: body.adminPhone,
          role: Role.ADMIN,
          passwordHash: await hashPassword(body.adminPassword ?? "Admin@123"),
          mustChangePassword: true
        }
      }
    },
    include: { users: true }
  });

  res.status(201).json(organisation);
});

superAdminRouter.put("/admins/:id", async (req, res) => {
  const body = z
    .object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      password: z.string().min(8).optional(),
      isActive: z.boolean().optional()
    })
    .parse(req.body);
  const { password, ...adminData } = body;
  const admin = await prisma.user.update({
    where: { id: req.params.id, role: Role.ADMIN },
    data: {
      ...adminData,
      ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: true } : {})
    },
    select: { id: true, name: true, email: true, phone: true, isActive: true }
  });
  res.json(admin);
});
