import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { organisationScope, requireAuth, requireRole } from "../middleware/auth.js";
import { Role } from "@prisma/client";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email }, include: { organisation: true } });

  if (!user || user.deleted || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  return res.json({
    token: signToken(user),
    user: sessionUser(user)
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { organisation: true }
  });
  if (!user) return res.status(404).json({ message: "User not found." });

  return res.json(sessionUser(user));
});

authRouter.put("/language", requireAuth, async (req, res) => {
  const body = z.object({ preferredLanguage: z.enum(["en", "mr"]) }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { preferredLanguage: body.preferredLanguage },
    include: { organisation: true }
  });

  return res.json(sessionUser(user));
});

authRouter.put("/theme", requireAuth, async (req, res) => {
  const body = z.object({ preferredTheme: z.enum(["professional", "brand", "light", "dark"]) }).parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { preferredTheme: body.preferredTheme },
    include: { organisation: true }
  });

  return res.json(sessionUser(user));
});

authRouter.get("/mail-notification", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { notificationEmail: true }
  });

  res.json({ notificationEmail: organisation?.notificationEmail ?? "" });
});

authRouter.put("/mail-notification", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ notificationEmail: z.string().email().or(z.literal("")) }).parse(req.body);
  const organisation = await prisma.organisation.update({
    where: { id: organisationId },
    data: { notificationEmail: body.notificationEmail.trim() || null },
    select: { notificationEmail: true }
  });

  res.json({ notificationEmail: organisation.notificationEmail ?? "" });
});

authRouter.get("/internet-settings", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { internetEnabled: true }
  });

  res.json({ internetEnabled: organisation?.internetEnabled ?? false });
});

authRouter.put("/internet-settings", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const organisationId = organisationScope(req);
  const body = z.object({ internetEnabled: z.coerce.boolean() }).parse(req.body);
  const organisation = await prisma.organisation.update({
    where: { id: organisationId },
    data: { internetEnabled: body.internetEnabled },
    select: { internetEnabled: true }
  });

  return res.json({ internetEnabled: organisation.internetEnabled });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const body = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.newPassword), mustChangePassword: false }
  });

  return res.json({ message: "Password changed successfully." });
});

function sessionUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  organisationId: string | null;
  organisation?: { name: string; internetEnabled?: boolean | null } | null;
  mustChangePassword: boolean;
  preferredLanguage?: string | null;
  preferredTheme?: string | null;
}) {
  const preferredTheme = ["brand", "light", "dark"].includes(user.preferredTheme ?? "") ? user.preferredTheme : "professional";

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organisationId: user.organisationId,
    organisationName: user.organisation?.name ?? "Platform",
    internetEnabled: user.organisation?.internetEnabled ?? false,
    mustChangePassword: user.mustChangePassword,
    preferredLanguage: user.preferredLanguage === "mr" ? "mr" : "en",
    preferredTheme
  };
}
