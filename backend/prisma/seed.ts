import { Role, ServiceStatus } from "@prisma/client";
import { prisma } from "../src/lib/db.js";
import { ensureMonthlyBillings } from "../src/lib/billing.js";
import { hashPassword } from "../src/lib/auth.js";

async function main() {
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@kcn.local" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@kcn.local",
      role: Role.SUPER_ADMIN,
      passwordHash: await hashPassword("SuperAdmin@123")
    }
  });

  const org = await prisma.organisation.upsert({
    where: { name: "KCN Cable Network" },
    update: {},
    create: { name: "KCN Cable Network" }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@kcn.local" },
    update: {},
    create: {
      organisationId: org.id,
      name: "KCN Admin",
      email: "admin@kcn.local",
      phone: "9999999999",
      role: Role.ADMIN,
      passwordHash: await hashPassword("Admin@123"),
      mustChangePassword: true
    }
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@kcn.local" },
    update: {},
    create: {
      organisationId: org.id,
      name: "Ramesh Collector",
      email: "employee@kcn.local",
      phone: "8888888888",
      role: Role.EMPLOYEE,
      passwordHash: await hashPassword("Employee@123"),
      mustChangePassword: true
    }
  });

  const cablePlan = await prisma.plan.upsert({
    where: { id: "seed-cable-basic" },
    update: {},
    create: { id: "seed-cable-basic", organisationId: org.id, name: "Cable Basic", type: "CABLE", price: 300 }
  });
  const internetPlan = await prisma.plan.upsert({
    where: { id: "seed-internet-50" },
    update: {},
    create: { id: "seed-internet-50", organisationId: org.id, name: "Internet 50 Mbps", type: "INTERNET", price: 499 }
  });
  const box = await prisma.setTopBox.upsert({
    where: { organisationId_boxNumber: { organisationId: org.id, boxNumber: "STB10001" } },
    update: {},
    create: { organisationId: org.id, boxNumber: "STB10001", pairedCardNumber: "CARD90001" }
  });

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-1" },
    update: {},
    create: {
      id: "seed-customer-1",
      organisationId: org.id,
      collectorId: employee.id,
      firstName: "Amit",
      lastName: "Sharma",
      phone: "7777777777",
      address: "House 12, Main Road",
      cableStatus: ServiceStatus.ACTIVE,
      internetStatus: ServiceStatus.ACTIVE,
      cablePlanId: cablePlan.id,
      internetPlanId: internetPlan.id,
      boxes: { create: { setTopBoxId: box.id, reason: "Initial assignment" } }
    }
  });

  const now = new Date();
  await ensureMonthlyBillings(org.id, now.getMonth() + 1, now.getFullYear());

  console.log({
    superAdmin: superAdmin.email,
    admin: admin.email,
    employee: employee.email,
    sampleCustomer: customer.firstName
  });
}

main().finally(async () => prisma.$disconnect());
