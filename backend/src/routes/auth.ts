import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

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
  organisation?: { name: string } | null;
  mustChangePassword: boolean;
  preferredLanguage?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organisationId: user.organisationId,
    organisationName: user.organisation?.name ?? "Platform",
    mustChangePassword: user.mustChangePassword,
    preferredLanguage: user.preferredLanguage === "mr" ? "mr" : "en"
  };
}
