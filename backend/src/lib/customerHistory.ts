import { prisma } from "./db.js";

export async function addCustomerHistory({
  organisationId,
  customerId,
  userId,
  comment
}: {
  organisationId: string;
  customerId: string;
  userId?: string;
  comment: string;
}) {
  await prisma.customerHistory.create({
    data: {
      organisationId,
      customerId,
      userId,
      comment
    }
  });
}

export function describeCustomerChanges(before: Record<string, unknown>, after: Record<string, unknown>, displayValues: Record<string, string> = {}) {
  const labels: Record<string, string> = {
    firstName: "first name",
    lastName: "last name",
    phone: "phone",
    address: "address",
    status: "customer status",
    collectorId: "collector",
    cableStatus: "cable status",
    internetStatus: "internet status",
    cablePlanId: "cable plan",
    internetPlanId: "internet plan",
    cableStartMonth: "cable start month",
    cableStartYear: "cable start year",
    internetStartMonth: "internet start month",
    internetStartYear: "internet start year",
    notes: "notes"
  };

  const changes = Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key, value]) => `${labels[key] ?? key} changed to ${formatValue(displayValues[key] ?? value)}`);

  return changes.length ? changes.join("; ") : "Customer details updated";
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "NA";
  return String(value);
}
