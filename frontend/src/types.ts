export type Dashboard = {
  activeCustomers: number;
  inactiveCustomers: number;
  employeeCount?: number;
  expected: number;
  collected: number;
  pending: number;
  paidBills: number;
  partialBills: number;
  pendingBills: number;
};

export type Customer = {
  id: string;
  collectorId?: string | null;
  cablePlanId?: string | null;
  internetPlanId?: string | null;
  customerCode?: string | null;
  firstName: string;
  lastName?: string;
  phone?: string;
  address: string;
  status: "ACTIVE" | "INACTIVE";
  cableStatus: "ACTIVE" | "INACTIVE" | "NA";
  internetStatus: "ACTIVE" | "INACTIVE" | "NA";
  cableStartMonth?: number | null;
  cableStartYear?: number | null;
  internetStartMonth?: number | null;
  internetStartYear?: number | null;
  notes?: string | null;
  cablePlan?: { name: string; price: number };
  internetPlan?: { name: string; price: number };
  collector?: { id: string; name: string };
  boxes: Array<{
    assignedAt: string;
    unassignedAt?: string;
    reason?: string;
    setTopBox: { id: string; boxNumber: string; pairedCardNumber: string };
  }>;
  billings: Array<{
    id: string;
    month: number;
    year: number;
    totalAmount: number;
    paidAmount: number;
    status: "PENDING" | "PARTIAL" | "PAID";
    payments?: Array<{ amount: number; mode: string; paidAt: string; proofImageUrl?: string | null }>;
  }>;
};

export type Plan = {
  id: string;
  name: string;
  type: "CABLE" | "INTERNET";
  price: number;
  isActive?: boolean;
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  role?: "ADMIN" | "EMPLOYEE";
};

export type Box = {
  id: string;
  boxNumber: string;
  pairedCardNumber: string;
  status?: "ACTIVE" | "REPAIRED" | "REPLACED" | "RETURNED";
  notes?: string;
  assignments?: Array<{
    id: string;
    customerId: string;
    customer?: { firstName: string; lastName?: string | null };
  }>;
};

export type CustomerPlanHistory = {
  id: string;
  customerName: string;
  month: number;
  year: number;
  cablePlanName?: string | null;
  cablePrice: number;
  internetPlanName?: string | null;
  internetPrice: number;
};

export type Organisation = {
  id: string;
  name: string;
  users: Array<{ id: string; name: string; email: string; phone?: string; isActive: boolean }>;
};
