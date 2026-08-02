const customLabels: Record<string, string> = {
  boxNumber: "Set Top Box Number",
  pairedCardNumber: "Paired Card Number",
  organisationName: "Organisation Name",
  adminName: "Admin Name",
  adminEmail: "Admin Email",
  adminPhone: "Admin Phone",
  adminPassword: "Admin Password",
  firstName: "First Name",
  lastName: "Last Name",
  cablePlanId: "Cable Plan",
  internetPlanId: "Internet Plan",
  setTopBoxId: "Set Top Box",
  isActive: "Status"
};

export function labelFor(key: string) {
  if (customLabels[key]) return customLabels[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
