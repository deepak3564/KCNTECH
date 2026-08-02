import { Role } from "@prisma/client";
import { prisma } from "../src/lib/db.js";
import { hashPassword } from "../src/lib/auth.js";

async function main() {
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const superAdminName = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error("SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required.");
  }

  if (superAdminPassword.length < 8) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      name: superAdminName,
      role: Role.SUPER_ADMIN,
      passwordHash: await hashPassword(superAdminPassword),
      isActive: true,
      deleted: false
    },
    create: {
      name: superAdminName,
      email: superAdminEmail,
      role: Role.SUPER_ADMIN,
      passwordHash: await hashPassword(superAdminPassword)
    }
  });

  console.log({
    superAdmin: superAdmin.email
  });
}

main().finally(async () => prisma.$disconnect());
